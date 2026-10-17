// (Round 109) The Drowned Broch at work (laid out by world/deeps/broch.js):
// the gale (it comes in at the slits in gusts you can hear coming: down its
// line it knocks you along, off the ledge if you're on it, and blows out
// the lamps); the cruisie lamps (lit by hand again; the trowies won't come
// near one lit); the beacon (cold till it's fed a jar of fish-oil from the
// casks below, and lit: then the drowned shrink from it, the wreckers'
// false lights go dark, and the keeper's kist comes unlocked); the false
// lights (while they burn, the drowned rise up out of the water to them:
// smash them); the strongroom (barred and padlocked: one of the wreckers
// carries the key); the wall-cells (put your hand in: the trowies' hoard,
// or a trowie); the seals (they bark at you, and the drowned wake); the
// fulmars' oil, and the fire it catches.
//
// What's been done (the lamps as they were left, the beacons lit, the
// casks broached, the false lights smashed, the strongrooms opened, the
// cells searched and what the trowies put back in them) is kept in the
// floor's state, and put back when the floor's made again (see restore).
import { FY } from '../world/dungeongen.js';
import { addZone } from '../entities/monsters.js';
import { B } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { addItem, countItem, removeItem } from './inventory.js';

const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.broch ||= { dark: {}, lit: {}, broached: {}, smashed: {}, opened: {}, searched: {}, bit: {}, hoard: {} });
// What's going on about the floor this visit (not saved).
export const bcT = (run) => (run.brochT ||= { told: {}, gusts: new Map(), barkT: new Map(), rise: new Map(), risen: new Map() });
const isBroch = (run) => run && run.rec && run.rec.type === 'broch';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
const SPRAY = ['#e0f0f8', '#a8c0d0', '#ffffff'];
// How often the gale comes in at a slit (seconds), and its warning.
export const GUST_EVERY = [7, 11];
export const GUST_WARN = 1.2;
// How far a gust knocks you.
export const GUST_PUSH = 2;
// How often a false light (or its bearer) calls one up out of the water,
// and how many each.
export const RISE_EVERY = 14;
const RISE_MAX = 2;

