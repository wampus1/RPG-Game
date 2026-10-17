// (Round 108) The Hollow Hill at work (laid out by world/deeps/mound.js):
// the hill-doors (each has its twin somewhere else in the hill: in at one,
// out of the other); the feast (it mends every hurt you have, and then you
// can't stop eating, and the court wakes up); the ring (step in it and
// you're taken dancing round it, and thrown out dizzy: kick its
// toadstools over and it's only grass); the standing stones (woken in the
// trees' order, birch, rowan, alder, willow, ash, they roll back the
// cairn's slab; touched out of order, they all go dark, and something
// laughs); the golden harp (played, the fair folk stop to listen, and
// forget what they were doing); the fey lanterns (the wisps drink them
// dark; the hob lights them again); the offering (food left there, and the
// hob leaves something back); and the hob struck (the hill remembers).
//
// What's been done (the caps kicked, the rings broken, the stones woken,
// the slabs rolled back, the feasts eaten, the lanterns as they were left,
// the offerings) is kept in the floor's state, and put back when the
// floor's made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { TREES } from '../world/deeps/moundlore.js';
import { removeItem } from './inventory.js';

const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.mound ||= { kicked: {}, broken: {}, woke: {}, opened: {}, eaten: {}, dark: {}, given: {}, blessed: false, cursed: false });
// What's going on about the floor this visit (not saved).
export const mdT = (run) => (run.moundT ||= { told: {}, dance: new Map(), free: new Map(), feastAsk: null, harpT: 0, doorT: 0, drink: new Map(), lanterns: run.data.lanterns || [] });
const isMound = (run) => run && run.rec && run.rec.type === 'mound';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
// The fair folk (who stop for the harp).
export const FAIR = new Set(['fey_knight', 'wisp', 'witch_hare', 'changeling', 'grave_raven']);
const FEY = ['#d8c0ff', '#a080e0', '#ffffff', '#80ffd0'];
// How long the dance lasts, and a step of it.
export const DANCE = 3.2;
const DANCE_STEP = 0.24;
// How long the harp's tune holds them, and how long before it can be
// played again.
export const HARP_HOLD = 9;
export const HARP_CD = 35;

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isMound(run)) return;
  const w = run.game.world;
  const S = mine(run);
  (run.data.rings || []).forEach((g, i) => {
    for (const c of g.caps) if (S.kicked[k2(c.x, c.z)]) w.setState(c.x, FY, c.z, true);
    if (S.broken[i]) breakRing(run, g, true);
  });
  (run.data.circles || []).forEach((q, i) => {
    const n = S.woke[i] || 0;
    for (const s of q.stones) w.setState(s.x, FY + 1, s.z, S.opened[i] || s.kind < n);
    if (S.opened[i]) for (const y of [FY, FY + 1]) w.setBlock(q.slab.x, y, q.slab.z, B.air);
  });
  for (const q of run.data.lanterns || []) if (S.dark[k2(q.x, q.z)] !== undefined) w.setState(q.x, FY, q.z, !S.dark[k2(q.x, q.z)]);
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'hh_cairn': return 'A cairn of white stones, each one carried here by somebody.';
    case 'hh_basin': return 'A stone basin, its bottom worn smooth. Something was ground in it.';
    case 'hh_bench': return 'A bench of birch-wood, still with its bark on.';
    case 'hh_offering': return 'A bowl on a flat stone, for the good neighbours. (Leave them something to eat, with food in your hand.)';
    case 'hh_bones': return 'Bones, garlanded with flowers that haven\'t wilted.';
    case 'hh_piper': return 'An old man asleep against the wall, his pipes in his lap, his beard to his knees. He won\'t wake.';
    case 'hh_throne': return 'A throne of living wood, the antlers of it still growing.';
    default: return null;
  }
}
export function interact(run, x, y, z, b) {
  if (!isMound(run)) return false;
  const game = run.game;
  const w = game.world;
  const p = game.player;
  const S = mine(run);
  const T = mdT(run);
  switch (b.interact) {
    // A door in the hill: in at it, and out of its twin.
    case 'hh_hilldoor': {
      const i = (run.data.hilldoors || []).findIndex((q) => q.x === x && q.z === z);
      const q = run.data.hilldoors?.[i];
      const twin = q && run.data.hilldoors[q.to];
      if (!twin) {
        game.ui.msg('A round door of turf and stone, carved in spirals. It doesn\'t open, from this side.', '#d8c0ff');
        return true;
      }
      if (T.doorT > 0) return true;
      T.doorT = 0.8;
      through(run, p, twin);
      if (!T.told.door) {
        T.told.door = true;
        game.ui.msg('You step through the little door, and out of another, somewhere else in the hill. (Every door here has its twin. Walk them till you know them.)', '#d8c0ff', true);
      }
      return true;
    }
    // The cairn's slab: rolled back by the stones.
    case 'hh_slab':
      game.ui.msg('A great slab of stone, ogham cut down its edge: five trees. It won\'t move for you. (Something here moves it.)', '#d8d0c0');
      return true;
    // A standing stone, woken (or not).
    case 'hh_stone': {
      const ci = (run.data.circles || []).findIndex((q) => q.stones.some((s) => s.x === x && s.z === z));
      const q = run.data.circles?.[ci];
      if (!q) {
        game.ui.msg('A standing stone, cut with ogham. It\'s warm.', '#d8d0c0');
        return true;
      }
      wake(run, q, ci, q.stones.find((s) => s.x === x && s.z === z), p);
      return true;
    }
    // A toadstool of the ring, kicked over.
    case 'hh_ringcap': {
      const gi = (run.data.rings || []).findIndex((g) => g.caps.some((c) => c.x === x && c.z === z));
      const g = run.data.rings?.[gi];
      if (w.getState(x, y, z) || !g) {
        game.ui.msg('A toadstool, kicked over. Its gills are pink as a mouth.', '#e0c8d8');
        return true;
      }
      w.setState(x, y, z, true);
      S.kicked[k2(x, z)] = true;
      game.audio?.play('dig', { x, z });
      game.renderer.emit(x, FY + 0.4, z, { n: 10, color: ['#e8d0c0', '#c03030', '#ffffff'], up: 10, speed: 14, life: 0.6 });
      const left = g.caps.filter((c) => !S.kicked[k2(c.x, c.z)]).length;
      // (The ring's own: they don't like it.)
      for (const c of run.creatures()) {
        if (c.dead || c.isBoss || !FAIR.has(c.species) || c.peaceful || dist(c, { x, z }) > 8) continue;
        if (c.dormant) run.wake(c);
        c.target = p;
      }
      if (left > 0) {
        game.renderer.floatText(x, FY + 1.6, z, `${left} more`, '#e0c8d8');
        if (!T.told.cap) {
          T.told.cap = true;
          game.ui.msg('You kick the toadstool over, and somewhere close something shrieks. The ring isn\'t broken yet: there are more of them.', '#e0c8d8', true);
        }
      } else {
        S.broken[gi] = true;
        breakRing(run, g, false);
      }
      return true;
    }
    // The golden harp.
    case 'hh_harp':
      harp(run, x, z, p);
      return true;
    // The feast.
    case 'hh_feast': {
      const fi = (run.data.feasts || []).findIndex((q) => q.tables.some((t) => t.x === x && t.z === z));
      if (S.eaten[fi]) {
        game.ui.msg('Crumbs, and the smell of honey. You\'re hungry again already.', '#f0d890');
        return true;
      }
      if (!T.feastAsk || T.feastAsk.i !== fi || T.feastAsk.t <= 0) {
        T.feastAsk = { i: fi, t: 5 };
        game.ui.msg('The feast: bread still warm, honeycomb, roast apples, cream in a silver jug. It smells better than anything you have ever smelled. (Eat nothing they set before you. Use it again, to eat anyway.)', '#f0d890', true);
        return true;
      }
      T.feastAsk = null;
      eat(run, fi, p);
      return true;
    }
  }
  return false;
}
// (Food left at an offering, with food in hand: see deeps.js's lore.)
export function offer(run, x, y, z, b, p) {
  if (!isMound(run) || b.id !== B.hh_offering) return false;
  const game = run.game;
  const held = p.heldItem?.();
  if (!held || ITEMS[held]?.kind !== 'food') return false;
  const S = mine(run);
  if (S.given[k2(x, z)]) {
    game.ui.msg('Your offering\'s gone: the bowl\'s licked clean.', '#c8e890');
    return true;
  }
  removeItem(p.inv, held, 1);
  S.given[k2(x, z)] = true;
  game.audio?.play('chime', { x, z });
  game.renderer.emit(x, FY + 1, z, { n: 14, color: ['#fff4a0', '#c8f080', '#ffffff'], up: 30, speed: 20, life: 1, glow: true });
  const hob = run.creatures().find((c) => c.species === 'hob' && !c.dead && !c.wronged);
  if (!hob) {
    game.ui.msg(`You leave ${ITEMS[held].name.toLowerCase()} in the bowl. Somewhere in the hill, someone sighs.`, '#c8e890');
    return true;
  }
  const gift = ['heather_bread', 'gem', 'frost_crystal', 'old_coin'][Object.keys(S.given).length % 4];
  game.spawnDrop(gift, gift === 'old_coin' ? 4 : 1, x, FY + 1, z, true);
  S.blessed = true;
  hob.say?.(['The old way. Nobody does the old way.', 'Kind. You\'re kind.', 'For you, for you.'][Math.floor(Math.random() * 3)], 2.4, '#c8e890');
  game.ui.msg(`You leave ${ITEMS[held].name.toLowerCase()} in the bowl. The hob creeps up, sniffs it, and leaves you something in its place. (The hob's luck is on you: the hares' hexes won't mark you.)`, '#c8e890', true);
  return true;
}

