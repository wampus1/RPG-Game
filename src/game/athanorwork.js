// (Round 110) The Athanor at work (laid out by world/deeps/athanor.js;
// the old works, the circles and stills and quicksilver pools, are still
// game/ancient.js's): the speculum (the sun-lamp's beam, thrown by its
// mirrors, each turned by hand one way or the other: laid on the seal,
// the sanctum opens; and it scorches whoever stands in it); the
// transmutation table (lead or iron laid in its circle comes up gold, but
// the Work sees, and its adepts come); the great athanor (fed coal or
// sulphur, it burns, and its egg ripens in the heat: the imps come to its
// fire and eat it, so keep them off; ripe, it gives up the Red Tincture);
// the vats (smashed, what's in them climbs out; their tender's death
// breaks them all); and the quicksilver the adepts call up under you (it
// drags at you, it mends the homunculi, and an imp's fire turns it to a
// poison fume that chokes anyone in it, adepts and all).
//
// What's been done (the mirrors as they were left, the seals opened, the
// tables used, the eggs taken, the vats broken) is kept in the floor's
// state, and put back when the floor's made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS, META_ROT } from '../world/blocks.js';
import { addItem, countItem, removeItem } from './inventory.js';
import { addZone } from '../entities/monsters.js';
import { mirrorTurn } from '../world/deeps/athanor.js';

const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.athanor ||= { turns: {}, opened: {}, gold: {}, ripe: {}, broken: {} });
// What's going on about the floor this visit (not saved).
export const anT = (run) => (run.athT ||= { told: {}, beams: new Map(), scorchT: new Map(), fires: new Map(), tendT: new Map(), mendT: 0 });
const isAthanor = (run) => run && run.rec && run.rec.type === 'athanor';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
const SUN = ['#fff8d0', '#ffe070', '#ffffff'];
const SILVER = ['#e8e8f0', '#a8a8b8', '#ffffff'];
const FUME = ['#c8d070', '#a0a840', '#e0e8a0'];
// How long the athanor's egg must burn to ripen (seconds by it), and how
// often the imps come to its fire.
export const RIPEN = 30;
export const IMP_EVERY = 7;
const IMPS_MAX = 3;
// How long the adepts' quicksilver lies, and how a beam scorches.
export const QUICK_LIFE = 7;
const SCORCH = 0.6;

// A free spot to stand near (x, z), or null.
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
function call(run, species, at, r = 2) {
  const s = spotNear(run, at.x, at.z, r);
  if (!s) return null;
  const c = run.spawn(species, s.x, FY, s.z, {});
  if (c) c.dormant = 0;
  return c;
}
const tell = (run, k, text, color) => {
  const T = anT(run);
  if (T.told[k]) return;
  T.told[k] = true;
  run.game.ui.msg(text, color, true);
};

