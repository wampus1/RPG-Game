// (Round 97) What the crypt's architect set down (see world/deeps/crypt.js),
// at work:
//   the vigil: while a vigil candle burns, the dead near it sleep (in their
//     tombs, in their niches), and they won't wake for you walking past;
//     the risen, in a burning candle's light, are hushed (slowed, their
//     blows weaker). Snuffed (a mourner's work, or the reliquary taken), a
//     candle's dead get up, and its tombs open. Lit again (a torch or a
//     lantern held to it), it hushes them again.
//   the tombs: open one yourself, and it's grave goods, or its occupant.
//     In the donors' chapel, the right one has the chalice in it (the
//     Register says how its dead is laid); the wrong ones have their dead.
//   the vigil chapel: light every candle in it, and its grille lifts.
//   the cracked flags: step on one (or something heavy does) and it gives
//     way into the water under the floor.
//   the light wells: the dead won't stand in daylight; knocked into it,
//     it burns them.
//   the loose flag: lift it, and there's a hollow under it, and a casket.
//   the reliquary: take the saint's bones, and every candle on the floor
//     goes out, one after another out from where you stand.
//   the bones: where one of the crypt's dead falls, its bones lie a while;
//     a sexton can raise them again (not in candlelight, nor burned).
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';
import { addItem } from './inventory.js';
import { nakedFlame, walkTo } from './minework.js';
import { cryptLore } from '../world/deeps/cryptlore.js';

const key = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const stateOf = (run) => {
  const D = (run.state.deeps ||= { turned: {}, opened: {}, taken: {}, woke: {} });
  return (D.crypt ||= { risen: {}, grilles: {}, flags: {}, relic: false, broken: {} });
};
// The crypt's own dead (the risen hushed by candlelight, kept asleep by it).
const DEAD = new Set(['skeleton', 'ghoul', 'drowned', 'entombed', 'sexton', 'cantor', 'bog_body', 'ash_wraith']);
export const isDead = (c) => !!c && !c.dead && (DEAD.has(c.species) || (c.S && c.S.undead && !c.isBoss));
// A flame held: a torch, or a lantern (its flame's behind glass, but it'll
// light a wick).
export function holdsFlame(p) {
  return !!p && (nakedFlame(p) || (p.equip && p.equip.shield === 'lantern'));
}
const candlesOf = (run) => run.data.candles || [];
const litAt = (game, c) => game.world.getBlock(c.x, c.y ?? FY, c.z) === B.vigil_candle;
// A burning vigil candle within r paces of (x, z) (and at about its
// height), or null.
export function litNear(run, x, z, r = 3, y = null) {
  const game = run.game;
  for (const c of candlesOf(run)) {
    if (dist(c, { x, z }) > r) continue;
    if (y !== null && Math.abs((c.y ?? FY) - y) > 2) continue;
    if (litAt(game, c)) return c;
  }
  return null;
}

// --------------------------------------------------------------- restore
export function restore(run) {
  run.cryptT = { checkT: 0, snuffQ: [], cracking: new Map(), wellT: 0, bones: [], told: new Set() };
  const S = stateOf(run);
  const game = run.game;
  for (const v of run.data.vigils || []) if (S.grilles[key(v.grille.x, v.grille.z)]) game.world.setBlock(v.grille.x, FY, v.grille.z, B.air);
}

// ------------------------------------------------------------- clicked
export function interact(run, x, y, z, b) {
  switch (b.interact) {
    case 'vigil':
      vigil(run, x, y, z, b);
      return true;
    case 'tomb':
      openTomb(run, x, y, z, run.game.player);
      return true;
    case 'loose_flag':
      liftFlag(run, x, z);
      return true;
    case 'reliquary':
      takeRelic(run, x, y, z);
      return true;
  }
  return false;
}