// Out of a door's twin.
function through(run, e, twin) {
  const game = run.game;
  game.renderer.emit(e.x, e.y + 1, e.z, { n: 14, color: FEY, up: 20, speed: 20, life: 0.6, glow: true });
  e.teleport(twin.front.x, FY, twin.front.z);
  game.renderer.emit(twin.front.x, FY + 1, twin.front.z, { n: 14, color: FEY, up: 20, speed: 20, life: 0.6, glow: true });
  game.audio?.play('portal', e);
}
// A stone woken (in the trees' order, or not).
function wake(run, q, ci, s, p) {
  const game = run.game;
  const w = game.world;
  const S = mine(run);
  if (S.opened[ci]) {
    game.ui.msg(`The ${TREES[s.kind]}-stone hums under your hand.`, '#d8d0c0');
    return;
  }
  const n = S.woke[ci] || 0;
  if (s.kind < n) {
    game.ui.msg(`The ${TREES[s.kind]}-stone is awake already.`, '#d8d0c0');
    return;
  }
  if (s.kind === n) {
    S.woke[ci] = n + 1;
    w.setState(s.x, FY + 1, s.z, true);
    game.lightDirty = true;
    game.audio?.play('chime', s);
    game.renderer.emit(s.x, FY + 2, s.z, { n: 14, color: ['#a0ffe0', '#ffffff', '#80d0ff'], up: 20, speed: 16, life: 0.8, glow: true });
    game.renderer.floatText(s.x, FY + 3.2, s.z, TREES[s.kind], '#a0ffe0');
    if (n + 1 < 5) return;
    S.opened[ci] = true;
    for (const y of [FY, FY + 1]) w.setBlock(q.slab.x, y, q.slab.z, B.air);
    game.audio?.play('rumble', q.slab);
    game.shake = Math.min(1.2, (game.shake || 0) + 0.5);
    game.renderer.emit(q.slab.x, FY + 1, q.slab.z, { n: 30, color: ['#8a8070', '#5a5040', '#c8c0a8'], up: 40, speed: 50, life: 1.2 });
    game.ui.msg('The fifth stone wakes, and all five sing together, one note. In the wall, the cairn\'s slab grinds back.', '#a0ffe0', true);
    return;
  }
  // Out of order: dark again, all of them; and something laughs.
  S.woke[ci] = 0;
  for (const t of q.stones) w.setState(t.x, FY + 1, t.z, false);
  game.lightDirty = true;
  game.audio?.play('whisper', s);
  game.renderer.emit(s.x, FY + 2, s.z, { n: 16, color: FEY, up: 10, speed: 30, life: 0.6 });
  game.damage(p, 2, null);
  game.renderer.floatText(s.x, FY + 3.2, s.z, 'wrong!', '#e08060');
  game.ui.msg('The stones go dark, all of them, and a shock runs up your arm. Somewhere, something laughs. (They wake in an order. Somebody here knew it.)', '#e08060', true);
  for (const c of run.creatures()) {
    if (c.dead || c.species !== 'witch_hare' || dist(c, s) > 10) continue;
    if (c.dormant) run.wake(c);
    c.target = p;
  }
}
// The ring broken: only grass.
function breakRing(run, g, quiet) {
  const game = run.game;
  const w = game.world;
  for (const t of g.tiles) if (w.getBlock(t.x, FY - 1, t.z) === B.hh_ring) w.setBlock(t.x, FY - 1, t.z, B.hh_heath);
  if (quiet) return;
  game.audio?.play('whisper', g.tiles[0]);
  for (const t of g.tiles) game.renderer.emit(t.x, FY + 0.3, t.z, { n: 3, color: FEY, up: 10, speed: 10, life: 0.8, glow: true });
  game.ui.msg('The last toadstool goes over, and the ring is only grass. A wail, very far off, and then nothing.', '#e0c8d8', true);
}
// The harp played: the fair folk stop, and listen, and forget.
function harp(run, x, z, p) {
  const game = run.game;
  const T = mdT(run);
  if (T.harpT > 0) {
    game.ui.msg('The strings are still trembling from the last tune. (A moment.)', '#f0d890');
    return;
  }
  T.harpT = HARP_CD;
  game.audio?.play('chime', { x, z });
  for (let i = 0; i < 6; i++) game.renderer.emit(x, FY + 1.6, z, { n: 2, color: ['#ffe890', '#ffffff'], up: 20 + i * 4, speed: 12, life: 1.4, glow: true });
  let n = 0;
  for (const c of run.creatures()) {
    if (c.dead || c.isBoss || !FAIR.has(c.species) || dist(c, { x, z }) > 12) continue;
    c.lostT = Math.max(c.lostT || 0, HARP_HOLD);
    c.target = null;
    c.windup = null;
    n++;
    game.renderer.floatText(c.x, c.y + 2.2, c.z, '♪', '#ffe890');
  }
  game.ui.msg(n ? 'You pluck the golden harp, and it plays itself after: a tune you nearly know. The fair folk stop where they are, and listen, and forget what they were about.' : 'You pluck the golden harp, and it plays itself after, to nobody.', '#ffe890', true);
}
// The feast eaten: every hurt mended; and then you can't stop; and the
// court wakes.
function eat(run, fi, p) {
  const game = run.game;
  const S = mine(run);
  const q = run.data.feasts[fi];
  S.eaten[fi] = true;
  p.hp = p.maxHp;
  p.rootT = Math.max(p.rootT || 0, 3);
  game.audio?.play('eat', p);
  game.renderer.emit(p.x, p.y + 1.4, p.z, { n: 18, color: ['#ffe890', '#f0a040', '#ffffff'], up: 20, speed: 14, life: 1, glow: true });
  game.renderer.floatText(p.x, p.y + 2.6, p.z, 'you can\'t stop eating', '#f0d890');
  game.ui.msg('You eat, and it\'s the best thing you have ever eaten, and every hurt you have closes over: and you can\'t stop. When you look up the candles have burned down, and the court is awake, and looking at you.', '#f0d890', true);
  const t0 = q.tables[0];
  for (const c of run.creatures()) {
    if (c.dead || c.isBoss || c.peaceful || dist(c, t0) > 10) continue;
    if (c.dormant) run.wake(c);
    c.target = p;
  }
}
// A lantern lit, or drunk dark.
export function lantern(run, q, on, by = null) {
  const game = run.game;
  game.world.setState(q.x, FY, q.z, on);
  mine(run).dark[k2(q.x, q.z)] = !on;
  game.lightDirty = true;
  game.renderer.emit(q.x, FY + 1.8, q.z, { n: 8, color: on ? ['#ffe890', '#a0ffe0'] : FEY, up: 10, speed: 10, life: 0.6, glow: true });
  if (by && on) game.renderer.floatText(q.x, FY + 2.6, q.z, 'the hob lights it', '#c8e890');
}
// The hob struck: the hill remembers.
export function moundRemembers(run, src) {
  const game = run.game;
  const S = mine(run);
  if (S.cursed) return;
  S.cursed = true;
  game.ui.msg('A sound goes through the hill like a breath drawn in. The hill remembers what you did: the fair folk are coming, all of them, and you are marked.', '#e08060', true);
  game.audio?.play('whisper', src);
  if (src) src.markT = Math.max(src.markT || 0, 20);
  for (const c of run.creatures()) {
    if (c.dead || c.peaceful || c.isBoss) continue;
    if (c.dormant) run.wake(c);
    c.target = src;
  }
}