// A lit lamp within `r` of a spot?
export function litNear(run, at, r) {
  const w = run.game.world;
  for (const q of run.data.lamps || []) if (dist(q, at) <= r && w.getBlock(q.x, FY, q.z) === B.bc_lamp && w.getState(q.x, FY, q.z)) return true;
  return false;
}

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isBroch(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const q of run.data.lamps || []) {
    if (S.dark[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, false);
    else if (S.lit[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, true);
  }
  for (const q of run.data.casks || []) if (S.broached[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, true);
  for (const q of run.data.falselights || []) if (S.smashed[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, false);
  for (const q of run.data.strongrooms || []) if (S.opened[k2(q.x, q.z)]) for (const y of [FY, FY + 1]) w.setBlock(q.x, y, q.z, B.air);
  for (const q of run.data.beacons || []) if (S.lit[`b${k2(q.x, q.z)}`]) lightBeacon(run, q, true);
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'bc_patch': return 'Driftwood planks nailed over a breach in the wall. The wind whistles through the cracks.';
    case 'bc_kist': return 'A sea-kist, its lid salt-stuck.';
    case 'bc_figurehead': return 'A figurehead off a wreck, her paint worn to the wood.';
    case 'bc_bunk': return 'A box-bed of ship\'s planks, the blanket stiff with salt.';
    case 'bc_bones': return 'A drowned sailor, his pockets turned out.';
    case 'bc_symbol': return 'A symbol cut in the stone, worn smooth.';
    default: return null;
  }
}
export function interact(run, x, y, z, b) {
  if (!isBroch(run)) return false;
  const game = run.game;
  const w = game.world;
  const p = game.player;
  const S = mine(run);
  const T = bcT(run);
  switch (b.interact) {
    // A cruisie lamp: lit again from your own light.
    case 'bc_lamp': {
      if (w.getState(x, y, z)) {
        game.ui.msg('A cruisie lamp, its rush wick burning in the fish-oil, smoking.', '#ffd890');
        return true;
      }
      w.setState(x, y, z, true);
      delete S.dark[k2(x, z)];
      S.lit[k2(x, z)] = true;
      game.lightDirty = true;
      game.audio?.play('torch', { x, y, z });
      game.renderer.emit(x, y + 1, z, { n: 8, color: ['#ffd070', '#ff9030'], up: 8, speed: 6, life: 0.6, glow: true });
      if (!T.told.lamp) {
        T.told.lamp = true;
        game.ui.msg('You light the wick again. (The trowies won\'t come near a lit lamp. The gale blows them out.)', '#ffd890', true);
      }
      return true;
    }
    // A cask of fish-oil: a jar of it drawn off for the beacon.
    case 'bc_oilcask': {
      if (w.getState(x, y, z)) {
        game.ui.msg('The cask\'s dry: someone\'s drawn it off already.', '#c8b890');
        return true;
      }
      w.setState(x, y, z, true);
      S.broached[k2(x, z)] = true;
      addItem(p.inv, 'fish_oil', 1);
      game.audio?.play('splash', { x, y, z });
      game.ui.msg('You knock the bung out and draw off a jar of fish-oil. It stinks. (The beacon burns on it.)', '#e0b850');
      return true;
    }
    // The beacon: fed and lit.
    case 'bc_beacon': {
      const q = (run.data.beacons || []).find((bq) => bq.x === x && bq.z === z);
      if (w.getState(x, y, z)) {
        game.ui.msg('The beacon roars in its basket. You can feel the heat of it on your face.', '#ffb050');
        return true;
      }
      if (!q) {
        game.ui.msg('An iron fire-basket on a stand, cold.', '#c8c0b0');
        return true;
      }
      if (countItem(p.inv, 'fish_oil') <= 0) {
        game.ui.msg('The beacon: an iron fire-basket on its stand, peat and driftwood stacked in it, cold and black. It wants oil to catch. (The keeper\'s log says where it\'s kept.)', '#c8c0b0', true);
        return true;
      }
      removeItem(p.inv, 'fish_oil', 1);
      S.lit[`b${k2(q.x, q.z)}`] = true;
      lightBeacon(run, q, false);
      return true;
    }
    // The keeper's kist: locked till the light's lit.
    case 'bc_keeperkist':
      game.ui.msg('The keeper\'s kist, iron-strapped, his mark burnt in its lid, and under it: "When the light is lit." It\'s locked fast.', '#d8c8a8');
      return true;
    // A false light: smashed.
    case 'bc_falselight': {
      if (!w.getState(x, y, z)) {
        game.ui.msg('The false light, smashed. Good.', '#c8c0b0');
        return true;
      }
      w.setState(x, y, z, false);
      S.smashed[k2(x, z)] = true;
      game.lightDirty = true;
      game.audio?.play('glass', { x, y, z });
      game.renderer.emit(x, y + 2.5, z, { n: 16, color: ['#ffd070', '#5a606a', '#c8d0d8'], up: 10, speed: 30, life: 0.6 });
      game.ui.msg('You knock the lantern off its pole and stamp it out. Nothing will come up out of the water to that one again.', '#ffd070', true);
      for (const c of run.creatures()) {
        if (c.dead || (c.species !== 'wrecker' && c.species !== 'lantern_bearer') || dist(c, { x, z }) > 8) continue;
        if (c.dormant) run.wake(c);
        c.target = p;
      }
      return true;
    }
    // The strongroom's door: the wreckers' key.
    case 'bc_bardoor': {
      const q = (run.data.strongrooms || []).find((sq) => sq.x === x && sq.z === z);
      if (!q) {
        game.ui.msg('A door of ship\'s planks, barred and nailed shut.', '#c8b890');
        return true;
      }
      if (countItem(p.inv, 'wreckers_key') <= 0) {
        game.ui.msg('The wreckers\' strongroom: a door of ship\'s planks, an iron bar across it, a padlock on the bar. One of them will have the key on him.', '#c8b890', true);
        return true;
      }
      removeItem(p.inv, 'wreckers_key', 1);
      S.opened[k2(x, z)] = true;
      for (const yy of [FY, FY + 1]) w.setBlock(x, yy, z, B.air);
      game.audio?.play('door', { x, y, z });
      game.ui.msg('The key turns stiffly in the padlock. You lift the bar down and the door swings in on the wreckers\' strongroom.', '#ffd070', true);
      return true;
    }
    // A wall-cell: your hand in it.
    case 'bc_cell': {
      const q = (run.data.cells || []).find((cq) => cq.x === x && cq.z === z);
      const kk = k2(x, z);
      if (!q) {
        game.ui.msg('A wall-cell, its low door choked with fallen stone.', '#c8c0b0');
        return true;
      }
      const hoard = S.hoard[kk] || 0;
      if (S.searched[kk] && !hoard) {
        game.ui.msg('An empty cell in the wall\'s thickness, a nest of rags and fish-bones at the back of it.', '#c8c0b0');
        return true;
      }
      if (q.trow && !S.bit[kk]) {
        S.bit[kk] = true;
        game.damage(p, 2, null);
        const t = run.spawn('trowie', x, FY, z + 1, {});
        if (t) {
          t.dormant = 0;
          t.target = p;
        }
        game.ui.msg('You put your hand into the dark of the cell, and something in it bites you to the bone. A trowie comes scrabbling out after it.', '#e08060', true);
        return true;
      }
      const got = [];
      if (!S.searched[kk]) for (const [item, n] of q.loot) if (ITEMS[item]) {
        addItem(p.inv, item, n);
        got.push(`${n > 1 ? `${n} ` : ''}${ITEMS[item].name.toLowerCase()}`);
      }
      if (hoard) {
        addItem(p.inv, 'coin', hoard);
        got.push(`${hoard} coin${hoard > 1 ? 's' : ''}`);
      }
      S.searched[kk] = true;
      S.hoard[kk] = 0;
      game.audio?.play('coin', { x, y, z });
      game.ui.msg(`You reach into the cell and feel about in the trowies' nest: ${got.join(', ') || 'nothing'}.`, '#ffd070');
      return true;
    }
  }
  return false;
}

// The beacon lit: the drowned shrink from it; the false lights die; the
// keeper's kist comes unlocked.
export function lightBeacon(run, q, quiet) {
  const game = run.game;
  const w = game.world;
  w.setState(q.x, FY + 1, q.z, true);
  game.lightDirty = true;
  for (const f of run.data.falselights || []) {
    if (!w.getState(f.x, FY, f.z)) continue;
    w.setState(f.x, FY, f.z, false);
    mine(run).smashed[k2(f.x, f.z)] = true;
  }
  for (const k of run.data.keeperkists || []) if (w.getBlock(k.x, FY, k.z) === B.bc_keeperkist) w.setBlock(k.x, FY, k.z, B.chest, 0);
  if (quiet) return;
  game.audio?.play('torch', { x: q.x, y: FY + 1, z: q.z });
  game.shake = Math.min(1, (game.shake || 0) + 0.4);
  game.renderer.emit(q.x, FY + 2.5, q.z, { n: 40, color: ['#ffd060', '#ff902a', '#fff8d0'], up: 40, speed: 30, life: 1.2, glow: true });
  for (const c of run.creatures()) {
    if (c.dead || c.species !== 'drowned' || dist(c, q) > 10) continue;
    game.damage(c, 6, null);
    c.lostT = Math.max(c.lostT || 0, 6);
    c.target = null;
    game.renderer.floatText(c.x, c.y + 2.2, c.z, 'it shrinks from the light', '#ffd070');
  }
  game.ui.msg('You pour the oil over the peat and put a light to it, and the beacon goes up with a roar. Every false light on the floor gutters and dies; the drowned shrink back from the glare; and in the keeper\'s kist, a lock clicks.', '#ffd070', true);
}

// A trowie gone into its cell with what it took: into the hoard.
export function intoCell(run, c, q) {
  const game = run.game;
  const S = mine(run);
  const kk = k2(q.x, q.z);
  S.hoard[kk] = (S.hoard[kk] || 0) + (c.stolen || 0);
  game.renderer.emit(c.x, c.y + 0.8, c.z, { n: 10, color: ['#8a8a8a', '#5a5a5a'], up: 8, speed: 10, life: 0.5 });
  game.renderer.floatText(c.x, c.y + 1.8, c.z, 'into the wall with it', '#c8d0d8');
  c.stolen = 0;
  c.dead = true;
  game.removeOcc?.(c);
  const T = bcT(run);
  if (!T.told.hoard) {
    T.told.hoard = true;
    game.ui.msg('The trowie scuttles into a wall-cell with your coin and is gone. (It\'ll be in there, in its hoard. Reach in after it, if you dare.)', '#c8d0d8', true);
  }
}

// A gust in at a slit: down its line, everyone knocked along it, lamps out.
export function gust(run, s) {
  const game = run.game;
  const w = game.world;
  const S = mine(run);
  const on = new Set(s.tiles.map((t) => k2(t.x, t.z)));
  const near = (x, z) => on.has(k2(x, z)) || (!s.along && (on.has(k2(x - 1, z)) || on.has(k2(x + 1, z))));
  game.audio?.play('wind', s);
  for (const t of s.tiles) if (Math.random() < 0.5) game.renderer.emit(t.x, FY + 1.2, t.z, { n: 2, color: SPRAY, up: 2, speed: 18, life: 0.5, oy: 2 });
  // The lamps it passes, out.
  for (const q of run.data.lamps || []) {
    if (!near(q.x, q.z) || !w.getState(q.x, FY, q.z)) continue;
    w.setState(q.x, FY, q.z, false);
    S.dark[k2(q.x, q.z)] = true;
    delete S.lit[k2(q.x, q.z)];
    game.lightDirty = true;
    game.renderer.emit(q.x, FY + 1.2, q.z, { n: 6, color: ['#8a8a8a', '#5a5a5a'], up: 6, speed: 4, life: 0.8, shape: 'puff' });
  }
  // Everyone in its line, knocked along it.
  const who = [...game.everyone(), ...run.creatures()].filter((e) => e && !e.dead && !e.isBoss && !(e.S && e.S.anchored) && on.has(k2(e.x, e.z)) && e.y >= FY - 1 && e.y <= FY + 2);
  let hit = false;
  for (const e of who) {
    let moved = 0;
    const y0 = e.y;
    for (let k = 0; k < GUST_PUSH; k++) {
      const nx = e.x + s.dir.x;
      const nz = e.z + s.dir.z;
      const ny = w.stepTarget(e.x, e.y, e.z, nx, nz, false);
      if (ny < 0 || ny > e.y || game.occupiedBySolid(nx, ny, nz, e)) break;
      e.teleport(nx, ny, nz);
      moved++;
    }
    if (!moved) continue;
    if (e.kind === 'player') hit = true;
    e.stunT = Math.max(e.stunT || 0, 0.35);
    const fall = y0 - e.y;
    if (fall >= 2) {
      game.damage(e, 2 * (fall - 1), null);
      game.renderer.floatText(e.x, e.y + 2.4, e.z, 'blown off the ledge!', '#e0f0f8');
    }
  }
  const T = bcT(run);
  if (hit && !T.told.gust) {
    T.told.gust = true;
    game.ui.msg('The gale comes in at the slit with a scream and knocks you off your feet.', '#e0f0f8', true);
  }
}

// One of the drowned up out of the water, to a false light (or its bearer).
function rise(run, from, key) {
  const game = run.game;
  const w = game.world;
  const T = bcT(run);
  if ((T.risen.get(key) || 0) >= RISE_MAX) return;
  let best = null;
  let bd = 99;
  for (const g of run.data.pools || []) {
    for (const t of g.tiles) {
      const d = dist(t, from);
      if (d < bd && d <= 7 && w.getBlock(t.x, FY - 1, t.z) === B.water && w.getBlock(t.x, FY - 2, t.z) !== B.water && !game.occupiedBySolid(t.x, FY - 1, t.z)) {
        bd = d;
        best = t;
      }
    }
  }
  if (!best) return;
  const c = run.spawn('drowned', best.x, FY - 1, best.z, {});
  if (!c) return;
  c.dormant = 0;
  T.risen.set(key, (T.risen.get(key) || 0) + 1);
  game.renderer.emit(best.x, FY - 0.5, best.z, { n: 20, color: ['#2a4a5a', '#a8c0d0', '#ffffff'], up: 20, speed: 20, life: 0.8 });
  game.renderer.floatText(best.x, FY + 1.5, best.z, 'something rises out of the water', '#a8c0d0');
  if (!T.told.rise) {
    T.told.rise = true;
    game.ui.msg('One of the drowned comes up out of the black water toward the false light, streaming. (While the false lights burn, the drowned come to them. Smash the lights, or kill whoever carries them.)', '#a8c0d0', true);
  }
}

// ------------------------------------------------------------ each frame
export function tick(run, dt, party = null) {
  if (!isBroch(run)) return;
  const game = run.game;
  const w = game.world;
  const T = bcT(run);
  const who = (party || [game.player]).filter((p) => p && !p.dead);
  if (!who.length) return;
  const close = (q, r) => who.some((p) => dist(p, q) <= r);
  // The gale at the slits: its whistle, then the gust.
  for (const s of run.data.slits || []) {
    const kk = k2(s.x, s.z);
    if (!close(s, 14)) continue;
    let g = T.gusts.get(kk);
    if (!g) T.gusts.set(kk, (g = { t: GUST_EVERY[0] + Math.random() * (GUST_EVERY[1] - GUST_EVERY[0]), warned: false }));
    g.t -= dt;
    if (!g.warned && g.t <= GUST_WARN) {
      g.warned = true;
      game.audio?.play('wind_low', s);
      game.renderer.floatText(s.x, FY + 2.2, s.z, 'whistling...', '#e0f0f8');
      game.renderer.emit(s.x, FY + 1.2, s.z, { n: 8, color: SPRAY, up: 4, speed: 10, life: 0.6 });
      // (Round 116) Its line shown on the floor till it comes.
      addZone(game, { by: s, kind: 'mark', tiles: s.tiles, y: FY, life: GUST_WARN, color: [200, 232, 248] });
    }
    if (g.t <= 0) {
      gust(run, s);
      g.t = GUST_EVERY[0] + Math.random() * (GUST_EVERY[1] - GUST_EVERY[0]);
      g.warned = false;
    }
  }
  const mobs = run.creatures();
  // The false lights, and their bearers: the drowned up out of the water.
  const lights = (run.data.falselights || []).filter((f) => w.getBlock(f.x, FY, f.z) === B.bc_falselight && w.getState(f.x, FY, f.z)).map((f) => ({ ...f, key: `f${k2(f.x, f.z)}` }));
  for (const c of mobs) if (!c.dead && !c.dormant && c.species === 'lantern_bearer') lights.push({ x: c.x, z: c.z, key: `c${c.id ?? c.uid ?? 'b'}` });
  for (const f of lights) {
    if (!close(f, 10)) continue;
    const t = (T.rise.get(f.key) ?? RISE_EVERY * 0.5) - dt;
    if (t > 0) {
      T.rise.set(f.key, t);
      continue;
    }
    T.rise.set(f.key, RISE_EVERY);
    rise(run, f, f.key);
  }
  // The seals: they see you, bark, and the drowned wake.
  for (const c of mobs) {
    if (c.dead || c.species !== 'seal') continue;
    const p = who.find((q) => dist(q, c) <= 4);
    const bt = (T.barkT.get(c) || 0) - dt;
    T.barkT.set(c, bt);
    if (!p || bt > 0) continue;
    T.barkT.set(c, 8);
    game.renderer.floatText(c.x, c.y + 1.6, c.z, 'ARK! ARK!', '#d8d0c0');
    game.audio?.play('growl', c);
    let woke = 0;
    for (const o of mobs) {
      if (o.dead || o.species !== 'drowned' || !o.dormant || dist(o, c) > 9) continue;
      run.wake(o);
      o.target = p;
      woke++;
    }
    if (woke && !T.told.seal) {
      T.told.seal = true;
      game.ui.msg('The seal barks at you, over and over, and in the shallows something that was lying still sits up. (The seals give you away.)', '#d8d0c0', true);
    }
  }
  // Oiled, near fire: alight.
  for (const p of who) {
    if (!(p.oiledT > 0)) continue;
    p.oiledT -= dt;
    if (Math.random() < dt * 3) game.renderer.emit(p.x, p.y + 0.6, p.z, { n: 1, color: ['#b08428', '#7a5418'], up: -2, speed: 2, gravity: 20, life: 0.5 });
    const fire = mobs.some((c) => !c.dead && !c.dormant && c.species === 'wrecker' && dist(c, p) <= 1)
      || lights.some((f) => dist(f, p) <= 1)
      || (run.data.lamps || []).some((q) => dist(q, p) <= 1 && w.getState(q.x, FY, q.z))
      || (run.data.beacons || []).some((q) => dist(q, p) <= 2 && w.getState(q.x, FY + 1, q.z));
    if (!fire) continue;
    p.oiledT = 0;
    p.burnT = Math.max(p.burnT || 0, 3);
    game.renderer.emit(p.x, p.y + 1, p.z, { n: 20, color: ['#ff902a', '#ffd060', '#c05010'], up: 20, speed: 16, life: 0.8, glow: true });
    game.renderer.floatText(p.x, p.y + 2.6, p.z, 'the oil on you catches!', '#ff9030');
    if (!T.told.burn) {
      T.told.burn = true;
      game.ui.msg('The fulmar\'s oil on you catches from the flame, and you go up like a torch! (Roll, or get into water.)', '#ff9030', true);
    }
  }
}
