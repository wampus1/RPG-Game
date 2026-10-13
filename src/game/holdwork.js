// (Round 98) The holdout at work (laid out by world/deeps/holdout.js): the
// alarm (a gong struck, the lookout's horn, the tin bells on a tripwire)
// that brings the whole den down on you; the caltrops at a choke, the hide
// pegged over a staked pit; the powder trails that burn along to the kegs
// (light one yourself), and the kegs the bruiser kicks rolling; the plunder
// crates (the ledger says which holds the take; prising the wrong ones open
// is loud), the false wall over the stash (a draft gives it away), and the
// cells: the captives in them let out with the jailer's keys or a pick,
// following you, drawing the gang off you, and if you bring them to the way
// you came in, away, and telling you where the stash is. Who you are to the
// archers once the lookout's marked you.
//
// What's been done on a floor is kept in its state (`deeps.hold`) and put
// back when the floor is made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';
import { kegBlast, BLAST_HOOKS } from '../entities/monsters.js';
import { addItem, countItem, removeItem } from './inventory.js';
import { walkTo } from './minework.js';
import { holdsFlame } from './cryptwork.js';

const key = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const solidAt = (w, x, y, z) => !!BLOCKS[w.getBlock(x, y, z)]?.solid;
const S = (run) => {
  const D = (run.state.deeps ||= { turned: {}, opened: {}, taken: {}, woke: {} });
  return (D.hold ||= { cut: {}, opened: {}, cells: {}, hides: {}, stash: false, told: false, rescued: {} });
};

// Put back what's been done on this floor.
export function restore(run) {
  const w = run.game.world;
  const st = S(run);
  const data = run.data;
  run.holdT = { rolls: [], fuse: [], draftT: 2, markT: 0 };
  for (const k of Object.keys(st.cut)) {
    const [x, z] = k.split(',').map(Number);
    if (w.getBlock(x, FY, z) === B.hold_tripwire) w.setBlock(x, FY, z, B.air);
  }
  for (const k of Object.keys(st.opened)) {
    const [x, z] = k.split(',').map(Number);
    w.setBlock(x, FY, z, B.crate_open);
  }
  for (const k of Object.keys(st.cells)) {
    const [x, z] = k.split(',').map(Number);
    if (w.getBlock(x, FY, z) === B.cell_door) w.setBlock(x, FY, z, B.cell_door_open, 0);
  }
  for (const k of Object.keys(st.hides)) {
    const [x, z] = k.split(',').map(Number);
    openPit(run, x, z);
  }
  if (st.stash && data.stash) openStash(run, true);
}

// The alarm: everyone of the gang within `r` up and after the nearest of
// you, at once.
export function alarm(run, at, by, why, r = 22) {
  const game = run.game;
  const party = run.partyHere ? run.partyHere() : [game.player];
  const p = party.filter((q) => !q.dead).sort((a, b) => dist(a, at) - dist(b, at))[0] || game.player;
  let n = 0;
  for (const c of run.creatures()) {
    if (c.dead || c.isBoss || c.waiting || c.peaceful || c.S.mode === 'passive' || dist(c, at) > r) continue;
    c.dormant = 0;
    c.resting = false;
    c.sitting = null;
    c.rang = true;
    if (!c.target || c.target.dead) c.target = p;
    n++;
  }
  run.alarmed = true;
  game.renderer.effect?.({ type: 'ring', wx: at.x, wy: FY + 1, wz: at.z, r0: 4, r1: 60, color: ['#f0c860', '#ffffff'], life: 0.9, oy: -6, flat: 0.5 });
  const msg = {
    horn: 'A horn blares from up on the scaffolds: the whole holdout knows you\'re here!',
    bells: 'Tin bells jangle on a wire across the way: they know you\'re here!',
    crate: 'The crate\'s lid shrieks off its nails. Someone heard that.',
  }[why] || 'The alarm\'s up: they know you\'re here!';
  if (by !== false) game.ui.msg(n ? msg : msg.replace(/: .*$/, '.'), '#ffb080', true);
  return n;
}