// What's written on something of the crypt's with nothing set down for it.
export const CRYPT_SAY = {
  crypt_altar: 'An altar under a rotted cloth. The gilt lamp on it is green with the damp.',
  saint_statue: 'A saint in stone, holding up a lamp. Somebody has kept the lamp in its hands polished.',
  register_lectern: 'The Register of the dead, swollen with the damp, its pages stuck together.',
  keeper_cot: 'A plank cot and a grey blanket, folded the way the order folded them.',
  grave_board: 'A grave-board, its name weathered off.',
  vigil_candle: 'A vigil candle on its iron pricket. While it burns, they sleep.',
};
export const sayOf = (b) => CRYPT_SAY[b.name] || null;

// ------------------------------------------------------------- the vigil
// A vigil candle clicked: lit, it's only a candle (it keeps its dead
// asleep); out, a flame held to it lights it again.
function vigil(run, x, y, z, b) {
  const game = run.game;
  const p = game.player;
  if (b.id === B.vigil_candle) {
    game.ui.msg('The vigil candle burns. While it burns, the dead near it sleep.', '#e8d8a0');
    return;
  }
  if (!holdsFlame(p)) {
    game.ui.msg('The candle\'s out. You need a flame to light it: a torch, or a lantern.', '#c8c0b0');
    return;
  }
  relight(run, x, y, z, p);
}
export function relight(run, x, y, z, by = null) {
  const game = run.game;
  if (game.world.getBlock(x, y, z) !== B.vigil_out) return false;
  game.world.setBlock(x, y, z, B.vigil_candle);
  game.lightDirty = true;
  game.renderer.emit(x, y + 1.6, z, { n: 8, color: ['#ffe080', '#ffb030'], up: 20, speed: 14, life: 0.5, glow: true });
  game.renderer.floatText(x, y + 2.2, z, 'lit', '#ffe080');
  game.audio?.play('fire', { x, z });
  // (The risen in its light, hushed at once.)
  for (const c of run.creatures()) if (isDead(c) && dist(c, { x, z }) <= 3) hush(game, c, 1.5);
  if (by && by.kind === 'player' && !run.cryptT?.told.has('relight')) {
    run.cryptT?.told.add('relight');
    game.asPlayer?.(by, () => game.ui.msg('In the candle\'s light the dead falter, slow and weak. Keep the lights burning.', '#e8d8a0', true));
  }
  checkVigils(run);
  return true;
}
// A vigil candle put out (by a mourner, by the reliquary going): its dead
// wake, its tombs open.
export function snuff(run, x, y, z, by = null) {
  const game = run.game;
  if (game.world.getBlock(x, y, z) !== B.vigil_candle) return false;
  game.world.setBlock(x, y, z, B.vigil_out);
  game.lightDirty = true;
  game.renderer.emit(x, y + 1.6, z, { n: 8, color: ['#6a6e78', '#8a8e98', '#3a3e48'], up: 16, speed: 6, life: 1.2, shape: 'puff', grow: 1.5 });
  game.renderer.floatText(x, y + 2.2, z, 'the candle gutters out', '#a0a8b8');
  game.audio?.play('puff', { x, z });
  // Its tombs, and those lying still by it with no other light near.
  for (const t of run.data.tombs || []) {
    if (!t.candle || t.candle.x !== x || t.candle.z !== z || t.puzzle) continue;
    if (!litNear(run, t.x, t.z, 4, t.y)) riseFrom(run, t, by);
  }
  for (const c of run.creatures()) {
    if (c.dead || !c.vigil || !c.dormant || c.waiting) continue;
    if (dist(c, { x, z }) > 4 || litNear(run, c.x, c.z, 4)) continue;
    run.wake(c);
    const t = nearestPlayer(game, c, 14);
    if (t) c.target = t;
  }
  return true;
}
const nearestPlayer = (game, c, r) => {
  let best = null;
  for (const p of game.everyone()) {
    if (p.dead) continue;
    const d = dist(p, c);
    if (d <= r && (!best || d < best.d)) best = { d, p };
  }
  return best ? best.p : null;
};
// One of the risen in a burning candle's light: slow, and its blows weak.
function hush(game, c, t = 0.6) {
  c.hushT = Math.max(c.hushT || 0, t);
  c.slowT = Math.max(c.slowT || 0, t);
}
// Every candle in a vigil chapel lit: its grille lifts.
function checkVigils(run) {
  const game = run.game;
  const S = stateOf(run);
  for (const v of run.data.vigils || []) {
    const k = key(v.grille.x, v.grille.z);
    if (S.grilles[k]) continue;
    if (!v.candles.every((c) => game.world.getBlock(c.x, FY, c.z) === B.vigil_candle)) continue;
    S.grilles[k] = true;
    game.world.setBlock(v.grille.x, FY, v.grille.z, B.air);
    game.renderer.emit(v.grille.x, FY + 1, v.grille.z, { n: 14, color: ['#646a76', '#3c3f48', '#9aa2ae'], up: 30, speed: 30, life: 0.7 });
    game.audio?.play('gate', v.grille);
    game.renderer.floatText(v.grille.x, FY + 2.4, v.grille.z, 'the grille lifts', '#e8d8a0');
    game.ui.msg('Every light in the vigil chapel burns, and the iron grille in its wall grinds up into the stone.', '#e8d8a0', true);
  }
}

