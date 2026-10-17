// (Round 102) The Tide Grotto at work (laid out by world/deeps/grotto.js):
// the tide, coming in over the flats and going out again on its clock (the
// flats under a wading depth of water at high tide, slow going for anyone
// but the sea's own; the channels and pools deep enough to swim; the
// urchins hidden under it; the drowned divers rising; the blowhole
// spouting), and the tide-bell ringing as it turns; the giant clams (open
// at low water, a pearl in some: reach in, if you dare); the three offering
// shells and the sea-door three pearls open; the blowhole that throws you
// up onto its ledge at high water; the urchins; a jelly's stinging threads.
//
// What's been done (the pearls taken and laid, the door opened) is kept in
// the floor's state, and put back when the floor's made again (see
// restore). The water the tide's brought in is let out before the floor's
// kept, and let in again after (see drain).
import { FY } from '../world/dungeongen.js';
import { B, META_STATE } from '../world/blocks.js';
import { addItem, countItem, removeItem } from './inventory.js';

const k2 = (x, z) => `${x},${z}`;
// A clam shut, open, or open with its pearl (the state bit: open; the
// low bit: its pearl showing).
const CLAM = { shut: 0, open: META_STATE, pearl: META_STATE | 1 };
const clamOf = (w, x, z) => (w.getState(x, FY, z) ? ((w.getMeta(x, FY, z) & 1) ? 'pearl' : 'open') : 'shut');
const mine = (run) => (run.state.grotto ||= { taken: {}, laid: {}, opened: {} });
// What's going on about the floor this visit (not saved).
export const gtT = (run) => (run.grottoT ||= { clock: 0, wet: new Set(), deep: new Set(), phase: 'low', threads: [], ringing: [], opening: [], told: {}, hit: new Map(), spout: new Map() });
const isGrotto = (run) => run && run.rec && run.rec.type === 'grotto';
// The tide's turn: low water, the flood coming in, high water, the ebb.
export const TIDE = { period: 70, flood: 30, high: 38, ebb: 58, low: 66 };
// How far in the tide is (0, all out, to 1, all in) at a time of its turn.
export function levelAt(t) {
  const p = ((t % TIDE.period) + TIDE.period) % TIDE.period;
  if (p < TIDE.flood || p >= TIDE.low) return 0;
  if (p < TIDE.high) return (p - TIDE.flood) / (TIDE.high - TIDE.flood);
  if (p < TIDE.ebb) return 1;
  return 1 - (p - TIDE.ebb) / (TIDE.low - TIDE.ebb);
}
export const tideLevel = (run) => (isGrotto(run) ? levelAt(gtT(run).clock) : 0);
export const tideHigh = (run) => tideLevel(run) >= 0.85;
// (Each tile its own moment to flood, so the water spreads over the flats
// unevenly, the low places first.)
const keyOf = (t) => (((t.x * 73856093) ^ (t.z * 19349663)) >>> 0) % 1000 / 1000;
const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
// Is the tile wet underfoot (the tide over it, or a channel or pool)?
export function wetAt(game, x, y, z) {
  const w = game.world;
  return w.getBlock(x, y, z) === B.water || w.getBlock(x, y - 1, z) === B.water;
}

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isGrotto(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const sh of run.data.shells || []) {
    for (const q of sh.shells) if (S.laid[k2(q.x, q.z)]) w.setState(q.x, FY, q.z, true);
    if (S.opened[k2(sh.door.x, sh.door.z)]) for (const y of [FY, FY + 1]) w.setBlock(sh.door.x, y, sh.door.z, B.air);
  }
}
// The tide let out (before the floor's kept), and in again.
export function drain(run) {
  if (!isGrotto(run) || !run.grottoT) return;
  const w = run.game.world;
  const T = gtT(run);
  for (const k of T.wet) {
    const [x, z] = k.split(',').map(Number);
    if (w.getBlock(x, FY, z) === B.water) w.setBlock(x, FY, z, B.air);
  }
  T.wet.clear();
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'gt_tidemark': return 'Notches cut in the dry rock, a year scratched by each.';
    case 'gt_shellwall': return 'Shells pressed into the rock in a spiral, nacre and white and pink.';
    case 'gt_carving': return 'A great turtle cut in the rock, her flippers spread over the waves.';
    case 'gt_tidepole': return 'A driftwood post, notched up its length.';
    case 'gt_bones': return 'What\'s left of a diver, the net still round the bones.';
    case 'gt_cairn': return 'A cairn of shells, piled for the sea.';
    default: return null;
  }
}