// ------------------------------------------------------------ the speculum
// A mirror's turn: `/` (0) or `\` (1).
const turnOf = (w, m) => w.getMeta(m.x, FY, m.z) & 1;
// The beam from the lamp: where it goes, which mirrors it lights, and
// whether it's laid on the seal.
export function trace(run, q) {
  const w = run.game.world;
  const tiles = [];
  const lit = new Set();
  let at = { x: q.lamp.x, z: q.lamp.z };
  let d = { ...q.lamp.dir };
  let onSeal = false;
  for (let k = 0; k < 48; k++) {
    at = { x: at.x + d.x, z: at.z + d.z };
    const id = w.getBlock(at.x, FY, at.z);
    if (id === B.an_mirror) {
      const i = q.mirrors.findIndex((m) => m.x === at.x && m.z === at.z);
      if (i < 0 || lit.has(i)) break;
      lit.add(i);
      tiles.push({ ...at, mirror: true });
      d = mirrorTurn(turnOf(w, at), d);
      continue;
    }
    if (at.x === q.seal.x && at.z === q.seal.z) {
      onSeal = id === B.an_seal;
      tiles.push({ ...at, seal: true });
      break;
    }
    if (BLOCKS[id].solid) break;
    tiles.push(at);
  }
  q.mirrors.forEach((m, i) => {
    if (w.getBlock(m.x, FY, m.z) === B.an_mirror && w.getState(m.x, FY, m.z) !== lit.has(i)) w.setState(m.x, FY, m.z, lit.has(i));
  });
  run.game.lightDirty = true;
  anT(run).beams.set(q.room, tiles);
  return { tiles, onSeal };
}
function openSeal(run, q, quiet) {
  const game = run.game;
  const w = game.world;
  mine(run).opened[k2(q.seal.x, q.seal.z)] = true;
  for (const y of [FY, FY + 1]) if (w.getBlock(q.seal.x, y, q.seal.z) === B.an_seal) w.setBlock(q.seal.x, y, q.seal.z, B.air);
  if (quiet) return;
  game.audio?.play('chime', q.seal);
  game.shake = Math.min(1, (game.shake || 0) + 0.25);
  game.renderer.emit(q.seal.x, FY + 1.2, q.seal.z, { n: 40, color: SUN, up: 30, speed: 30, life: 1.2, glow: true });
  game.ui.msg('The beam lies on the seal, and the seal drinks it: the sun in it flares, the gold runs like wax, and the way into the sanctum is open.', '#ffe070', true);
}
function turnMirror(run, x, z) {
  const w = run.game.world;
  const m = w.getMeta(x, FY, z);
  const rot = (m & META_ROT) ^ 1;
  w.setMeta(x, FY, z, (m & ~META_ROT) | rot);
  mine(run).turns[k2(x, z)] = rot;
  for (const q of run.data.specula || []) {
    if (!q.mirrors.some((mm) => mm.x === x && mm.z === z)) continue;
    const { onSeal } = trace(run, q);
    if (onSeal) openSeal(run, q, false);
  }
}

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isAthanor(run)) return;
  const w = run.game.world;
  const S = mine(run);
  run.game.lightBeams = [];
  for (const q of run.data.specula || []) {
    for (const m of q.mirrors) {
      const t = S.turns[k2(m.x, m.z)];
      if (t !== undefined && w.getBlock(m.x, FY, m.z) === B.an_mirror) w.setMeta(m.x, FY, m.z, (w.getMeta(m.x, FY, m.z) & ~META_ROT) | t);
    }
    if (S.opened[k2(q.seal.x, q.seal.z)]) openSeal(run, q, true);
    trace(run, q);
  }
  for (const q of run.data.tables || []) if (S.gold[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, true);
  for (const q of run.data.athanors || []) if (S.ripe[k2(q.x, q.z)]) w.setState(q.x, FY + 1, q.z, false);
  for (const g of run.data.vats || []) for (const q of g.vats) if (S.broken[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, false);
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'an_tablet': return 'Green stone, cut with a writing worn too smooth to read: only "...as above, so below..." is left.';
    case 'an_lectern': return 'A brass lectern, the book on it fallen to dust.';
    case 'an_saltman': return 'A man made of salt, standing where he stood, his hand still up against the light.';
    default: return null;
  }
}
export function interact(run, x, y, z, b) {
  if (!isAthanor(run)) return false;
  const game = run.game;
  const w = game.world;
  const p = game.player;
  const S = mine(run);
  const T = anT(run);
  switch (b.interact) {
    // A mirror on its stand: turned the other way.
    case 'an_mirror': {
      const q = (run.data.specula || []).find((s) => s.mirrors.some((m) => m.x === x && m.z === z));
      if (q && S.opened[k2(q.seal.x, q.seal.z)]) {
        game.ui.msg('A speculum of polished silver on a turning stand. The sanctum\'s open: it can be left as it is.', '#e8e0c0');
        return true;
      }
      turnMirror(run, x, z);
      game.audio?.play('click', { x, y, z });
      game.renderer.emit(x, FY + 1.2, z, { n: 6, color: SILVER, up: 6, speed: 8, life: 0.5, glow: true });
      tell(run, 'mirror', 'You turn the mirror on its stand. (Each turns but two ways, / or \\. Turn them so the sun-lamp\'s beam is thrown from one to the next and laid on the seal in the wall. Mind: it scorches.)', '#ffe070');
      return true;
    }
    case 'an_sunlamp':
      game.ui.msg('The sun-lamp: a burning-glass the size of a cartwheel, and in its heart a light that never went out, thrown in a beam across the floor. It\'s fixed where it stands; the mirrors turn.', '#ffe070', true);
      return true;
    case 'an_seal':
      game.ui.msg('A seal of gold set in the wall, a sun in a circle, warm to the touch. There is no keyhole. (It wants the sun laid on it: the speculum\'s beam.)', '#ffe070', true);
      return true;
    // The transmutation table: lead or iron laid in its circle.
    case 'an_transmute': {
      if (w.getState(x, y, z)) {
        game.ui.msg('The circle\'s lines are dark again. Whatever it had to give, it has given.', '#c8b890');
        return true;
      }
      const base = countItem(p.inv, 'lead') > 0 ? 'lead' : countItem(p.inv, 'iron_ingot') > 0 ? 'iron_ingot' : null;
      if (!base) {
        game.ui.msg('A table of black stone, a circle cut in it and lines of gold run into the cuts. Its rim says: "Lay the base metal in the circle." (Lead, or iron.)', '#e8d890', true);
        return true;
      }
      removeItem(p.inv, base, 1);
      const n = base === 'lead' ? 2 : 1;
      addItem(p.inv, 'gold_ingot', n);
      w.setState(x, y, z, true);
      S.gold[k2(x, z)] = true;
      game.audio?.play('chime', { x, y, z });
      game.renderer.emit(x, FY + 1.2, z, { n: 30, color: ['#ffe070', '#ffb030', '#fff8d0'], up: 24, speed: 20, life: 1, glow: true });
      game.renderer.floatText(x, FY + 2, z, `+${n} gold ingot${n > 1 ? 's' : ''}`, '#ffe070');
      // (But the Work sees.)
      const who = [call(run, 'adept', { x, z }, 3), call(run, 'adept', { x, z }, 4)].filter(Boolean);
      for (const c of who) c.target = p;
      game.ui.msg(`The lines of the circle kindle, and the ${base === 'lead' ? 'lead' : 'iron'} goes soft and bright and yellow: gold. And from the shadows, robed, the adepts come to see who has done the Work in its name.`, '#ffe070', true);
      return true;
    }
    // The athanor: fed, it burns; its egg ripens.
    case 'an_athanor': {
      const q = (run.data.athanors || []).find((a) => a.x === x && a.z === z);
      if (!q || S.ripe[k2(x, z)]) {
        game.ui.msg('The great athanor, cold. Its egg is cracked and empty.', '#c8b890');
        return true;
      }
      if (w.getState(x, FY + 1, z) && T.fires.has(k2(x, z))) {
        const f = T.fires.get(k2(x, z));
        game.ui.msg(`The athanor roars. Through its glass the egg glows ${f.t < RIPEN * 0.5 ? 'dull red' : f.t < RIPEN * 0.85 ? 'orange' : 'white-gold'}: ${Math.round((f.t / RIPEN) * 100)}% ripe. (Stay by it, and keep the imps off.)`, '#ffb050');
        return true;
      }
      const fuel = countItem(p.inv, 'coal') > 0 ? 'coal' : countItem(p.inv, 'sulfur') > 0 ? 'sulfur' : null;
      if (!fuel) {
        game.ui.msg('The great athanor: a tower-furnace of brick and brass on its dais, and in its glass belly the philosophers\' egg, sealed, dark. Its fire\'s out. (It burns coal, or sulphur: there\'s some heaped by it.)', '#e8c8a0', true);
        return true;
      }
      removeItem(p.inv, fuel, 1);
      lightAthanor(run, q);
      return true;
    }
    // A vat: smashed, and what's in it climbs out.
    case 'an_vat': {
      if (!w.getState(x, y, z)) {
        game.ui.msg('A vat, its glass smashed, the green gone out of it. Whatever was in it is gone too.', '#a0b8a0');
        return true;
      }
      const kk = `v${k2(x, z)}`;
      if (!T.told[kk]) {
        T.told[kk] = true;
        game.ui.msg('A vat of green glass, bubbling. Something floats in it, curled, its eyes shut: it turns as you look. (Use it again to smash it.)', '#a0e0a0', true);
        return true;
      }
      breakVat(run, { x, z }, true);
      return true;
    }
    default: return false;
  }
}