// (Round 117) The nearest open ground to `p` on no ring (searching out a
// few paces), or null.
function offRing(w, p, onRing) {
  const seen = new Set([k2(p.x, p.z)]);
  let edge = [{ x: p.x, z: p.z }];
  for (let r = 0; r < 6 && edge.length; r++) {
    const next = [];
    for (const q of edge) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = q.x + dx;
        const z = q.z + dz;
        if (seen.has(k2(x, z))) continue;
        seen.add(k2(x, z));
        if (w.stepTarget(q.x, FY, q.z, x, z, false) !== FY) continue;
        if (!onRing(x, z)) return { x, z };
        next.push({ x, z });
      }
    }
    edge = next;
  }
  return null;
}

// ------------------------------------------------------------ each frame
export function tick(run, dt, party = null) {
  if (!isMound(run)) return;
  const game = run.game;
  const w = game.world;
  const T = mdT(run);
  const S = mine(run);
  if (T.harpT > 0) T.harpT -= dt;
  if (T.doorT > 0) T.doorT -= dt;
  if (T.feastAsk) T.feastAsk.t -= dt;
  const who = (party || [game.player]).filter((p) => p && !p.dead);
  // The ring: stepped in, you're taken dancing.
  const rings = run.data.rings || [];
  const onRing = (x, z) => rings.some((g, i) => !S.broken[i] && g.tiles.some((t) => t.x === x && t.z === z));
  for (const p of who) {
    // (Round 117) Let go by a ring, it won't take you again till you've
    // stepped clear of every ring, and a moment after.
    const fr = T.free.get(p);
    if (fr === Infinity) {
      if (!onRing(p.x, p.z)) T.free.set(p, 1.5);
    } else if (fr > 0) T.free.set(p, fr - dt);
    const d = T.dance.get(p);
    if (d) {
      d.t -= dt;
      d.stepT -= dt;
      p.rootT = Math.max(p.rootT || 0, 0.3);
      // (The view held on the ring's middle while you're taken round it,
      // not swung after every step.)
      if (p === game.player) game.ringFocus = d.mid;
      if (d.stepT <= 0 && d.t > 0) {
        d.stepT = DANCE_STEP;
        d.i = (d.i + 1) % d.g.tiles.length;
        const t = d.g.tiles[d.i];
        p.teleport(t.x, FY, t.z);
        if (Math.random() < 0.5) game.renderer.emit(t.x, FY + 0.6, t.z, { n: 3, color: FEY, up: 10, speed: 8, life: 0.6, glow: true });
      }
      if (d.t <= 0) {
        // Out, dizzy, set down off the ring (Round 117: the nearest open
        // ground that's no ring's, however thick the ring: it used to try
        // only the squares next to you, and leave you on the ring to be
        // taken again and again).
        T.dance.delete(p);
        T.free.set(p, Infinity);
        if (p === game.player) game.ringFocus = null;
        p.rootT = 0;
        p.slowT = Math.max(p.slowT || 0, 1.2);
        const out = offRing(w, p, onRing);
        if (out) p.teleport(out.x, FY, out.z);
        game.renderer.floatText(p.x, p.y + 2.4, p.z, 'dizzy', '#d8c0ff');
      }
      continue;
    }
    if (p.y !== FY || T.free.get(p) > 0) continue;
    const gi = rings.findIndex((g, i) => !S.broken[i] && g.tiles.some((t) => t.x === p.x && t.z === p.z));
    if (gi < 0) continue;
    const g = rings[gi];
    const mid = { x: g.tiles.reduce((a, t) => a + t.x, 0) / g.tiles.length, y: FY, z: g.tiles.reduce((a, t) => a + t.z, 0) / g.tiles.length, run };
    T.dance.set(p, { g, i: g.tiles.findIndex((t) => t.x === p.x && t.z === p.z), t: DANCE, stepT: DANCE_STEP, mid });
    game.audio?.play('chime', p);
    game.renderer.floatText(p.x, p.y + 2.4, p.z, 'taken dancing!', '#d8c0ff');
    if (!T.told.ring) {
      T.told.ring = true;
      game.ui.msg('You step into the ring, and the music has you: your feet take you round and round, and you can\'t stop them. (Step in no ring. Or break it: kick over its toadstools.)', '#d8c0ff', true);
    }
  }
  if (game.ringFocus && !T.dance.has(game.player)) game.ringFocus = null;
  // The wisps drink the lanterns dark.
  for (const c of run.creatures()) {
    if (c.dead || c.dormant || c.species !== 'wisp') continue;
    const q = T.lanterns.find((l) => dist(l, c) <= 1 && w.getState(l.x, FY, l.z) && w.getBlock(l.x, FY, l.z) === B.hh_lantern);
    if (!q) {
      T.drink.delete(c);
      continue;
    }
    const t = (T.drink.get(c) || 0) + dt;
    T.drink.set(c, t);
    if (t < 2) continue;
    T.drink.delete(c);
    lantern(run, q, false);
    c.hp = Math.min(c.maxHp || c.hp + 3, c.hp + 3);
    game.renderer.floatText(c.x, c.y + 2, c.z, 'it drinks the light', '#a0ffe0');
    if (!T.told.drink) {
      T.told.drink = true;
      game.ui.msg('The wisp settles on a fey lantern, and drinks it dark, and glows the brighter. (They feed on the lanterns. The hob lights them again, if the hob\'s about.)', '#a0ffe0', true);
    }
  }
}
// (Is the hob's luck on whoever's about?)
export const blessed = (run) => !!(isMound(run) && mine(run).blessed);