// A powder keg kicked rolling along the floor: a pace at a time, till it
// meets something (anyone, a wall), and bursts.
export function rollKeg(run, x, z, dx, dz, by) {
  if (dx && dz) dz = 0;
  if (!dx && !dz) dx = 1;
  run.game.world.setBlock(x, FY, z, B.air);
  run.holdT ||= { rolls: [], fuse: [], draftT: 2, markT: 0 };
  run.holdT.rolls.push({ x, z, dx, dz, t: 0.12, n: 10, by });
  run.game.world.setBlock(x, FY, z, B.powder_keg);
  run.game.audio?.play('crumble', { x, z });
}
// Nothing solid between a and b on the floor (a straight run).
export function lineClear(run, a, b) {
  const w = run.game.world;
  const dx = Math.sign(b.x - a.x);
  const dz = Math.sign(b.z - a.z);
  let x = a.x;
  let z = a.z;
  for (let k = 0; k < 12 && (x !== b.x || z !== b.z); k++) {
    x += dx;
    z += dz;
    if (x === b.x && z === b.z) break;
    if (solidAt(w, x, FY, z) || solidAt(w, x, FY + 1, z)) return false;
  }
  return true;
}

// A trail of powder lit: it burns along, a pace at a time, and whatever
// keg it reaches goes up.
export function ignite(run, x, z) {
  const w = run.game.world;
  if (w.getBlock(x, FY, z) !== B.hold_powder) return false;
  run.holdT ||= { rolls: [], fuse: [], draftT: 2, markT: 0 };
  if (run.holdT.fuse.some((f) => f.x === x && f.z === z)) return false;
  run.holdT.fuse.push({ x, z, t: 0.18 });
  return true;
}
// (A blast or a fire, anywhere: the powder it touches catches. See
// monsters.js, where hazards go off.)
BLAST_HOOKS.push((game, h) => {
  const run = game.dungeon;
  if (!run || run.rec.type !== 'holdout' || !run.holdT) return;
  if (h.kind !== 'fire' && h.kind !== 'burst' && h.kind !== 'blast') return;
  for (const t of h.tiles) ignite(run, t.x, t.z);
});

// A hide over a pit, gone through: the pit open, a step down, staked.
function openPit(run, x, z) {
  const w = run.game.world;
  w.setBlock(x, FY, z, B.air);
  w.setBlock(x, FY + 1, z, B.air);
  w.setBlock(x, FY - 1, z, B.spikes);
  w.setState(x, FY - 1, z, true);
  w.setBlock(x, FY - 2, z, run.T.floor);
}
// The false wall over the stash, pushed aside.
function openStash(run, quiet) {
  const game = run.game;
  const s = run.data.stash;
  if (!s) return;
  for (const y of [FY, FY + 1]) if (game.world.getBlock(s.x, y, s.z) === B.hold_false) game.world.setBlock(s.x, y, s.z, B.air);
  if (quiet) return;
  game.audio?.play('secret', s);
  game.renderer.emit(s.x, FY + 1, s.z, { n: 20, color: ['#6d5946', '#3e3128', '#a8805a'], up: 20, speed: 30, life: 0.8 });
  game.ui.msg('The rock gives under your hand: it\'s canvas, painted, over a frame. Behind it, the gang\'s stash.', '#f0d890', true);
  game.lightDirty = true;
}