// ------------------------------------------------------------ the athanor
function lightAthanor(run, q) {
  const game = run.game;
  game.world.setState(q.x, FY + 1, q.z, true);
  game.lightDirty = true;
  anT(run).fires.set(k2(q.x, q.z), { t: 0, imp: IMP_EVERY * 0.6, q });
  game.audio?.play('torch', { x: q.x, y: FY + 1, z: q.z });
  game.renderer.emit(q.x, FY + 2, q.z, { n: 30, color: ['#ff902a', '#ffd060', '#fff8d0'], up: 30, speed: 20, life: 1, glow: true });
  game.ui.msg('You feed the athanor and set it going. The fire catches with a roar, and in the glass the egg begins, very slowly, to glow. (It must burn a while to ripen, with you by it; and the imps love a fire. Don\'t let them at it.)', '#ffb050', true);
}
function ripen(run, f) {
  const game = run.game;
  const q = f.q;
  mine(run).ripe[k2(q.x, q.z)] = true;
  anT(run).fires.delete(k2(q.x, q.z));
  game.world.setState(q.x, FY + 1, q.z, false);
  game.lightDirty = true;
  const s = spotNear(run, q.x, q.z, 2) || q;
  game.spawnDrop('red_tincture', 1, s.x, FY, s.z, true);
  game.audio?.play('chime', { x: q.x, y: FY + 1, z: q.z });
  game.shake = Math.min(1, (game.shake || 0) + 0.3);
  game.renderer.emit(q.x, FY + 2, q.z, { n: 50, color: ['#e03a20', '#ff9070', '#fff8d0'], up: 30, speed: 30, life: 1.4, glow: true });
  game.ui.msg('The egg goes white, then red as blood, and cracks with a sound like a bell; the fire sinks. In the ashes: a phial of something red that moves like it\'s alive. The Red Tincture.', '#ff7050', true);
}