export function interact(run, x, y, z, b) {
  if (!isGrotto(run)) return false;
  const game = run.game;
  const p = game.player;
  const S = mine(run);
  const T = gtT(run);
  const w = game.world;
  switch (b.interact) {
    // A giant clam: shut tight with the tide in; open at low water, and a
    // pearl on its mantle, maybe. Reach in, and it may shut on your hand.
    case 'gt_clam': {
      const c = (run.data.clams || []).find((q) => q.x === x && q.z === z);
      const st = clamOf(w, x, z);
      if (st === 'shut') {
        game.ui.msg(tideLevel(run) > 0 ? 'Shut tight against the tide. It will open when the water\'s down.' : 'Shut tight. Its lips are waved like a smile.', '#c8d8e0');
        return true;
      }
      if (!c || !c.pearl || S.taken[k2(x, z)]) {
        game.ui.msg('Open, its mantle blue and spotted with light. Nothing in it.', '#c8d8e0');
        return true;
      }
      if (addItem(p.inv, 'pearl', 1) > 0) {
        game.ui.msg('You\'ve no room to carry it.', '#c8c8b8');
        return true;
      }
      S.taken[k2(x, z)] = true;
      w.setMeta(x, y, z, CLAM.open);
      game.audio?.play('pickup', { x, z });
      // (It may not like it.)
      if (Math.random() < 0.3) {
        w.setMeta(x, y, z, CLAM.shut);
        game.damage(p, 3, null);
        p.rootT = Math.max(p.rootT || 0, 1.2);
        game.renderer.floatText(x, FY + 2.4, z, 'SNAP!', '#ff8080');
        game.ui.msg('You get the pearl, and the clam snaps shut on your hand a moment before you pull it free.', '#ff9090');
        game.audio?.play('clang', { x, z });
      } else game.ui.msg('You reach in past its lips and take the pearl off its mantle. It gleams.', '#e0f0ff');
      return true;
    }
    // An offering shell: a pearl laid in it; three, and the sea-door opens.
    case 'gt_scallop': {
      const sh = (run.data.shells || []).find((q) => q.shells.some((s) => s.x === x && s.z === z));
      if (S.laid[k2(x, z)]) {
        game.ui.msg('A pearl lies in the shell, glowing softly.', '#c8f0f0');
        return true;
      }
      if (countItem(p.inv, 'pearl') <= 0) {
        game.ui.msg('A great scallop shell set on a stone, its hollow empty. The prayer asks a pearl of you.', '#c8d8e0');
        return true;
      }
      removeItem(p.inv, 'pearl', 1);
      S.laid[k2(x, z)] = true;
      w.setState(x, FY, z, true);
      game.renderer.emit(x, FY + 1, z, { n: 12, color: ['#e0fbff', '#7af0e0', '#ffffff'], up: 20, speed: 16, life: 0.8, glow: true });
      game.audio?.play('chime', { x, z });
      if (!sh) return true;
      const n = sh.shells.filter((q) => S.laid[k2(q.x, q.z)]).length;
      if (n < sh.shells.length) {
        game.ui.msg(n === 1 ? 'One for the tide that takes. The pearl glows in the shell.' : 'One for the tide that brings. Two of the shells glow.', '#c8f0f0');
        return true;
      }
      S.opened[k2(sh.door.x, sh.door.z)] = true;
      T.opening.push({ ...sh.door, t: 1.6 });
      game.ui.msg('One for the Mother. The three pearls blaze, and somewhere in the rock the sea-door groans and gives.', '#a0fff0', true);
      game.audio?.play('rumble', sh.door);
      return true;
    }
    case 'gt_seadoor':
      game.ui.msg('Driftwood bound with rope, studded with shells, three hollows in it the size of pearls. It won\'t move.', '#c8d8e0');
      return true;
    // The tide-bell: rung, and what the tide's doing.
    case 'gt_bell': {
      ring(run, x, z);
      const t = ((T.clock % TIDE.period) + TIDE.period) % TIDE.period;
      const to = (q) => Math.max(1, Math.round(q - t));
      const say = t < TIDE.flood ? `The tide is out. It will turn in about ${to(TIDE.flood)} seconds.`
        : t < TIDE.high ? 'The tide is coming in! Get up onto the rock.'
          : t < TIDE.ebb ? `High water. It will go out again in about ${to(TIDE.ebb)} seconds.`
            : t < TIDE.low ? 'The tide is going out.' : `Low water. It turns again in about ${to(TIDE.period + TIDE.flood)} seconds.`;
      game.ui.msg(`The bell rings out over the water. ${say}`, '#a0d8e8');
      return true;
    }
  }
  return false;
}
// The tide-bell rung (by you, or by the turning tide).
function ring(run, x, z) {
  const game = run.game;
  game.world.setState(x, FY, z, true);
  gtT(run).ringing.push({ x, z, t: 1.4 });
  game.audio?.play('bell', { x, z });
  game.renderer.floatText(x, FY + 3.2, z, 'dooong', '#a0d8e8');
}

