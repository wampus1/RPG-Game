// (Round 111) The Hall of the Last Champion at work (laid out by
// world/deeps/champion.js; the old works, the trials, the statues, the
// blades, the tombs, the reliquaries and the arena, are still
// game/ancient.js's): the oath (kneel at his virtues' stones in the order
// of his oath, as the book has it, and the oath-door opens on his cache;
// kneel out of order and the curse bursts out of the stones at you); the
// wards (where one's cracked, the curse grows over the floor round it,
// burning whoever stands on it, and the curselings crawl out of it: kneel
// at a ward and hold it, three breaths, and it seals; seal them all and
// the growth burns away, and every curseling in the room with it); the
// memorials (a coin left at one, and you're remembered: a blessing, once
// a floor); the fallen (a squire or a sentinel or a shade struck down, a
// curseling gets to it, and it gets up again with the curse in it); and
// the keeners (a fight near one, or a tomb broken open, and she wails:
// everything asleep near her wakes).
//
// What's been done (the oath-doors opened, the wards sealed, the
// memorials given to) is kept in the floor's state, and put back when the
// floor's made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';
import { countItem, removeItem } from './inventory.js';
import { VIRTUES } from '../world/deeps/championlore.js';
import { DAY } from '../sim/econ.js';

const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.champion ||= { opened: {}, sealed: {}, given: {}, blessed: false });
// What's going on about the floor this visit (not saved).
export const chT = (run) => (run.champT ||= { told: {}, oath: new Map(), hold: null, burnT: new Map(), spawnT: new Map(), corpses: [], wailT: new Map() });
const isChampion = (run) => run && run.rec && run.rec.type === 'champion';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
const HOLY = ['#fff0b0', '#ffe070', '#ffffff'];
const CURSE = ['#8ad040', '#3a6420', '#d8f080'];
// How long a ward must be held, how often a cracked ward's growth gives up
// a curseling (and how many at most), how long the fallen lie for a
// curseling to find.
export const HOLD = 3;
export const SPAWN_EVERY = 12;
const SPAWN_MAX = 3;
export const CORPSE_LIFE = 20;
// Who can be got up again.
export const RAISE = new Set(['oathbound_squire', 'trial_sentinel', 'shade_archer']);