// ------------------------------------------------------------ the vats
export function breakVat(run, q, byHand) {
  const game = run.game;
  const w = game.world;
  if (w.getBlock(q.x, FY, q.z) !== B.an_vat || !w.getState(q.x, FY, q.z)) return null;
  w.setState(q.x, FY, q.z, false);
  mine(run).broken[k2(q.x, q.z)] = true;
  game.lightDirty = true;
  game.audio?.play('glass', { x: q.x, y: FY, z: q.z });
  game.renderer.emit(q.x, FY + 1, q.z, { n: 24, color: ['#80e080', '#c8f0c8', '#ffffff'], up: 20, speed: 30, gravity: 80, life: 0.8 });
  const c = byHand || Math.random() < 0.5 ? call(run, 'quicksilver_homunculus', q, 2) : null;
  if (c) {
    c.hp = Math.max(1, Math.round(c.hp * 0.6));
    c.target = game.player;
    game.renderer.floatText(q.x, FY + 1.8, q.z, 'it climbs out', '#c8f0c8');
  }
  if (byHand) tell(run, 'vat', 'The glass goes, and the green with it, and the thing in the vat uncurls on the floor and opens its eyes.', '#a0e0a0');
  return c;
}
// The tender's death: every vat in its hall breaks.
export function tenderDies(run, c) {
  const g = (run.data.vats || []).reduce((best, v) => {
    const d = Math.min(...v.vats.map((q) => dist(q, c)));
    return !best || d < best.d ? { v, d } : best;
  }, null);
  if (!g || g.d > 12) return;
  let n = 0;
  for (const q of g.v.vats) if (breakVat(run, q, false)) n++;
  if (n) run.game.ui.msg('As the tender falls, every vat in the hall cracks at once, as if they knew: the green pours out across the floor, and what was in them comes with it.', '#a0e0a0', true);
}

// What of the Work the tender mends.
export const WORK = new Set(['quicksilver_homunculus', 'quicksilver_bead', 'alembic_golem', 'leaden_sentinel']);
const MEND = ['#80e080', '#c8f0c8', '#ffffff'];
// The tender's hands on whatever of the Work is hurt near it (every so
// often: see tick).
export function tend(game, run, c) {
  let n = 0;
  for (const o of run.creatures()) {
    if (o.dead || o === c || !WORK.has(o.species) || o.hp >= o.maxHp || dist(o, c) > 4) continue;
    o.hp = Math.min(o.maxHp, o.hp + 4);
    n++;
    for (let k = 0; k <= 3; k++) {
      const f = k / 3;
      game.renderer.emit(c.x + (o.x - c.x) * f, c.y + 1.2, c.z + (o.z - c.z) * f, { n: 1, color: MEND, up: 4, speed: 3, life: 0.5, glow: true });
    }
    game.renderer.floatText(o.x, o.y + 2.2, o.z, '+4', '#80e080');
  }
  if (n && !anT(run).told.tender) {
    anT(run).told.tender = true;
    game.ui.msg('The vat-tender shuffles to the hurt thing and lays its hands on it, and the wound closes. It mends whatever of the Work is hurt near it. (It never fights. Killing it will break every vat in the hall.)', '#80e080', true);
  }
  return n;
}