// --------------------------------------------------------------- clicked
export function interact(run, x, y, z, b) {
  const game = run.game;
  const p = game.player;
  const st = S(run);
  switch (b.interact) {
    case 'plunder': {
      const k = key(x, z);
      if (st.opened[k]) return true;
      st.opened[k] = true;
      game.world.setBlock(x, FY, z, B.crate_open);
      const pl = run.data.plunder;
      const right = pl && pl.crates.some((c) => c.x === x && c.z === z && c.brand === pl.answer);
      game.renderer.emit(x, FY + 1, z, { n: 12, color: ['#a07444', '#d0bc84', '#5c3c1e'], up: 20, speed: 30, life: 0.6 });
      if (right) {
        const n = 12 + Math.floor((run.rec.level || 1) * 4);
        addItem(p.inv, 'coin', n);
        addItem(p.inv, 'gold_ingot', 1);
        game.audio?.play('coin', p);
        game.ui.msg(`Under the straw, the take: ${n} coins and a gold bar, just as the ledger said.`, '#f0d890', true);
      } else {
        const goods = [['cloth', 2], ['wheat', 3], ['coin', 3], ['iron_ingot', 1], ['bread', 2], ['leather', 2]];
        const [it, n] = goods[Math.floor(Math.random() * goods.length)];
        addItem(p.inv, it, n);
        game.audio?.play('plank_break', { x, z });
        game.ui.msg('The lid shrieks off its nails: cheap goods, and the noise carries.', '#d8c8a0');
        // (Loud: whoever's near and dozing wakes.)
        for (const c of run.creatures()) if (c.dormant && !c.waiting && !c.isBoss && dist(c, { x, z }) <= 7) run.wake(c);
      }
      return true;
    }
    case 'stash': {
      if (!run.data.stash || run.data.stash.x !== x || run.data.stash.z !== z) return false;
      st.stash = true;
      openStash(run, false);
      return true;
    }
    case 'powder': {
      if (!holdsFlame(p)) {
        game.ui.msg('A trail of black powder. It would want a flame.', '#c8c8b8');
        return true;
      }
      ignite(run, x, z);
      game.ui.msg('You put your flame to the powder: it hisses away from you along the floor.', '#ffb070', true);
      return true;
    }
  }
  return false;
}
// What a holdout's own things say when there's nothing written on them.
export const HOLD_SAY = {
  crate_open: 'An empty crate, its lid prised off.',
  hold_false: 'Cave rock. There\'s a draught from it.',
};
export const sayOf = (b) => HOLD_SAY[b.name] || null;

// A cell door clicked (in a holdout): locked till you've the jailer's keys
// or a pick for it. True if dealt with here.
export function cellDoor(run, x, y, z, p) {
  const game = run.game;
  const st = S(run);
  const cell = (run.data.cells || []).find((c) => c.door.x === x && c.door.z === z);
  if (!cell) return false;
  if (st.cells[key(x, z)]) return false;
  if (countItem(p.inv, 'cell_keys') > 0) game.ui.msg('The jailer\'s keys: the third one turns.', '#e0d0a0');
  else if (countItem(p.inv, 'lockpick') > 0) {
    removeItem(p.inv, 'lockpick', 1);
    game.ui.msg('You work a pick in the lock: a scrape, a click, and it gives (the pick snaps).', '#e0d0a0');
  } else {
    game.ui.msg('Locked fast. The jailer has the keys (or a lockpick would do it).', '#ffb080');
    game.audio?.play('locked', { x, z });
    return true;
  }
  st.cells[key(x, z)] = true;
  game.world.setBlock(x, y, z, B.cell_door_open, 0);
  game.audio?.play('unlock', { x, z });
  const c = run.creatures().find((q) => q.species === 'captive' && !q.dead && dist(q, cell.door) <= 3);
  if (c) {
    c.freed = true;
    c.follow = p;
    c.resting = false;
    c.sitting = null;
    c.dormant = 0;
    c.say?.(cell.thanks || 'You came! Get me out of here, please.', 2.6, '#e8e0c8');
  }
  return true;
}

// One of the gang down: a houndmaster's dogs go wild; a captive cut down.
export function onKill(run, e) {
  const game = run.game;
  if (e.species === 'houndmaster') {
    for (const h of run.creatures()) {
      if (h.species !== 'war_hound' || h.dead || h.wild) continue;
      if (h.master !== e && !(e.group && h.group === e.group)) continue;
      h.wild = true;
      h.master = null;
      game.renderer.floatText(h.x, h.y + 2, h.z, 'it goes wild!', '#ff8060');
      game.audio?.play('growl', h);
    }
    game.ui.msg('With their master down, the dogs go wild: anything near is fair game.', '#ffb080');
  }
  if (e.species === 'captive' && e.freed && !e.rescued) game.ui.msg('The captive is cut down before they can get away.', '#e09080', true);
}