// ------------------------------------------------------------- the tombs
// Who's in a tomb, up: the lid grinds aside, and they climb out.
function riseFrom(run, t, by = null) {
  const game = run.game;
  const S = stateOf(run);
  const k = key(t.x, t.z);
  if (S.risen[k]) return null;
  S.risen[k] = true;
  const y = t.y ?? FY;
  if (BLOCKS[game.world.getBlock(t.x, y, t.z)].interact === 'tomb') game.world.setBlock(t.x, y, t.z, B.tomb_open);
  game.renderer.emit(t.x, y + 1.2, t.z, { n: 14, color: ['#8a92a0', '#b4bac4', '#2a2e38'], up: 30, speed: 40, life: 0.7 });
  game.renderer.floatText(t.x, y + 2.4, t.z, 'the lid grinds aside', '#b4bac4');
  game.audio?.play('stone', t);
  // Out beside it, where there's room.
  let at = null;
  for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const ny = game.world.findStandY ? game.world.findStandY(t.x + dx, t.z + dz, y) : y;
    if (ny > 0 && Math.abs(ny - y) <= 1) {
      at = { x: t.x + dx, y: ny, z: t.z + dz };
      break;
    }
  }
  if (!at) return null;
  const c = run.spawn(t.species || 'entombed', at.x, at.y, at.z, {});
  if (c) {
    c.risen = true;
    const p = by && by.kind === 'player' ? by : nearestPlayer(game, c, 16);
    if (p) c.target = p;
  }
  return c;
}
// A tomb opened by hand.
export function openTomb(run, x, y, z, p) {
  const game = run.game;
  const t = (run.data.tombs || []).find((q) => q.x === x && q.z === z && (q.y ?? FY) === y);
  const S = stateOf(run);
  if (!t || S.risen[key(x, z)]) {
    game.ui.msg('The tomb\'s lid won\'t shift any further.', '#c8c0b0');
    return;
  }
  // The donors' chapel: the right one gives up its chalice; the wrong ones
  // their dead.
  if (t.puzzle) {
    if (t.right) {
      S.risen[key(x, z)] = true;
      game.world.setBlock(x, y, z, B.tomb_open);
      game.audio?.play('stone', t);
      game.spawnDrop('gilt_chalice', 1, x, y + 1, z, true);
      game.spawnDrop('old_coin', 4 + Math.floor(Math.random() * 6), x, y + 1, z, true);
      if (Math.random() < 0.4) game.spawnDrop('gem', 1, x, y + 1, z, true);
      game.renderer.floatText(x, y + 2.4, z, 'a gilt chalice!', '#ffe080');
      game.ui.msg('The lid slides. Folded hands, a crumbling shroud, and on the breast a gilt chalice, as the Register said.', '#ffe080', true);
      return;
    }
    game.ui.msg('Not this one. Something in it was waiting for the lid to move.', '#d08080', true);
    riseFrom(run, t, p);
    return;
  }
  // Any other: grave goods, or its dead.
  if (Math.random() < 0.5) {
    S.risen[key(x, z)] = true;
    game.world.setBlock(x, y, z, B.tomb_open);
    game.audio?.play('stone', t);
    game.spawnDrop('old_coin', 2 + Math.floor(Math.random() * 6), x, y + 1, z, true);
    if (Math.random() < 0.5) game.spawnDrop('bone', 1, x, y + 1, z, true);
    if (Math.random() < 0.15) game.spawnDrop('gem', 1, x, y + 1, z, true);
    game.renderer.floatText(x, y + 2.4, z, 'grave goods', '#e8d8a0');
  } else riseFrom(run, t, p);
}