// ------------------------------------------------------------ quicksilver
// The adepts' quicksilver, called up under you: a patch of it, a while.
export function quicken(run, tiles, by) {
  const game = run.game;
  const w = game.world;
  const ok = tiles.filter((t) => !BLOCKS[w.getBlock(t.x, FY, t.z)].solid && BLOCKS[w.getBlock(t.x, FY - 1, t.z)].solid);
  if (!ok.length) return null;
  const z = addZone(game, { by, kind: 'quick', tiles: ok, y: FY, life: QUICK_LIFE, tick: 0.6, chill: 0.4, slow: true, color: [210, 214, 228], puff: SILVER });
  for (const t of ok) game.renderer.emit(t.x, FY + 0.1, t.z, { n: 3, color: SILVER, up: 10, speed: 8, life: 0.5, glow: true });
  game.audio?.play('splash', ok[0]);
  tell(run, 'quick', 'Quicksilver wells up out of the floor around you, cold and heavy, dragging at your feet. (It mends the homunculi; and fire turns it to a poison fume.)', '#d8d8e8');
  return z;
}
// On quicksilver (a pool's, or an adept's)?
export function onQuick(run, e) {
  const w = run.game.world;
  if (w.getBlock(e.x, FY - 1, e.z) === B.quicksilver || w.getBlock(e.x, FY, e.z) === B.quicksilver) return true;
  return (run.game.zones || []).some((z) => z.kind === 'quick' && !z.done && z.tiles.some((t) => t.x === e.x && t.z === e.z));
}
// Fire on it: fumes, that choke anyone in them.
function fume(run, z) {
  const game = run.game;
  z.done = true;
  addZone(game, { kind: 'fume', tiles: z.tiles, y: z.y, life: 4.5, tick: 0.7, dmg: 2, all: true, color: [190, 200, 100], puff: FUME });
  const at = z.tiles[Math.floor(z.tiles.length / 2)];
  game.audio?.play('hiss', at);
  game.renderer.emit(at.x, FY + 0.6, at.z, { n: 30, color: FUME, up: 16, speed: 12, life: 1.4, shape: 'puff', gravity: -6 });
  game.renderer.floatText(at.x, FY + 1.8, at.z, 'the quicksilver fumes!', '#c8d070');
  tell(run, 'fume', 'The imp\'s fire touches the quicksilver and it boils up in a yellow-grey fume, choking: anyone in it, adept or homunculus or you. (Lure the imps onto it.)', '#c8d070');
}