// --------------------------------------------------------------- each frame
export function tick(run, dt, party) {
  const game = run.game;
  const w = game.world;
  if (run.rec.type !== 'holdout') return;
  if (!run.holdT) restore(run);
  const T = run.holdT;
  const st = S(run);
  // The lookout's mark: a red tick over your head, gone when it's dead.
  T.markT -= dt;
  for (const p of party) {
    if (!(p.markedT > 0)) continue;
    p.markedT -= dt;
    if (p.markedBy && p.markedBy.dead) p.markedT = 0;
    if (T.markT <= 0) game.renderer.emit(p.x, p.y + 2.6, p.z, { n: 2, color: ['#ff3020', '#ff9070'], up: 4, speed: 4, life: 0.4, glow: true });
  }
  if (T.markT <= 0) T.markT = 0.35;
  // What's underfoot: caltrops, a tripwire, a hide over a pit.
  for (const p of party) {
    if (p.dead || Math.round(p.y) !== FY) continue;
    const id = w.getBlock(p.x, FY, p.z);
    const k = key(p.x, p.z);
    if (id === B.hold_caltrops && p.caltropAt !== k) {
      p.caltropAt = k;
      game.damage(p, 2, null);
      p.slowT = Math.max(p.slowT || 0, 2);
      game.renderer.floatText(p.x, p.y + 2.2, p.z, 'caltrops!', '#d0d0d8');
    } else if (id !== B.hold_caltrops) p.caltropAt = null;
    if (id === B.hold_tripwire && !st.cut[k]) {
      st.cut[k] = true;
      w.setBlock(p.x, FY, p.z, B.air);
      game.audio?.play('bell', p);
      game.renderer.floatText(p.x, p.y + 2.2, p.z, '*jangle jangle*', '#f0d070');
      alarm(run, { x: p.x, z: p.z }, null, 'bells', 16);
    }
    if (id === B.hold_hide && !st.hides[k]) dropIn(run, p, p.x, p.z, st);
  }
  // The stakes in a pit or down a crack (a step down): every one you land
  // on, or are thrown onto, bites.
  for (const e of [...party, ...run.creatures()]) {
    if (e.dead || e.S?.floats || Math.round(e.y) !== FY - 1) {
      e.stakeAt = null;
      continue;
    }
    const k = key(e.x, e.z);
    if (e.stakeAt === k || w.getBlock(e.x, FY - 1, e.z) !== B.spikes) continue;
    e.stakeAt = k;
    game.damage(e, e.kind === 'player' ? 3 : 5, null);
    e.slowT = Math.max(e.slowT || 0, 1.2);
    game.renderer.floatText(e.x, e.y + 2, e.z, 'stakes!', '#e0b090');
  }
  // (Something heavy chasing you over the hide goes in too.)
  for (const c of run.creatures()) {
    if (c.dead || !c.S.heavy || Math.round(c.y) !== FY) continue;
    if (w.getBlock(c.x, FY, c.z) === B.hold_hide && !st.hides[key(c.x, c.z)]) dropIn(run, c, c.x, c.z, st);
  }
  // Kegs rolling.
  for (const r of T.rolls) {
    r.t -= dt;
    if (r.t > 0) continue;
    r.t = 0.11;
    r.n--;
    const nx = r.x + r.dx;
    const nz = r.z + r.dz;
    const hit = [...party, ...run.creatures()].find((o) => !o.dead && o !== r.by && o.x === nx && o.z === nz && Math.abs(o.y - FY) <= 1);
    if (hit || r.n <= 0 || solidAt(w, nx, FY, nz) || solidAt(w, nx, FY + 1, nz)) {
      r.done = true;
      kegBlast(game, r.x, FY, r.z, 0.25);
      continue;
    }
    w.setBlock(r.x, FY, r.z, B.air);
    r.x = nx;
    r.z = nz;
    w.setBlock(r.x, FY, r.z, B.powder_keg);
    game.renderer.emit(r.x, FY + 0.3, r.z, { n: 2, color: ['#5c3c1e', '#86703e'], up: 6, speed: 10, life: 0.3 });
  }
  T.rolls = T.rolls.filter((r) => !r.done);
  // Powder burning along its trail.
  const lit = [];
  for (const f of T.fuse) {
    f.t -= dt;
    if (Math.random() < dt * 20) game.renderer.emit(f.x, FY + 0.2, f.z, { n: 1, color: ['#ffe070', '#ff9030', '#ffffff'], up: 14, speed: 16, life: 0.35, glow: true });
    if (f.t > 0) continue;
    f.done = true;
    if (w.getBlock(f.x, FY, f.z) === B.hold_powder) w.setBlock(f.x, FY, f.z, B.air);
    game.audio?.play('fuse', f);
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = f.x + ox;
      const z = f.z + oz;
      const id = w.getBlock(x, FY, z);
      if (id === B.hold_powder) lit.push({ x, z });
      else if (id === B.powder_keg) kegBlast(game, x, FY, z, 0.3);
    }
  }
  T.fuse = T.fuse.filter((f) => !f.done);
  for (const q of lit) ignite(run, q.x, q.z);
  // The stash's false wall: a draught from it, now and then, if you're near
  // (and once a freed captive has told you, a gleam on it).
  const sh = run.data.stash;
  if (sh && !st.stash) {
    T.draftT -= dt;
    if (T.draftT <= 0) {
      T.draftT = st.told ? 0.6 : 2.6;
      if (party.some((p) => dist(p, sh) <= 8)) {
        game.renderer.emit(sh.x + (sh.ox || 0) * 0.5, FY + 1.2, sh.z + (sh.oz || 0) * 0.5, { n: st.told ? 3 : 1, color: st.told ? ['#ffe070', '#ffffff'] : ['#8a8070', '#b0a890'], up: 4, speed: 8, life: 1.2, glow: !!st.told });
      }
    }
  }
  // The captives let out: close behind you; the gang turning on them.
  for (const c of run.creatures()) {
    if (c.species !== 'captive' || c.dead || !c.freed || c.rescued) continue;
    c.thinkT = 9;
    const p = party.filter((q) => !q.dead).sort((a, b) => dist(a, c) - dist(b, c))[0];
    if (!p) continue;
    if (dist(c, p) > 2) walkTo(c, p, 1);
    const entry = run.data.entry;
    if (entry && dist(c, entry) <= 2 && dist(p, entry) <= 4) rescue(run, c, p, st);
    c.drawT = (c.drawT ?? 1) - dt;
    if (c.drawT <= 0) {
      c.drawT = 1.5;
      for (const o of run.creatures()) {
        if (o.dead || !o.S.bandit || o.isBoss || o.dormant || !o.target || o.target.kind !== 'player' || dist(o, c) > 7) continue;
        if (Math.random() < 0.5) {
          o.target = c;
          o.say?.(o.rng.pick(['The prisoner\'s loose!', 'Get the hostage!', 'Don\'t let them leave!']), 1.4, '#ffd080');
        }
      }
    }
  }
}