const tell = (run, k, text, color) => {
  const T = chT(run);
  if (T.told[k]) return;
  T.told[k] = true;
  run.game.ui.msg(text, color, true);
};
function spotNear(run, x, z, r = 2) {
  const game = run.game;
  const w = game.world;
  for (let d = 1; d <= r; d++) {
    for (let dz = -d; dz <= d; dz++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
        const sx = x + dx;
        const sz = z + dz;
        if (BLOCKS[w.getBlock(sx, FY, sz)].solid || BLOCKS[w.getBlock(sx, FY + 1, sz)].solid || !BLOCKS[w.getBlock(sx, FY - 1, sz)].solid) continue;
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

// ------------------------------------------------------------ the oath
function openDoor(run, q, quiet) {
  const game = run.game;
  const w = game.world;
  mine(run).opened[k2(q.door.x, q.door.z)] = true;
  for (const y of [FY, FY + 1]) if (w.getBlock(q.door.x, y, q.door.z) === B.ch_oathdoor) w.setBlock(q.door.x, y, q.door.z, B.air);
  for (const k of q.kneels) if (w.getBlock(k.x, FY, k.z) === B.ch_kneel) w.setState(k.x, FY, k.z, true);
  game.lightDirty = true;
  if (quiet) return;
  game.audio?.play('chime', q.door);
  game.shake = Math.min(1, (game.shake || 0) + 0.3);
  game.renderer.emit(q.door.x, FY + 1.2, q.door.z, { n: 40, color: HOLY, up: 30, speed: 24, life: 1.2, glow: true });
  game.ui.msg('The last stone kindles, and the bronze door of his oath swings in, slow and silent, as if a hand inside had opened it.', '#ffe070', true);
}
function kneel(run, q, k) {
  const game = run.game;
  const w = game.world;
  const T = chT(run);
  const at = T.oath.get(q.room) || 0;
  const want = q.order[at];
  if (k.v === want) {
    w.setState(k.x, FY, k.z, true);
    game.lightDirty = true;
    T.oath.set(q.room, at + 1);
    game.audio?.play('chime', k);
    game.renderer.emit(k.x, FY + 1, k.z, { n: 14, color: HOLY, up: 16, speed: 10, life: 0.8, glow: true });
    game.renderer.floatText(k.x, FY + 1.8, k.z, VIRTUES[k.v].name, '#ffe070');
    if (at + 1 >= q.order.length) openDoor(run, q, false);
    else tell(run, 'kneel', `You kneel at the stone of ${VIRTUES[k.v].name}, and its sign kindles gold. (The others, in the order of his oath.)`, '#ffe070');
    return;
  }
  // Out of order: the curse bursts out of the stones.
  T.oath.set(q.room, 0);
  for (const s of q.kneels) if (w.getBlock(s.x, FY, s.z) === B.ch_kneel) w.setState(s.x, FY, s.z, false);
  game.lightDirty = true;
  game.audio?.play('growl', k);
  game.renderer.emit(k.x, FY + 1, k.z, { n: 24, color: CURSE, up: 18, speed: 20, life: 0.9 });
  game.damage(game.player, 3, null);
  for (let i = 0; i < 2; i++) {
    const c = call(run, 'curseling', k, 2);
    if (c) c.target = game.player;
  }
  game.ui.msg(`You kneel at the stone of ${VIRTUES[k.v].name}, and it is the wrong one: the lit stones go dark, and the curse bursts up out of the cracks between them. (His oath is in the book.)`, '#a0d060', true);
}

// ------------------------------------------------------------ the wards
// Every ward of a group sealed: the growth burns away, and its curselings.
function sealAll(run, g, quiet) {
  const game = run.game;
  const w = game.world;
  for (const t of g.tiles) if (w.getBlock(t.x, FY - 1, t.z) === B.ch_cursed) w.setBlock(t.x, FY - 1, t.z, B.ch_cracked);
  for (const t of g.tiles) if (w.getBlock(t.x, FY, t.z) === B.ch_growth) w.setBlock(t.x, FY, t.z, B.air);
  g.cleansed = true;
  if (quiet) return;
  for (const c of run.creatures()) {
    if (c.dead || c.species !== 'curseling' || !g.tiles.some((t) => dist(t, c) <= 3)) continue;
    game.renderer.emit(c.x, c.y + 0.6, c.z, { n: 10, color: HOLY, up: 14, speed: 10, life: 0.6, glow: true });
    game.damage(c, c.hp + 99, null);
  }
  game.audio?.play('chime', g.src);
  game.renderer.emit(g.src.x, FY + 1, g.src.z, { n: 40, color: HOLY, up: 30, speed: 30, life: 1.2, glow: true });
  game.ui.msg('The last ward closes, and the light of the seals runs together over the floor: the growth shrivels and burns away, and the curselings with it.', '#fff0b0', true);
}
function sealWard(run, g, q) {
  const game = run.game;
  game.world.setState(q.x, FY, q.z, true);
  game.lightDirty = true;
  mine(run).sealed[k2(q.x, q.z)] = true;
  q.sealed = true;
  game.audio?.play('chime', q);
  game.renderer.emit(q.x, FY + 1.2, q.z, { n: 20, color: HOLY, up: 20, speed: 14, life: 0.9, glow: true });
  if (g.wards.every((x) => game.world.getState(x.x, FY, x.z))) sealAll(run, g, false);
  else game.ui.msg('The ward closes under your hands, the seal in it shining. (The others still leak.)', '#fff0b0', true);
}
const groupOf = (run, x, z) => (run.data.wards || []).find((g) => g.wards.some((q) => q.x === x && q.z === z));
const onCurse = (run, e) => run.game.world.getBlock(e.x, FY - 1, e.z) === B.ch_cursed;

// ------------------------------------------------------------ the fallen
// One struck down got up again, the curse in it.
export function raiseCursed(run, corpse, by) {
  const game = run.game;
  const s = spotNear(run, corpse.x, corpse.z, 1) || corpse;
  const c = run.spawn(corpse.species, s.x, FY, s.z, {});
  if (!c) return null;
  c.dormant = 0;
  c.cursed = true;
  c.dmgMult = (c.dmgMult || 1) * 1.3;
  c.maxHp = c.hp = Math.round(c.maxHp * 1.2);
  c.target = game.player;
  corpse.taken = true;
  if (by) {
    by.dead = true;
    game.removeOcc?.(by);
  }
  game.audio?.play('growl', s);
  game.renderer.emit(s.x, FY + 0.6, s.z, { n: 20, color: CURSE, up: 16, speed: 14, life: 0.8 });
  game.renderer.floatText(s.x, FY + 2.2, s.z, 'it gets up again', '#a0d060');
  tell(run, 'raise', 'The curseling crawls into the fallen and they get up again, green light in the joints of their armour. (Kill the curselings before they reach the dead.)', '#a0d060');
  return c;
}
export function onKill(run, e) {
  if (!isChampion(run) || !e || !RAISE.has(e.species) || e.cursed) return;
  chT(run).corpses.push({ x: e.x, z: e.z, species: e.species, t: CORPSE_LIFE });
}
// The fallen a curseling could get to, near it.
export function corpseNear(run, c, r = 8) {
  let best = null;
  for (const q of chT(run).corpses) {
    if (q.taken || q.t <= 0 || dist(q, c) > r) continue;
    if (!best || dist(q, c) < dist(best, c)) best = q;
  }
  return best;
}

// ------------------------------------------------------------ the keeners
function wail(run, m) {
  const game = run.game;
  const T = chT(run);
  if ((T.wailT.get(m) || 0) > 0) return;
  T.wailT.set(m, 30);
  game.renderer.floatText(m.x, m.y + 2.2, m.z, 'she WAILS', '#d0d8e8');
  game.renderer.emit(m.x, m.y + 1.6, m.z, { n: 16, color: ['#d0d8e8', '#8a90a0'], up: 12, speed: 20, life: 1 });
  game.audio?.play('whisper', m);
  let n = 0;
  for (const c of run.creatures()) {
    if (c.dead || c === m || !c.dormant || dist(c, m) > 12 || c.S?.mode === 'passive') continue;
    run.wake(c);
    c.target = game.player;
    n++;
  }
  tell(run, 'wail', `The keener throws back her veil and wails, a sound like the wind in a chimney, and all through the hall what was sleeping wakes.${n ? '' : ' (There was nothing to wake, this time.)'} (She can't bear a fight near the dead, nor a grave broken.)`, '#d0d8e8');
}
// A grave broken open, or a chest of the dead's: the keeners near know.
export function desecrated(run, at) {
  if (!isChampion(run)) return;
  for (const m of run.creatures()) if (!m.dead && m.species === 'keener' && dist(m, at) <= 8) wail(run, m);
}

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isChampion(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const q of run.data.oaths || []) if (S.opened[k2(q.door.x, q.door.z)]) openDoor(run, q, true);
  for (const g of run.data.wards || []) {
    for (const q of g.wards) if (S.sealed[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, true);
    if (g.wards.every((q) => w.getState(q.x, FY, q.z))) sealAll(run, g, true);
  }
  for (const m of run.data.memorials || []) for (const q of m.list) if (S.given[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, true);
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'ch_plaque': return 'A plaque of bronze, the names on it worn smooth by fingers.';
    case 'ch_lectern': return 'A great book on an oak lectern, its pages stuck together with damp.';
    case 'ch_fallen': return 'A man-at-arms, fallen where he stood. His hand is empty.';
    default: return null;
  }
}
export function interact(run, x, y, z, b) {
  if (!isChampion(run)) return false;
  const game = run.game;
  const w = game.world;
  const p = game.player;
  const S = mine(run);
  const T = chT(run);
  switch (b.interact) {
    case 'ch_kneel': {
      const q = (run.data.oaths || []).find((o) => o.kneels.some((k) => k.x === x && k.z === z));
      const v = w.getMeta(x, y, z) & 3;
      if (!q) {
        game.ui.msg(`A kneeling-stone, worn hollow, ${VIRTUES[v].sign} cut in it: ${VIRTUES[v].name}.`, '#e8d8b0');
        return true;
      }
      if (S.opened[k2(q.door.x, q.door.z)]) {
        game.ui.msg(`The stone of ${VIRTUES[v].name}, its sign still lit. His oath is kept.`, '#ffe070');
        return true;
      }
      if (w.getState(x, y, z)) {
        game.ui.msg(`The stone of ${VIRTUES[v].name}, its sign lit. (Now the next, in the order of his oath.)`, '#ffe070');
        return true;
      }
      kneel(run, q, q.kneels.find((k) => k.x === x && k.z === z));
      return true;
    }
    case 'ch_oathdoor':
      game.ui.msg('A door of bronze, two leaves, the sun of his order across them and five studs round it. No handle, no keyhole. (The stones before it: kneel to his virtues, as he swore them.)', '#e8c878', true);
      return true;
    case 'ch_ward': {
      const g = groupOf(run, x, z);
      if (w.getState(x, y, z)) {
        game.ui.msg('A ward-stone, its seal shining white-gold. It holds.', '#fff0b0');
        return true;
      }
      if (!g) {
        game.ui.msg('A ward-stone, cracked, the curse seeping out of the crack.', '#a0d060');
        return true;
      }
      if (T.hold && T.hold.q.x === x && T.hold.q.z === z) return true;
      T.hold = { g, q: g.wards.find((q) => q.x === x && q.z === z), t: 0, at: { x: p.x, z: p.z } };
      game.audio?.play('chime', { x, y, z });
      game.ui.msg('You kneel at the cracked ward and lay your hands on it, and begin the words... (Hold still by it: three breaths.)', '#fff0b0', true);
      // (What's come through doesn't want it closed.)
      for (let i = 0; i < 2; i++) {
        const c = call(run, 'curseling', g.src, 2);
        if (c) c.target = p;
      }
      return true;
    }
    case 'ch_memorial': {
      const m = (run.data.memorials || []).flatMap((g) => g.list).find((q) => q.x === x && q.z === z);
      const L = m && m.lore;
      if (L) game.ui.msg(`${L.title}: ${L.lines.join(' ')}`, '#e8d8b0', true);
      if (w.getState(x, y, z)) return true;
      const coin = countItem(p.inv, 'coin') > 0 ? 'coin' : countItem(p.inv, 'old_coin') > 0 ? 'old_coin' : null;
      if (!coin) {
        if (!L) game.ui.msg('A memorial stone, the folk\'s flowers at its foot. (They leave a coin, for the dead.)', '#e8d8b0');
        return true;
      }
      removeItem(p.inv, coin, 1);
      w.setState(x, y, z, true);
      S.given[k2(x, z)] = true;
      game.audio?.play('coin', { x, y, z });
      if (!S.blessed) {
        S.blessed = true;
        const now = game.day * DAY + game.minute;
        p.buffs = (p.buffs || []).filter((q) => q.stat !== 'end' || q.name !== 'Remembered');
        p.buffs.push({ stat: 'end', n: 2, until: now + 180, name: 'Remembered' });
        game.renderer.emit(p.x, p.y + 1.2, p.z, { n: 20, color: HOLY, up: 18, speed: 10, life: 1, glow: true });
        game.ui.msg('You leave a coin at the foot of the stone, and light the candle there. Something like a hand rests on your shoulder a moment: you are remembered. (Endurance +2, a while.)', '#fff0b0', true);
      } else game.ui.msg('You leave a coin at the foot of the stone, and light the candle there.', '#e8d8b0');
      return true;
    }
    default: return false;
  }
}

// ------------------------------------------------------------ each frame
export function tick(run, dt, party = null) {
  if (!isChampion(run)) return;
  const game = run.game;
  const T = chT(run);
  const who = (party || [game.player]).filter((p) => p && !p.dead);
  if (!who.length) return;
  const p0 = game.player;
  const mobs = run.creatures();
  // A ward held: three breaths, still by it.
  if (T.hold) {
    const H = T.hold;
    if (p0.dead || dist(p0, H.q) > 1 || dist(p0, H.at) > 0) {
      T.hold = null;
      game.ui.msg('You move, and the words break off. The ward is still cracked.', '#a0d060');
    } else {
      H.t += dt;
      if (Math.random() < dt * 10) game.renderer.emit(H.q.x, FY + 1.2, H.q.z, { n: 1, color: HOLY, up: 8, speed: 4, life: 0.6, glow: true });
      if (H.t >= HOLD) {
        T.hold = null;
        sealWard(run, H.g, H.q);
      }
    }
  }
  // The growth of the wards still cracked: it burns whoever stands on it;
  // it gives up a curseling now and then while you're near.
  for (const g of run.data.wards || []) {
    if (g.cleansed || !who.some((p) => dist(p, g.src) <= 10)) continue;
    const st = (T.spawnT.get(g) ?? SPAWN_EVERY * 0.6) - dt;
    if (st <= 0) {
      const alive = mobs.filter((c) => !c.dead && c.species === 'curseling' && dist(c, g.src) <= 8).length;
      if (alive < SPAWN_MAX) {
        const c = call(run, 'curseling', g.src, 2);
        if (c) {
          c.target = p0;
          game.renderer.emit(c.x, FY + 0.5, c.z, { n: 10, color: CURSE, up: 10, speed: 10, life: 0.6 });
        }
      }
      T.spawnT.set(g, SPAWN_EVERY);
    } else T.spawnT.set(g, st);
  }
  for (const p of who) {
    if (!onCurse(run, p) || p.rollT > 0) continue;
    const bt = (T.burnT.get(p) || 0) - dt;
    if (bt > 0) {
      T.burnT.set(p, bt);
      continue;
    }
    T.burnT.set(p, 1.4);
    game.damage(p, 1, null);
    game.renderer.emit(p.x, p.y + 0.3, p.z, { n: 4, color: CURSE, up: 8, speed: 6, life: 0.5 });
    tell(run, 'burn', 'The growth burns where it touches you, a cold green burn. (Keep off it; seal the wards and it goes.)', '#a0d060');
  }
  // The fallen: lying a while for a curseling to find.
  for (const q of T.corpses) q.t -= dt;
  T.corpses = T.corpses.filter((q) => q.t > 0 && !q.taken);
  // The keeners: a fight near one and she wails.
  for (const m of mobs) {
    if (m.dead || m.species !== 'keener') continue;
    const wt = (T.wailT.get(m) || 0) - dt;
    T.wailT.set(m, wt);
    if (wt > 0) continue;
    const fight = mobs.some((c) => !c.dead && !c.dormant && c !== m && c.S?.mode === 'hostile' && c.target && dist(c, m) <= 5 && dist(c.target, m) <= 6);
    if (fight) wail(run, m);
    else if (Math.random() < dt * 0.15) game.renderer.floatText(m.x, m.y + 2, m.z, ['...', 'she weeps', 'a name, whispered'][Math.floor(Math.random() * 3)], '#a8b0c0');
  }
}