// ------------------------------------------------------------ each frame
export function tick(run, dt, party = null) {
  if (!isAthanor(run)) return;
  const game = run.game;
  const w = game.world;
  const T = anT(run);
  const who = (party || [game.player]).filter((p) => p && !p.dead);
  if (!who.length) return;
  const close = (q, r) => who.some((p) => dist(p, q) <= r);
  const mobs = run.creatures();
  // The speculum's beams: shining, and scorching whoever's in them.
  game.lightBeams = [];
  for (const q of run.data.specula || []) {
    if (!close(q.lamp, 16)) continue;
    const tiles = T.beams.get(q.room) || trace(run, q).tiles;
    game.lightBeams.push({ tiles: [q.lamp, ...tiles], y: FY });
    if (tiles.length && Math.random() < dt * 14) {
      const t = tiles[Math.floor(Math.random() * tiles.length)];
      game.renderer.emit(t.x + (Math.random() - 0.5) * 0.5, FY + 1.1, t.z + (Math.random() - 0.5) * 0.5, { n: 1, color: SUN, up: 2, speed: 2, life: 0.4, glow: true });
    }
    for (const e of [...who, ...mobs]) {
      if (e.dead || e.dormant || e.S?.boss || !tiles.some((t) => !t.mirror && !t.seal && t.x === e.x && t.z === e.z)) continue;
      const s = (T.scorchT.get(e) || 0) - dt;
      if (s > 0) {
        T.scorchT.set(e, s);
        continue;
      }
      T.scorchT.set(e, SCORCH);
      game.damage(e, e.kind === 'player' ? 1 : 3, null);
      game.renderer.emit(e.x, e.y + 1, e.z, { n: 4, color: SUN, up: 12, speed: 8, life: 0.4, glow: true });
      if (e.kind === 'player') tell(run, 'scorch', 'The beam scorches where it touches you. (It burns whatever stands in it: the adepts too.)', '#ffe070');
    }
  }
  // The athanors burning: their eggs ripening; the imps coming to them.
  for (const [kk, f] of T.fires) {
    const q = f.q;
    if (w.getBlock(q.x, FY + 1, q.z) !== B.an_athanor) {
      T.fires.delete(kk);
      continue;
    }
    if (!close(q, 9)) continue;
    f.t += dt;
    if (Math.random() < dt * 5) game.renderer.emit(q.x, FY + 2.4, q.z, { n: 1, color: ['#ff902a', '#ffd060'], up: 14, speed: 4, life: 0.6, glow: true });
    f.imp -= dt;
    const imps = mobs.filter((c) => !c.dead && c.species === 'sulphur_imp' && dist(c, q) <= 10);
    if (f.imp <= 0) {
      f.imp = IMP_EVERY;
      if (imps.length < IMPS_MAX) {
        const c = call(run, 'sulphur_imp', q, 3);
        if (c) {
          c.toFire = q;
          game.renderer.floatText(c.x, c.y + 1.6, c.z, 'drawn to the fire', '#ffb050');
          tell(run, 'imps', 'A sulphur imp comes skittering out of the dark toward the athanor\'s fire. (If it gets at the furnace, it eats the heat out of it. Keep them off.)', '#ffb050');
        }
      }
    }
    // (An imp at the furnace: the heat eaten out of it.)
    for (const c of imps) {
      if (dist(c, q) > 1 || c.feedT > 0) continue;
      c.feedT = 2.5;
      f.t = Math.max(0, f.t - 4);
      game.renderer.emit(q.x, FY + 1.5, q.z, { n: 10, color: ['#ffd060', '#5a3010'], up: 10, speed: 10, life: 0.6 });
      game.renderer.floatText(q.x, FY + 2.6, q.z, 'the imp eats the fire!', '#ff9030');
    }
    for (const c of imps) if (c.feedT > 0) c.feedT -= dt;
    if (f.t >= RIPEN) ripen(run, f);
  }
  // The tenders at their mending.
  for (const c of mobs) {
    if (c.dead || c.dormant || c.species !== 'vat_tender') continue;
    const tt = (T.tendT.get(c) ?? 2) - dt;
    T.tendT.set(c, tt > 0 ? tt : 2.5);
    if (tt <= 0) tend(game, run, c);
  }
  // The quicksilver: the homunculi mended in it; fire on it, fumes.
  T.mendT -= dt;
  const mend = T.mendT <= 0;
  if (mend) T.mendT = 0.8;
  for (const c of mobs) {
    if (c.dead || c.dormant) continue;
    if (mend && (c.species === 'quicksilver_homunculus' || c.species === 'quicksilver_bead') && c.hp < c.maxHp && onQuick(run, c)) {
      c.hp = Math.min(c.maxHp, c.hp + 2);
      game.renderer.emit(c.x, c.y + 0.6, c.z, { n: 3, color: SILVER, up: 8, speed: 6, life: 0.5, glow: true });
    }
  }
  for (const z of game.zones || []) {
    if (z.kind !== 'quick' || z.done) continue;
    const hot = mobs.some((c) => !c.dead && !c.dormant && c.species === 'sulphur_imp' && z.tiles.some((t) => dist(t, c) <= 1))
      || (game.zones || []).some((o) => o.kind === 'fire' && !o.done && o.tiles.some((t) => z.tiles.some((u) => dist(t, u) <= 0)))
      || who.some((p) => p.burnT > 0 && z.tiles.some((t) => t.x === p.x && t.z === p.z));
    if (hot) fume(run, z);
  }
}