// A jelly's stinging threads, left where it burst.
export function threads(run, x, z) {
  gtT(run).threads.push({ x, z, t: 5 });
}

// One of the grotto's own fallen.
export function onKill(run, e) {
  if (!isGrotto(run)) return;
  if (e.species === 'lantern_jelly') threads(run, e.x, e.z);
}

// ------------------------------------------------------------ each step
export function tick(run, dt, party) {
  if (!isGrotto(run)) return;
  const game = run.game;
  const w = game.world;
  const T = gtT(run);
  const r = game.renderer;
  const S = mine(run);
  T.clock += dt;
  const L = levelAt(T.clock);
  const p = ((T.clock % TIDE.period) + TIDE.period) % TIDE.period;
  const phase = p < TIDE.flood || p >= TIDE.low ? 'low' : p < TIDE.high ? 'flood' : p < TIDE.ebb ? 'high' : 'ebb';
  const all = () => [...party, ...run.creatures()].filter((e) => e && !e.dead);
  // The tide turning: the bells ring, and you're told.
  if (phase !== T.phase) {
    T.phase = phase;
    if (phase === 'flood') {
      for (const b of run.data.bells || []) ring(run, b.x, b.z);
      if (!T.told.flood) game.ui.msg('Somewhere a bell rings. Water is welling up through the sand: the tide is coming in! (get up onto the rock)', '#80c8e8', true);
      else game.ui.msg('The tide is turning: the water is coming in.', '#80c8e8');
      T.told.flood = true;
      game.audio?.play('wave', party[0] || null);
    } else if (phase === 'ebb') game.ui.msg('The tide is going out.', '#a0d0e0');
  }
  // The water, over the flats (and up out of the channels) as far in as
  // the tide is.
  for (const t of run.data.tide || []) {
    const k = k2(t.x, t.z);
    const want = t.deep ? L >= 0.5 : L > 0 && keyOf(t) < L;
    const has = T.wet.has(k);
    if (want === has) continue;
    const cur = w.getBlock(t.x, FY, t.z);
    if (want) {
      if (cur !== B.air) continue;
      w.setBlock(t.x, FY, t.z, B.water);
      T.wet.add(k);
      if (Math.random() < 0.3) r.emit(t.x, FY + 0.3, t.z, { n: 3, color: ['#a0d8f0', '#e0f8ff'], up: 10, speed: 10, life: 0.5 });
      // (Anyone down in a channel when it floods comes up to swim.)
      for (const e of all()) if (e.x === t.x && e.z === t.z && e.y === FY - 1) e.y = e.fy = FY;
    } else {
      if (cur === B.water) w.setBlock(t.x, FY, t.z, B.air);
      T.wet.delete(k);
    }
  }
  // The drowned divers lying on the flats rise with the high water.
  if (L >= 0.85) {
    for (const c of run.creatures()) {
      if (c.dead || !c.lying || c.species !== 'drowned_diver') continue;
      c.lying = false;
      if (c.dormant) run.wake?.(c);
      r.emit(c.x, c.y + 0.5, c.z, { n: 12, color: ['#80b8d8', '#c8e8f8', '#8a8070'], up: 30, speed: 30, gravity: 120, life: 0.7 });
      r.floatText(c.x, c.y + 2.4, c.z, 'it rises with the tide', '#80c8e8');
      if (!T.told.rise) {
        T.told.rise = true;
        game.ui.msg('Out on the flats, the drowned are getting up out of the water.', '#80c8e8', true);
      }
    }
  }
  // Anyone wading the tide (but the sea's own): slow going.
  for (const e of all()) {
    if (e.S && (e.S.swims || e.S.floats)) continue;
    if (w.getBlock(e.x, e.y, e.z) === B.water && w.getBlock(e.x, e.y - 1, e.z) !== B.water) e.tideT = 0.3;
    else if (e.tideT > 0) e.tideT -= dt;
  }
  // The clams: open at low water (a pearl on the mantle of those that
  // have one still), shut as the tide comes in.
  for (const c of run.data.clams || []) {
    const want = L > 0.15 ? 'shut' : c.pearl && !S.taken[k2(c.x, c.z)] ? 'pearl' : 'open';
    if (w.getBlock(c.x, FY, c.z) === B.gt_clam && clamOf(w, c.x, c.z) !== want) w.setMeta(c.x, FY, c.z, CLAM[want]);
  }
  // The urchins: spined, whoever steps on them. (Round 116: they're seen at
  // every tide, their spines up through the water: see groundfx.js.)
  for (const e of all()) {
    if (e.S && (e.S.floats || e.S.swims)) continue;
    if (Math.abs(e.y - FY) > 0 || w.getBlock(e.x, FY - 1, e.z) !== B.gt_urchins) continue;
    const hk = `urchin:${e.x},${e.z}`;
    if ((T.hit.get(e) || {})[hk] > T.clock) continue;
    T.hit.set(e, { ...(T.hit.get(e) || {}), [hk]: T.clock + 1.5 });
    game.damage(e, 2, null);
    e.slowT = Math.max(e.slowT || 0, 1);
    r.floatText(e.x, e.y + 2.4, e.z, 'urchin spines!', '#c8a0e0');
  }
  // The blowholes: at high water they spout, and throw whoever's on them
  // up onto the ledge above.
  for (const bh of run.data.blowholes || []) {
    const cyc = (T.clock + bh.x * 0.37) % 3;
    const on = L >= 0.85 && cyc < 1.2;
    if (!!w.getState(bh.x, FY, bh.z) !== on) w.setState(bh.x, FY, bh.z, on);
    if (!on) {
      if (L > 0 && Math.random() < dt * 2) r.emit(bh.x, FY + 0.4, bh.z, { n: 1, color: ['#e0f8ff', '#a0d8f0'], up: 14, speed: 6, life: 0.5, shape: 'puff' });
      continue;
    }
    if (Math.random() < dt * 30) r.emit(bh.x + Math.random() - 0.5, FY + 0.5 + Math.random() * 2, bh.z, { n: 1, color: ['#ffffff', '#e0f8ff', '#a0d8f0'], up: 60, speed: 8, gravity: 80, life: 0.8 });
    for (const e of party) {
      if (!e || e.dead || e.x !== bh.x || e.z !== bh.z || (T.spout.get(e) || 0) > T.clock) continue;
      T.spout.set(e, T.clock + 2);
      const top = bh.top;
      if (w.getBlock(top.x, top.y, top.z) !== B.air) continue;
      if (e.teleport) e.teleport(top.x, top.y, top.z);
      else {
        e.x = top.x;
        e.y = top.y;
        e.z = top.z;
      }
      game.renderer.camInit = false;
      r.emit(bh.x, FY + 1, bh.z, { n: 30, color: ['#ffffff', '#e0f8ff', '#a0d8f0'], up: 90, speed: 30, gravity: 120, life: 1 });
      r.floatText(top.x, top.y + 2.4, top.z, 'WHOOSH!', '#e0f8ff');
      game.audio?.play('splash', top);
      if (!T.told.blow) {
        T.told.blow = true;
        game.ui.msg('The blowhole spouts under you and throws you up, soaked, onto the ledge!', '#a0e0ff');
      }
    }
  }
  // A jelly's threads: they sting whoever comes through them.
  for (const q of T.threads) {
    q.t -= dt;
    if (Math.random() < dt * 6) r.emit(q.x + Math.random() - 0.5, FY + 0.3, q.z + Math.random() - 0.5, { n: 1, color: ['#e0ffff', '#7af0f0'], up: 4, speed: 4, life: 0.5, glow: true });
    for (const e of party) {
      if (!e || e.dead || Math.max(Math.abs(e.x - q.x), Math.abs(e.z - q.z)) > 1) continue;
      const hk = `thread:${q.x},${q.z}`;
      if ((T.hit.get(e) || {})[hk] > T.clock) continue;
      T.hit.set(e, { ...(T.hit.get(e) || {}), [hk]: T.clock + 1.2 });
      game.damage(e, 1, null);
      e.stunT = Math.max(e.stunT || 0, 0.4);
      r.floatText(e.x, e.y + 2.4, e.z, 'stung!', '#a0ffff');
    }
  }
  T.threads = T.threads.filter((q) => q.t > 0);
  // The bells' ringing dying away; the sea-door opening.
  for (const q of T.ringing) if ((q.t -= dt) <= 0) w.setState(q.x, FY, q.z, false);
  T.ringing = T.ringing.filter((q) => q.t > 0);
  for (const o of T.opening) {
    o.t -= dt;
    if (Math.random() < dt * 12) r.emit(o.x, FY + Math.random() * 2, o.z, { n: 1, color: ['#a0d8f0', '#e0d8c8'], up: 10, speed: 20, life: 0.5 });
    if (o.t <= 0) {
      for (const y of [FY, FY + 1]) if (w.getBlock(o.x, y, o.z) === B.gt_seadoor) w.setBlock(o.x, y, o.z, B.air);
      game.audio?.play('creak', o);
      game.lightDirty = true;
    }
  }
  T.opening = T.opening.filter((o) => o.t > 0);
}
export { runOf };