// ------------------------------------------------------------- the flag
// The loose flag, lifted: a hollow under it, a casket in it.
function liftFlag(run, x, z) {
  const game = run.game;
  const S = stateOf(run);
  const k = key(x, z);
  if (S.flags[k]) return;
  S.flags[k] = true;
  game.world.setBlock(x, FY, z, B.air);
  game.world.setBlock(x, FY - 1, z, B.chest, 0);
  const tier = (run.rec.level || 1) + run.floor * 0.5;
  const items = [['gilt_chalice', 1], ['old_coin', 6 + Math.floor(Math.random() * 10)], ['gem', 1 + (tier > 2 ? 1 : 0)]];
  const box = game.world.getContainer(x, FY - 1, z);
  if (box) for (const [item, count] of items) addItem(box, item, count);
  game.renderer.emit(x, FY + 0.4, z, { n: 12, color: ['#58606e', '#848d9a', '#2a2e38'], up: 30, speed: 30, life: 0.6 });
  game.audio?.play('stone', { x, z });
  game.ui.msg('You get your fingers in the ring and heave. The flag comes up: a hollow under it, and a little casket hidden there.', '#e8d8a0', true);
  // (The penitent, its walk done, goes.)
  for (const c of run.creatures()) {
    if (c.species !== 'penitent' || c.dead) continue;
    game.renderer.floatText(c.x, c.y + 2.4, c.z, 'thank you', '#c8e0f0');
    game.renderer.emit(c.x, c.y + 1, c.z, { n: 16, color: ['#c8e0f0', '#ffffff'], up: 40, speed: 20, life: 1.2, glow: true });
    c.sporeless = true;
    game.kill(c, null);
  }
}

// ------------------------------------------------------------- the relic
// The saint's bones taken: the vigil goes with them. Every candle on the
// floor gutters, the nearest first.
function takeRelic(run, x, y, z) {
  const game = run.game;
  const S = stateOf(run);
  const p = game.player;
  if (S.relic) return;
  S.relic = true;
  game.world.setBlock(x, y, z, B.air);
  addItem(p.inv, 'saint_relic', 1);
  game.audio?.play('pickup', { x, z });
  game.ui.msg('You lift the casket. It\'s lighter than it should be. Then, all through the crypt, the candles begin to go out.', '#d08080', true);
  game.shake = Math.min(1.2, (game.shake || 0) + 0.4);
  const T = run.cryptT || (restore(run), run.cryptT);
  for (const c of candlesOf(run)) {
    if (!litAt(game, c)) continue;
    T.snuffQ.push({ c, t: 0.6 + dist(c, { x, z }) * 0.12 });
  }
}