// Through the hide, onto the stakes.
function dropIn(run, who, x, z, st) {
  const game = run.game;
  st.hides[key(x, z)] = true;
  openPit(run, x, z);
  game.audio?.play('crumble', { x, z });
  game.renderer.emit(x, FY, z, { n: 14, color: ['#6a5038', '#4a3626', '#8a6e4e'], up: 20, speed: 30, life: 0.6 });
  const hurt = who.kind === 'player' ? 4 : 8;
  game.damage(who, hurt, null);
  if (who.kind === 'player') game.renderer.floatText(x, FY + 1.6, z, 'a staked pit!', '#ff9070');
  else {
    who.stunT = Math.max(who.stunT || 0, 2);
    game.renderer.floatText(x, FY + 1.6, z, 'in the pit!', '#ffd080');
  }
}

// A captive brought to the way out: away up the tunnel, and what they know
// told.
function rescue(run, c, p, st) {
  const game = run.game;
  c.rescued = true;
  st.rescued[c.spawnId ?? 'c'] = true;
  const n = 6 + Math.floor(Math.random() * 10);
  addItem(p.inv, 'coin', n);
  game.audio?.play('coin', p);
  const info = (run.data.cells || []).find((q) => q.captive === c.spawnId) || {};
  c.say?.(info.farewell || 'Bless you. I won\'t forget this.', 3, '#e8e0c8');
  if (run.data.stash && !st.stash) {
    st.told = true;
    game.ui.msg(`${info.name || 'The captive'} presses ${n} hidden coins on you, and whispers: "${info.stashHint || 'The take\'s behind a false wall. Feel for the draught.'}"`, '#f0d890', true);
  } else game.ui.msg(`${info.name || 'The captive'} presses ${n} coins they'd hidden on you, and is gone up the tunnel.`, '#f0d890', true);
  c.sporeless = true;
  game.renderer.emit(c.x, c.y + 1, c.z, { n: 10, color: ['#e8e0c8', '#a09c90'], up: 20, speed: 20, life: 0.6 });
  game.kill(c, null);
}
