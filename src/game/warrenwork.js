// (Round 107) The Deep Warren at work (laid out by world/deeps/warren.js):
// the noise you make (the scree and the boards are loud underfoot: the
// tunnelers are blind, and hear you a long way off, and come; the moss,
// the loam and the rugs are quiet); the lantern pods (the gloom moths
// smother them; coax one and it glows again); the hollow floor (cracked
// earth gives way under whatever stands on it a moment, and drops it into
// the pit below: and now and then the old diggers left something in it);
// the pantry (the dresser pushed along off its little door); the stopper
// (the Hollowfolk's warning read, the earth dug out); the round doors; and
// the tunnelers that stop to eat the grubs.
//
// What's been done (the pods as they were left, the floors fallen in, the
// dressers pushed along, the pantries and the stoppers opened) is kept in
// the floor's state, and put back when the floor's made again (see
// restore).
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';

const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.warren ||= { dark: {}, lit: {}, fallen: {}, moved: {}, opened: {}, dug: {}, warned: {} });
// What's going on about the floor this visit (not saved).
export const wrT = (run) => (run.warrenT ||= { told: {}, last: new Map(), noiseT: new Map(), on: new Map() });
const isWarren = (run) => run && run.rec && run.rec.type === 'warren';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
// Loud underfoot, and how far it carries.
export const LOUD = new Map([[B.wr_scree, 8], [B.wr_boards, 6]]);
// What hears it.
const HEARS = new Set(['tunneler', 'badger', 'first_digger']);
// How long on cracked earth before it goes.
export const GIVE_AFTER = 0.5;

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isWarren(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const q of run.data.pods || []) {
    if (S.dark[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, false);
    else if (S.lit[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, true);
  }
  for (const q of run.data.cracks || []) if (S.fallen[k2(q.x, q.z)]) give(run, q, true);
  for (const p of run.data.pantries || []) {
    const m = S.moved[k2(p.dresser.x, p.dresser.z)];
    if (m) {
      w.setBlock(p.dresser.x, FY, p.dresser.z, B.air);
      w.setBlock(m.x, FY, m.z, B.wr_dresser, p.dir.x ? 1 : 0);
    }
    if (S.opened[k2(p.door.x, p.door.z)]) for (const y of [FY, FY + 1]) w.setBlock(p.door.x, y, p.door.z, B.air);
  }
  for (const q of run.data.stoppers || []) if (S.dug[k2(q.x, q.z)]) for (const y of [FY, FY + 1]) w.setBlock(q.x, y, q.z, B.air);
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'wr_casks': return 'Casks of mushroom ale, the bungs sealed with wax.';
    case 'wr_book': return 'A book, its pages stuck together with damp.';
    case 'wr_speakstone': return 'The speaking-stone, worn smooth by the hands of speakers.';
    case 'wr_dead': return 'One of the delvers, dead against the earth.';
    case 'wr_bones': return 'Bones, huge, of something that dug here once.';
    default: return null;
  }
}
export function interact(run, x, y, z, b) {
  if (!isWarren(run)) return false;
  const game = run.game;
  const w = game.world;
  const S = mine(run);
  switch (b.interact) {
    // A lantern pod: coaxed back into glowing (or warm in your hand).
    case 'wr_pod': {
      if (w.getState(x, y, z)) {
        game.ui.msg('A lantern pod, warm in your hand, glowing gently.', '#ffd890');
        return true;
      }
      w.setState(x, y, z, true);
      delete S.dark[k2(x, z)];
      S.lit[k2(x, z)] = true;
      game.lightDirty = true;
      game.renderer.emit(x, y + 1.6, z, { n: 10, color: ['#ffa830', '#ffd470', '#fff6c8'], up: 8, speed: 10, life: 0.8, glow: true });
      const T = wrT(run);
      game.ui.msg(T.told.coax ? 'You rub the pod, and it glows again.' : 'You rub the dark pod gently between your hands, the way the lamplighters did, and it warms, and glows again.', '#ffd890', !T.told.coax);
      T.told.coax = true;
      return true;
    }
    // A round door: earth behind it now (or, the one scored, from inside).
    case 'wr_door':
      game.ui.msg(w.getMeta(x, y, z) & 1 ? 'A round door, its paint scored deep in long strokes from the other side. Something wanted out. It doesn\'t open: earth has been heaped against it.' : 'A round door, green, its brass knob cold. It won\'t open: the room behind it has fallen in.', '#d8c8a0');
      return true;
    // The dresser: pushed along the wall, off whatever it was hiding.
    case 'wr_dresser': {
      const p = (run.data.pantries || []).find((q) => (S.moved[k2(q.dresser.x, q.dresser.z)] || q.dresser).x === x && (S.moved[k2(q.dresser.x, q.dresser.z)] || q.dresser).z === z);
      if (!p || S.moved[k2(p.dresser.x, p.dresser.z)]) {
        game.ui.msg('A dresser, its crockery rattling. Heavy.', '#d8c8a0');
        return true;
      }
      const along = p.dir.x ? [{ x: 0, z: 1 }, { x: 0, z: -1 }] : [{ x: 1, z: 0 }, { x: -1, z: 0 }];
      for (const a of along) {
        const to = { x: x + a.x, z: z + a.z };
        if (w.getBlock(to.x, FY, to.z) !== B.air || w.getBlock(to.x, FY + 1, to.z) !== B.air || !BLOCKS[w.getBlock(to.x, FY - 1, to.z)].solid) continue;
        if (game.occ?.get(game.occKey(to.x, FY, to.z))) continue;
        w.setBlock(x, FY, z, B.air);
        w.setBlock(to.x, FY, to.z, B.wr_dresser, p.dir.x ? 1 : 0);
        S.moved[k2(p.dresser.x, p.dresser.z)] = to;
        game.audio?.play('creak', { x, z });
        game.renderer.emit(x, FY + 0.3, z, { n: 10, color: ['#8a7a5a', '#b0a080'], up: 6, speed: 14, life: 0.6, shape: 'puff' });
        game.ui.msg('You put your shoulder to the dresser and shove it along the wall, the crockery rattling. Behind it, low down, a little round door.', '#e8d8b0', true);
        return true;
      }
      game.ui.msg('A dresser, heavy. There\'s no room to push it along.', '#d8c8a0');
      return true;
    }
    // The pantry's little door: open, once the dresser's off it.
    case 'wr_smalldoor': {
      const p = (run.data.pantries || []).find((q) => q.door.x === x && q.door.z === z);
      const front = p && (S.moved[k2(p.dresser.x, p.dresser.z)] ? null : p.dresser);
      if (front && w.getBlock(front.x, FY, front.z) === B.wr_dresser) {
        game.ui.msg('A little round door, but the dresser\'s in front of it.', '#d8c8a0');
        return true;
      }
      for (const yy of [FY, FY + 1]) if (w.getBlock(x, yy, z) === B.wr_smalldoor) w.setBlock(x, yy, z, B.air);
      if (p) S.opened[k2(x, z)] = true;
      game.audio?.play('creak', { x, z });
      game.lightDirty = true;
      game.ui.msg('The little door swings in on the pantry: the good jam, and what else the family kept where the children couldn\'t get at it.', '#e8d8b0', true);
      return true;
    }
    // The stopper: its warning read; then dug out.
    case 'wr_stopper': {
      const kk = k2(x, z);
      if (!S.warned[kk]) {
        S.warned[kk] = true;
        game.ui.openSign(['STOPPED.', 'DO NOT DIG.', 'By order of the Moot. Whatever is in there, leave it there.'], 'A Board, Nailed Up');
        return true;
      }
      for (const yy of [FY, FY + 1]) if (w.getBlock(x, yy, z) === B.wr_stopper) w.setBlock(x, yy, z, B.air);
      if ((run.data.stoppers || []).some((q) => q.x === x && q.z === z)) S.dug[kk] = true;
      game.renderer.emit(x, FY + 1, z, { n: 30, color: ['#7c5c3c', '#523c28', '#a49e94'], up: 30, speed: 40, gravity: 140, life: 1 });
      game.audio?.play('crumble', { x, z });
      game.shake = Math.min(1, (game.shake || 0) + 0.3);
      game.lightDirty = true;
      game.ui.msg('You tear the board down and dig the heaped earth out, stone by stone. Behind it, the old cell the Hollowfolk stopped up. (Everything under the floor heard that.)', '#e8d8b0', true);
      noise(run, { x, z }, 10, game.player);
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------ the pods
// A pod gone dark under a moth.
export function snuff(run, q, by = null) {
  const game = run.game;
  const w = game.world;
  if (w.getBlock(q.x, FY, q.z) !== B.wr_pod || !w.getState(q.x, FY, q.z)) return false;
  w.setState(q.x, FY, q.z, false);
  const S = mine(run);
  S.dark[k2(q.x, q.z)] = true;
  delete S.lit[k2(q.x, q.z)];
  game.lightDirty = true;
  game.renderer.emit(q.x, FY + 1.6, q.z, { n: 12, color: ['#8a7a5a', '#b0a080', '#d0c4a0'], up: 6, speed: 8, gravity: -3, life: 1.2, shape: 'puff' });
  const T = wrT(run);
  if (!T.told.snuff && game.everyone().some((p) => p && !p.dead && dist(p, q) <= 12)) {
    T.told.snuff = true;
    game.ui.msg('A great dun moth settles on a lantern pod, and the pod goes dark under its wings. (Rub a dark pod and it glows again; the tunnelers don\'t need the light.)', '#d8c8a0', true);
  }
  void by;
  return true;
}

// ------------------------------------------------------------ the noise
// A noise at (x, z): everything that listens, that far, hears it and comes.
export function noise(run, at, r, who = null) {
  let n = 0;
  for (const c of run.creatures()) {
    if (c.dead || c.waiting || !HEARS.has(c.species) || dist(c, at) > r) continue;
    if (c.dormant) run.wake?.(c);
    if (who && !who.dead) c.target = who;
    n++;
  }
  return n;
}

// ------------------------------------------------------------ the floor
// Cracked earth gives way: the tile falls in (a pit, a step down), and
// whatever was on it with it, hurt; and in it, now and then, what the old
// diggers left.
export function give(run, q, quiet) {
  const game = run.game;
  const w = game.world;
  w.setBlock(q.x, FY - 1, q.z, B.air);
  w.setBlock(q.x, FY - 2, q.z, B.wr_pitbed);
  if (quiet) return;
  mine(run).fallen[k2(q.x, q.z)] = true;
  const r = game.renderer;
  r.emit(q.x, FY, q.z, { n: 26, color: ['#7c5c3c', '#523c28', '#3e2e20'], up: 20, speed: 30, gravity: 120, life: 0.9 });
  game.audio?.play('crumble', q);
  game.shake = Math.min(1, (game.shake || 0) + 0.35);
  for (const e of [...game.everyone(), ...game.creatures]) {
    if (!e || e.dead || e.x !== q.x || e.z !== q.z || e.y !== FY || (e.S && e.S.floats)) continue;
    game.moveEntity?.(e, q.x, FY - 1, q.z);
    e.teleport?.(q.x, FY - 1, q.z);
    game.damage(e, 3, null);
    e.stunT = Math.max(e.stunT || 0, 0.6);
    r.floatText(q.x, FY + 1.6, q.z, 'the floor gives way!', '#e0c090');
  }
  if (q.cache) {
    for (const [item, n] of [['lantern_pod', 2], ['gold_ore', 1], ['old_coin', 4]]) game.spawnDrop?.(item, n, q.x + 0.5, FY - 0.5, q.z + 0.5, true);
    r.floatText(q.x, FY + 2.2, q.z, 'something glints in the fallen earth', '#ffe0a0');
  }
  const T = wrT(run);
  if (!T.told.give) {
    T.told.give = true;
    game.ui.msg('The cracked earth gives way under you, and you go down with it into the hollow beneath. (Mind the cracked places: the floor here is hollow.)', '#e0c090', true);
  }
  // (Everything under the floor heard that.)
  noise(run, q, 7, game.everyone().find((p) => p && !p.dead && dist(p, q) <= 2) || null);
}

// ------------------------------------------------------------ each step
export function tick(run, dt, party = null) {
  if (!isWarren(run)) return;
  const game = run.game;
  const w = game.world;
  const T = wrT(run);
  const r = game.renderer;
  const who = (party || [game.player]).filter((p) => p && !p.dead);
  const mobs = run.creatures();
  // Footfalls: a step onto loud ground is heard.
  for (const p of who) {
    const k = k2(p.x, p.z);
    const was = T.last.get(p);
    T.last.set(p, k);
    T.noiseT.set(p, Math.max(0, (T.noiseT.get(p) || 0) - dt));
    if (!was || was === k || p.y !== FY) continue;
    const loud = LOUD.get(w.getBlock(p.x, FY - 1, p.z));
    if (!loud || T.noiseT.get(p) > 0) continue;
    T.noiseT.set(p, 0.7);
    const n = noise(run, p, loud, p);
    r.emit(p.x, FY + 0.1, p.z, { n: 3, color: ['#8a847a', '#b0a89c'], up: 4, speed: 6, life: 0.4 });
    if (!T.told.loud) {
      T.told.loud = true;
      r.floatText(p.x, p.y + 2.4, p.z, w.getBlock(p.x, FY - 1, p.z) === B.wr_boards ? 'creak' : 'crunch', '#d8d0c0');
      game.ui.msg(`Your step ${w.getBlock(p.x, FY - 1, p.z) === B.wr_boards ? 'creaks on the boards' : 'crunches on the scree'}, loud in the quiet. ${n ? 'Somewhere under the floor, something stops digging, and turns toward you.' : 'Down here, things listen.'} (Keep to the moss and the loam: they're quiet.)`, '#d8d0c0', true);
    }
  }
  // The hollow floor: stood on a moment, it goes.
  for (const q of run.data.cracks || []) {
    const kk = k2(q.x, q.z);
    if (mine(run).fallen[kk]) continue;
    const on = [...who, ...mobs].some((e) => e && !e.dead && e.x === q.x && e.z === q.z && e.y === FY && !(e.S && e.S.floats));
    const t = on ? (T.on.get(kk) || 0) + dt : 0;
    T.on.set(kk, t);
    if (on && t > 0.05 && t - dt <= 0.05) r.emit(q.x, FY + 0.1, q.z, { n: 6, color: ['#523c28', '#3e2e20'], up: 6, speed: 8, life: 0.4 });
    if (t >= GIVE_AFTER) give(run, q, false);
  }
  // The tunnelers stop for the grubs.
  const grubs = mobs.filter((c) => !c.dead && c.species === 'larder_grub');
  if (grubs.length) {
    for (const c of mobs) {
      if (c.dead || c.species !== 'tunneler' || c.dormant || c.feedT > 0 || c.burrowed) continue;
      const g = grubs.find((q) => !q.dead && dist(q, c) <= 1 && Math.abs(q.y - c.y) <= 1);
      if (!g) continue;
      feed(run, c, g);
    }
  }
}
// A tunneler eats a grub: mended, and busy at it a moment.
export function feed(run, c, g) {
  const game = run.game;
  game.damage(g, 99, c);
  c.hp = c.maxHp;
  c.feedT = 2;
  c.face(g.x, g.z);
  game.renderer.emit(g.x, g.y + 0.4, g.z, { n: 12, color: ['#e8e0c8', '#c8b890', '#a0c060'], up: 10, speed: 12, life: 0.6 });
  game.renderer.floatText(c.x, c.y + 2.2, c.z, 'it stops to eat a grub', '#e0d0a0');
  game.audio?.play('bite', c);
  const T = wrT(run);
  if (!T.told.feed) {
    T.told.feed = true;
    game.ui.msg('The tunneler stops dead, snuffles, and gulps down a larder grub whole: and its wounds close over. (Mind the grubs; or use them.)', '#e0d0a0', true);
  }
}