// ------------------------------------------------------------- the bones
// One of the crypt's dead fallen: its bones lie a while where it fell (a
// sexton can raise them; not in a burning candle's light).
export function onKill(run, e) {
  if (!run.cryptT || !isDead(e) || e.species === 'sexton' || e.species === 'cantor' || e.species === 'mourner' || e.raisedTwice) return;
  run.cryptT.bones.push({ x: e.x, y: e.y, z: e.z, species: e.species, t: 30, raised: !!e.raised });
}
// Bones a sexton could raise from where it is (the nearest, not already
// spoken for, not in candlelight).
export function bonesFor(run, c, r = 14) {
  let best = null;
  for (const bn of run.cryptT?.bones || []) {
    if (bn.claimed && bn.claimed !== c) continue;
    const d = dist(bn, c);
    if (d > r || litNear(run, bn.x, bn.z, 3, bn.y)) continue;
    if (!best || d < best.d) best = { d, bn };
  }
  return best ? best.bn : null;
}
export function raiseBones(run, bn, by) {
  const game = run.game;
  const T = run.cryptT;
  const i = T.bones.indexOf(bn);
  if (i < 0) return null;
  T.bones.splice(i, 1);
  game.renderer.emit(bn.x, bn.y + 0.6, bn.z, { n: 14, color: ['#d8d0b8', '#8a8270', '#5e5848'], up: 40, speed: 30, life: 0.8 });
  game.renderer.floatText(bn.x, bn.y + 2.2, bn.z, 'the bones get up', '#d8d0b8');
  game.audio?.play('rattle', bn);
  const c = run.spawn(bn.species, bn.x, bn.y, bn.z, {});
  if (c) {
    c.maxHp = c.hp = Math.max(4, Math.round(c.maxHp * 0.6));
    c.raised = true;
    if (bn.raised) c.raisedTwice = true;
    const p = nearestPlayer(game, c, 16);
    if (p) c.target = p;
  }
  return c;
}

// ------------------------------------------------------------- each frame
export function tick(run, dt, party) {
  const game = run.game;
  const data = run.data;
  if (!run.cryptT) restore(run);
  const T = run.cryptT;
  // The candles going out after the reliquary, one after another.
  for (let i = T.snuffQ.length - 1; i >= 0; i--) {
    const q = T.snuffQ[i];
    q.t -= dt;
    if (q.t > 0) continue;
    T.snuffQ.splice(i, 1);
    snuff(run, q.c.x, q.c.y ?? FY, q.c.z, game.player);
  }
  // The hush and the hymn wear off unless kept up.
  for (const c of run.creatures()) {
    if (c.hushT > 0) c.hushT -= dt;
    if (c.hymnT > 0) c.hymnT -= dt;
    if (c.species === 'penitent' && !c.dead) penitent(run, c, dt, party);
  }
  // Bones crumble in time.
  for (let i = T.bones.length - 1; i >= 0; i--) {
    T.bones[i].t -= dt;
    if (T.bones[i].t <= 0) T.bones.splice(i, 1);
  }
  // The cracked flags: trodden on, they give way a moment after.
  for (const f of data.weakFlags || []) {
    const k = key(f.x, f.z);
    if (T.cracking.has(k) || stateOf(run).broken[k]) continue;
    if (game.world.getBlock(f.x, FY - 1, f.z) !== B.crypt_weak) continue;
    const on = [...party, ...run.creatures()].find((e) => e && !e.dead && !(e.S && e.S.floats) && Math.round(e.x) === f.x && Math.round(e.z) === f.z && Math.abs(e.y - FY) < 0.6 && (e.kind === 'player' || (e.S && e.S.heavy)));
    if (!on) continue;
    T.cracking.set(k, { f, t: 0.5 });
    game.audio?.play('crack', f);
    game.renderer.floatText(f.x, FY + 1.8, f.z, 'crack!', '#c8c0b0');
  }
  for (const [k, c] of T.cracking) {
    c.t -= dt;
    if (c.t > 0) continue;
    T.cracking.delete(k);
    breakFlag(run, c.f);
  }
  // Every so often: the vigil's hold on the dead, the daylight's.
  T.checkT -= dt;
  if (T.checkT > 0) return;
  T.checkT = 0.4;
  for (const c of run.creatures()) {
    if (!isDead(c)) continue;
    // Asleep by a burning candle: they won't wake for you walking past
    // (only if you're right on them, or strike them).
    if (c.vigil && c.dormant && !c.waiting) {
      if (c.vigilD === undefined) c.vigilD = Math.max(c.dormant, 2.5);
      c.dormant = litNear(run, c.x, c.z, 4) ? 0.6 : c.vigilD;
    }
    // Up, in a burning candle's light: hushed.
    if (!c.dormant && litNear(run, c.x, c.z, 3, c.y)) hush(game, c);
    // In daylight: it burns, and they get out of it.
    for (const w of data.wells || []) {
      if (Math.hypot(c.x - w.x, c.z - w.z) > (w.r || 2) + 0.3) continue;
      game.damage(c, 2, null);
      // (Out of it, the quickest way.)
      if (!c.moving) c.tryStep(c.x + (Math.sign(c.x - w.x) || 1), c.z + Math.sign(c.z - w.z), c.S.step * 0.6);
      if (Math.random() < 0.35) game.renderer.floatText(c.x, c.y + 2, c.z, 'the daylight burns it', '#fff0c0');
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 4, color: ['#fff0c0', '#ffffff'], up: 20, speed: 10, life: 0.5, glow: true });
    }
  }
}
// ------------------------------------------------------------- the penitent
// From chapel to chapel, kneeling at each, waiting for you to follow; at
// the end of its walk it kneels at the loose flag and stays there.
function penitent(run, c, dt, party) {
  const game = run.game;
  const route = c.route || (run.data.penitent && run.data.penitent.path) || [];
  if (!route.length) return;
  // (Its own walk, never a wander.)
  c.thinkT = 9;
  c.leg ??= 1;
  const near = party.find((p) => !p.dead && dist(p, c) <= 7);
  // A word as you come near (never too often).
  c.sayT = (c.sayT ?? 2) - dt;
  if (near && c.sayT <= 0) {
    c.sayT = 7 + Math.random() * 4;
    const L = (run.cryptT.lore ||= cryptLore(run.rec, run.floor));
    game.renderer.floatText(c.x, c.y + 2.4, c.z, L.murmur(), '#c8e0f0');
  }
  if (c.kneelT > 0) {
    c.kneelT -= dt;
    return;
  }
  const goal = route[Math.min(c.leg, route.length - 1)];
  if (dist(c, goal) <= 1) {
    if (c.leg >= route.length - 1) {
      // (Its walk done: it kneels by the flag, for as long as it's there.)
      c.kneelT = 3;
      if (near) c.face(goal.x, goal.z);
      return;
    }
    c.kneelT = 2.5;
    c.leg++;
    return;
  }
  // Waits for you; then on to the next.
  if (!near) {
    const p = party.find((q) => !q.dead && dist(q, c) <= 16);
    if (p && !c.moving) c.face(p.x, p.z);
    return;
  }
  walkTo(c, goal, 1);
}

// A cracked flag broken through: a hole full of black water where it was.
function breakFlag(run, f) {
  const game = run.game;
  stateOf(run).broken[key(f.x, f.z)] = true;
  game.world.setBlock(f.x, FY - 1, f.z, B.water);
  game.world.setBlock(f.x, FY - 2, f.z, B.crypt_floor);
  game.renderer.emit(f.x, FY, f.z, { n: 16, color: ['#58606e', '#3a4a5a', '#8ab0c8'], up: 30, speed: 40, life: 0.7 });
  game.audio?.play('splash', f);
  for (const e of [...game.everyone(), ...run.creatures()]) {
    if (!e || e.dead || Math.round(e.x) !== f.x || Math.round(e.z) !== f.z) continue;
    game.damage(e, e.kind === 'player' ? 2 : 6, null);
    e.slowT = Math.max(e.slowT || 0, 2);
    if (e.kind !== 'player') e.stunT = Math.max(e.stunT || 0, 2.5);
    if (e.kind === 'player') game.asPlayer?.(e, () => game.ui.msg('The flag gives way under you: black water below, and cold.', '#8ab0c8', true));
    else game.renderer.floatText(e.x, e.y + 2, e.z, 'it goes through the floor!', '#8ab0c8');
  }
}
