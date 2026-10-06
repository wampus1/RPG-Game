// Mods at work in the game (round 62): what their graphs do to the world
// (see SVC, which the nodes call), and where the game hands things to them
// (an item used, a blow struck, a block broken, a creature's turn, the
// hour come round). Everything a mod does happens through here.
//
// (Imported last of all by game.js, so everything it reaches is ready.)
import { MODS, resolveRef } from './registry.js';
import { SVC, posOf } from './nodes.js';
import { NODES } from './graph.js';
import { gameKey } from './format.js';
import { ITEMS } from '../world/items.js';
import { B, BLOCKS } from '../world/blocks.js';
import { SPECIES } from '../entities/creature.js';
import { burn, chill, stun, mend, knockBack } from '../game/gems.js';
import { addHazard, groundFire as fireAt, areaTiles, summon as summonNear, sameSide } from '../entities/monsters.js';
import { ringTiles, proc } from '../entities/bosskit.js';
import { countItem, removeItem } from '../game/inventory.js';
import { modStat } from './stat.js';
import { charGenTick, petFell } from './chargen.js';
import { setOrder, orderTick, doingOf, leapTick } from './behave.js';
import { compareValues } from './storyrun.js';
import { townOf as townOfV, townValue, nearestTown, townFact, changeTown, personFact, changePerson, newcomerIn, peopleOf } from './towns.js';
import './build.js';
import './storyrun.js';

export { modStat };

const hexRgb = (h) => {
  const s = String(h || '#ffe070').replace('#', '');
  return [parseInt(s.slice(0, 2), 16) || 0, parseInt(s.slice(2, 4), 16) || 0, parseInt(s.slice(4, 6), 16) || 0];
};
const isEnt = (v) => !!(v && typeof v === 'object' && (v.kind === 'player' || v.kind === 'creature' || v.kind === 'monster' || v.kind === 'npc'));
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

// ------------------------------------------------------------ the runner's host
// What a graph waits on (a Wait, a line of talk) and what goes wrong in one.
export const faults = [];
MODS.host = {
  later(sec, fn, x) {
    const g = x && x.game;
    if (!g) return;
    (g.modTimers ||= []).push({ t: Math.max(0, sec), fn });
  },
  ask(x, text, choices, cb, node) {
    const g = x.game;
    const p = x.player || (x.target && x.target.kind === 'player' ? x.target : null) || (g && g.player);
    if (!g || !p) return;
    const speaker = isEnt(x.self) ? x.self : null;
    g.asPlayer(p, () => g.ui.openModTalk?.({ game: g, speaker, text, choices, onPick: (i) => g.asPlayer(p, () => cb(i)), x }));
  },
  fault(e, nodeId) {
    faults.push({ at: Date.now(), text: e && e.message ? e.message : String(e), node: nodeId || null });
    if (faults.length > 50) faults.shift();
    if (typeof console !== 'undefined' && !MODS.quiet) console.warn('mod graph:', e);
  },
};

// A context to run a graph in.
function ctx(game, rec, o = {}) {
  const self = o.self ?? null;
  const player = o.player ?? (self && self.kind === 'player' ? self : o.target && o.target.kind === 'player' ? o.target : null);
  return { game, mod: rec.mod, rec, self, target: o.target ?? null, player, pos: o.pos ?? (self ? posOf(self) : null), item: o.item ?? null, payload: o.payload, blockKey: o.blockKey ?? null };
}
// Run root output `port` of the entity with game key `key`. True if it's
// wired to anything.
export function fire(game, key, port, o = {}) {
  const rec = MODS.ents.get(key);
  if (!rec || !rec.prog.root || !rec.prog.next.has(`${rec.prog.root.id}.${port}`)) return false;
  return rec.runner.emit(port, ctx(game, rec, o));
}
const wired = (rec, port) => !!(rec && rec.prog.root && rec.prog.next.has(`${rec.prog.root.id}.${port}`));

// ------------------------------------------------------------ what the nodes do
const R = (x, v) => resolveRef(x.mod, v);
const key = (x, v) => {
  const k = R(x, v);
  return typeof k === 'string' ? k : null;
};
const thingKey = (x, v) => (v ? `${x.mod.id}:${v}` : null);

Object.assign(SVC, {
  playerName: (x) => (x.player && x.player.account && x.player.account.name) || (x.game && x.game.playerName) || 'traveller',
  nearestPlayer(x) {
    const at = posOf(x.pos) || posOf(x.self);
    let best = null;
    let bd = Infinity;
    for (const p of x.game.everyone()) {
      if (p.dead) continue;
      const d = at ? Math.hypot(p.x - at.x, p.z - at.z) : 0;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  },
  message(x, text, color, to) {
    const g = x.game;
    const say = (p) => g.asPlayer(p, () => g.ui.msg(text, color || '#ffe070'));
    if (isEnt(to) && to.kind === 'player') say(to);
    else if (x.player) say(x.player);
    else for (const p of g.everyone()) say(p);
  },
  float: (x, at, text, color) => x.game.renderer.floatText(at.x, at.y + 2, at.z, text, color || '#ffffff'),
  shout: (x, e, text, color) => e.say?.(text, 3, color || undefined),
  sound: (x, name, at) => x.game.audio?.play(name, at || null),
  vfx: (x, id, at, o) => MODS.playVfx?.(x.game, x.mod, id, at, o),
  particles: (x, at, o) => x.game.renderer.emit(at.x, at.y + 1, at.z, { oy: -4, ...o }),
  shake(x, power, at) {
    const g = x.game;
    for (const p of g.everyone()) if (!at || cheb(p, at) <= 16) g.asPlayer(p, () => (g.shake = Math.min(1.4, (g.shake || 0) + power)));
  },
  flash: (x, color, secs) => x.game.renderer.flashScreen?.(color, secs),
  damage(x, t, amount, element) {
    const g = x.game;
    const src = isEnt(x.self) && x.self !== t ? x.self : null;
    elementOn(g, src, t, element);
    if (amount > 0 && !t.dead) g.damage(t, Math.round(amount), src);
  },
  heal: (x, t, n) => mend(x.game, t, Math.round(n)),
  status: (x, t, s, secs) => giveStatus(x.game, t, s, secs, isEnt(x.self) ? x.self : null),
  applyEffect(x, t, ref, secs) {
    if (!ref) return;
    applyEffect(x.game, t, gameKey(x.mod.id, ref), secs);
  },
  knock: (x, from, t, tiles) => knockBack(x.game, from, t, Math.round(tiles)),
  teleport(x, t, to) {
    const g = x.game;
    const spot = g.findFreeSpot(to.x, to.z, to.y);
    if (t.kind === 'player') g.asPlayer(t, () => g.teleportPlayer(spot.x, spot.y, spot.z));
    else {
      g.removeOcc?.(t);
      t.teleport(spot.x, spot.y, spot.z);
      g.moveEntity?.(t, spot.x, spot.y, spot.z);
    }
  },
  kill(x, t) {
    const g = x.game;
    if (t.kind === 'player') g.damage(t, 9999, isEnt(x.self) ? x.self : null);
    else if (!t.dead) g.kill(t, isEnt(x.self) ? x.self : null);
  },
  spawn(x, ref, at, n) {
    const g = x.game;
    const k = key(x, ref);
    if (!k || !SPECIES[k]) return [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = g.findFreeSpot(at.x + (i ? Math.round((Math.random() - 0.5) * 4) : 0), at.z + (i ? Math.round((Math.random() - 0.5) * 4) : 0), at.y);
      const c = g.spawnMonster(k, s.x, s.y, s.z);
      if (c) out.push(c);
    }
    return out;
  },
  drop(x, ref, n, at) {
    const k = key(x, ref);
    if (k && ITEMS[k]) x.game.spawnDrop(k, Math.max(1, Math.round(n)), at.x, at.y, at.z, true);
  },
  loot(x, ref, at) {
    for (const d of rollLoot(MODS.loot.get(thingKey(x, ref)))) x.game.spawnDrop(d.item, d.count, at.x, at.y, at.z, true);
  },
  give(x, e, ref, n) {
    const k = key(x, ref);
    if (!k || !ITEMS[k] || !e) return;
    const g = x.game;
    n = Math.max(1, Math.round(n));
    if (e.kind === 'player') {
      const left = e.give(k, n);
      if (left) g.spawnDrop(k, left, e.x, e.y, e.z, true);
      g.asPlayer(e, () => g.audio?.play('pickup'));
    } else g.spawnDrop(k, n, e.x, e.y, e.z, true);
  },
  take(x, e, ref, n) {
    const k = key(x, ref);
    if (!k || !e || !e.inv) return false;
    n = Math.max(1, Math.round(n));
    if (countItem(e.inv, k) < n) return false;
    removeItem(e.inv, k, n);
    return true;
  },
  count: (x, e, ref) => {
    const k = key(x, ref);
    return k && e && e.inv ? countItem(e.inv, k) : 0;
  },
  setBlock(x, at, ref) {
    const k = key(x, ref);
    const id = !k || k === 'air' ? B.air : B[k];
    if (id === undefined) return;
    x.game.world.setBlock(at.x, at.y, at.z, id);
  },
  breakBlock(x, at, drops) {
    const g = x.game;
    if (drops) g.breakBlock(at.x, at.y, at.z, false);
    else g.world.setBlock(at.x, at.y, at.z, B.air);
  },
  explode: (x, at, r, dmg, blocks) => explode(x.game, at, r, dmg, blocks, isEnt(x.self) ? x.self : null),
  lightning(x, at, dmg) {
    const g = x.game;
    const y = g.world.findStandY(at.x, at.z, at.y);
    const yy = y > 0 ? y : at.y;
    const r = g.renderer;
    r.effect?.({ type: 'bolt', from: 'sky', wx: at.x, wy: yy, wz: at.z, tx: at.x, ty: yy, tz: at.z, life: 0.45, oy: -4 });
    r.emit(at.x, yy + 0.3, at.z, { n: 16, color: ['#fff8c0', '#c8e0ff', '#ffffff'], up: 50, speed: 60, gravity: 140, life: 0.6, glow: true });
    r.flashScreen?.('#e8f0ff', 0.12);
    g.audio?.play('thunder', at);
    for (const e of everyoneNear(g, at, 1)) if (e !== x.self) g.damage(e, Math.round(dmg), isEnt(x.self) ? x.self : null);
  },
  groundFire(x, at, r) {
    const g = x.game;
    for (const t of areaTiles(at.x, at.z, Math.round(r), true)) {
      const y = g.world.findStandY(t.x, t.z, at.y);
      if (y > 0) fireAt(g, t.x, t.z, y, isEnt(x.self) ? x.self : null, true);
    }
  },
  placeStructure: (x, ref, at) => MODS.placeStructure?.(x.game, x.mod, ref, at),
  startStory: (x, ref) => MODS.startStory?.(x.game, x.mod, ref, x),
  send: (x, name, value) => sendEvent(x.game, name, value, { target: x.target || x.player, pos: x.pos, from: x }),
  setVar(x, scope, name, v) {
    if (scope === 'local') x.vars[name] = v;
    else if (scope === 'world') modState(x.game).vars[`${x.mod.id}:${name}`] = v;
    else if (scope === 'player') playerVars(x)[`${x.mod.id}:${name}`] = v;
    else selfVars(x)[name] = v;
  },
  getVar(x, scope, name) {
    if (scope === 'local') return x.vars[name];
    if (scope === 'world') return modState(x.game).vars[`${x.mod.id}:${name}`];
    if (scope === 'player') return playerVars(x)[`${x.mod.id}:${name}`];
    return selfVars(x)[name];
  },
  near: (x, at, r, which) => near(x.game, at, r, which, x.self),
  once(x, id) {
    const k = `${x.rec ? x.rec.key : x.mod.id}:${id}`;
    const s = x.self && x.self.kind !== 'player' ? (x.self.modOnce ||= new Set()) : null;
    if (s) {
      if (s.has(k)) return false;
      s.add(k);
      return true;
    }
    const st = modState(x.game);
    if (st.once[k]) return false;
    st.once[k] = 1;
    return true;
  },
  cooldown(x, id, secs) {
    const g = x.game;
    const now = g.modClock || 0;
    const holder = x.self && typeof x.self === 'object' ? x.self : modState(g);
    const m = (holder.modCds ||= {});
    const k = `${x.rec ? x.rec.key : ''}:${id}`;
    if (m[k] !== undefined && now < m[k]) return false;
    m[k] = now + secs;
    return true;
  },
  randomSpot(x, at, r) {
    const g = x.game;
    if (!at) return null;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r;
      const sx = Math.round(at.x + Math.cos(a) * d);
      const sz = Math.round(at.z + Math.sin(a) * d);
      const y = g.world.findStandY(sx, sz, at.y);
      if (y > 0 && Math.abs(y - at.y) <= 3) return { x: sx, y, z: sz };
    }
    return { ...at };
  },
  isNight: (x) => !x.game.isDay(),
  hour: (x) => x.game.minute / 60,
  day: (x) => x.game.day,
  biome(x, at) {
    if (!at) return null;
    const t = x.game.world.terrain;
    try {
      return t.column(at.x, at.z, t.context(at.x, at.z, at.x, at.z), {}).biome;
    } catch {
      return null;
    }
  },
  below: (x, e) => !!(e && x.game.world.inInstance(e.x)),
  blockAt(x, at) {
    const b = BLOCKS[x.game.world.getBlock(at.x, at.y, at.z)];
    return b ? b.name : 'air';
  },
  blockKey: (x, ref) => key(x, ref) || 'air',
  itemKey: (x, ref) => key(x, ref),
  speciesKey: (x, ref) => key(x, ref),
  endTalk(x, text) {
    const g = x.game;
    const p = x.player || g.player;
    g.asPlayer(p, () => g.ui.endModTalk?.(text));
  },
  hazard: (x, o) => hazard(x, o),
  rings: (x, n, gap, dmg, color, element) => rings(x, n, gap, dmg, color, element),
  charge: (x, t, far, dmg) => charge(x, t, far, dmg),
  shoot: (x, o) => shoot(x, o),
  summon(x, ref, n) {
    const g = x.game;
    const k = key(x, ref);
    if (!k || !SPECIES[k] || !isEnt(x.self)) return;
    for (let i = 0; i < n; i++) summonNear(g, k, x.self, 3, { color: [x.mod.color || '#c8a0ff', '#ffffff'] });
  },
  blink(x, far) {
    const g = x.game;
    const c = x.self;
    if (!isEnt(c)) return;
    const t = x.target || g.findPrey?.(c, 30);
    const at = t || c;
    const s = SVC.randomSpot(x, posOf(at), Math.max(1, far));
    if (!s) return;
    g.renderer.emit(c.x, c.y + 1, c.z, { n: 14, color: [x.mod.color || '#c8a0ff', '#ffffff'], up: 30, speed: 40, life: 0.5, glow: true });
    g.removeOcc?.(c);
    c.teleport(s.x, s.y, s.z);
    g.moveEntity?.(c, s.x, s.y, s.z);
    g.renderer.emit(s.x, s.y + 1, s.z, { n: 14, color: [x.mod.color || '#c8a0ff', '#ffffff'], up: 30, speed: 40, life: 0.5, glow: true });
    g.audio?.play('portal', s);
  },
  guard(x, secs) {
    if (isEnt(x.self)) x.self.modGuardT = Math.max(x.self.modGuardT || 0, secs);
  },
  // (Round 64) Drop what someone has: in a hand, an armour slot, a slot of
  // their pack. The item's key, or null if there was nothing.
  dropFrom(x, e, o, at) {
    const g = x.game;
    if (!e || !at) return null;
    let k = null;
    let n = 0;
    const take = (slot, all) => {
      const s = e.inv && e.inv[slot];
      if (!s) return;
      k = s.item;
      n = all ? s.count : Math.min(s.count, Math.max(1, Math.round(o.n)));
      s.count -= n;
      if (s.count <= 0) e.inv[slot] = null;
    };
    if (o.from === 'the main hand') {
      if (e.kind === 'player') take(e.selected, !(o.n > 0));
      else if (e.arms && e.arms !== 'bow') {
        k = e.arms;
        n = 1;
        e.arms = null;
      }
    } else if (o.from === 'a pack slot') take(Math.max(0, Math.min(35, o.slot | 0)), !(o.n > 0));
    else if (o.from === 'the off hand' || o.from === 'an armour slot') {
      const slot = o.from === 'the off hand' ? 'shield' : o.wear || 'head';
      if (e.equip && e.equip[slot]) {
        k = e.equip[slot];
        n = 1;
        e.equip[slot] = null;
        e.recalcMaxHp?.();
      } else if (o.from === 'the off hand' && e.offhand) {
        k = e.offhand;
        n = 1;
        e.offhand = null;
      }
    }
    if (!k || !ITEMS[k] || n <= 0) return null;
    g.spawnDrop(k, n, at.x, at.y, at.z, true);
    return k;
  },
  // What a creature's been told to do (see behave.js).
  order(x, c, o) {
    if (!c || c.kind === 'player' || !c.S) return false;
    setOrder(c, o);
    return true;
  },
  doing: (x, c) => doingOf(c),
  leap(x, c, to, h) {
    const g = x.game;
    if (!c || c.kind === 'player' || !c.S || c.dead) return false;
    const s = g.findFreeSpot(Math.round(to.x), Math.round(to.z), to.y ?? c.y);
    if (!s) return false;
    const d = Math.hypot(s.x - c.x, s.z - c.z);
    c.face?.(s.x, s.z);
    c.startMove(s.x, s.y, s.z, Math.max(0.25, Math.min(1, 0.18 + d * 0.06)));
    c.moveEase = 'out';
    c.modLeap = { t: 0, dur: c.moveDur, h: Math.max(4, Math.min(40, h)) };
    g.audio?.play('whoosh', c);
    return true;
  },
  face(x, c, at) {
    if (c && at && c.face) c.face(Math.round(at.x), Math.round(at.z));
  },
  setHome(x, c, at) {
    if (c && at && c.kind !== 'player') c.home = { x: Math.round(at.x), y: Math.round(at.y ?? c.y), z: Math.round(at.z) };
  },
  temper(x, c, how, secs) {
    if (!c || c.kind === 'player' || !c.S) return;
    if (how === 'calm') {
      c.modCalm = true;
      c.angry = false;
      c.target = null;
    } else if (how === 'hostile') {
      c.modCalm = false;
      c.angry = true;
      if (isEnt(x.target) && x.target !== c) c.target = x.target;
    } else {
      c.modCalm = false;
      c.angry = false;
    }
    c.modCalmT = how !== 'its nature' && secs > 0 ? secs : 0;
    c.modCalmAs = how;
  },
  pace(x, c, k, secs) {
    if (!c || c.kind === 'player') return;
    c.modPace = Math.max(0.2, Math.min(5, k || 1));
    c.modPaceT = secs > 0 ? secs : 0;
  },
  join(x, c, p, leave) {
    if (!c || c.kind === 'player' || !c.S) return;
    if (leave) {
      if (!c.petId) c.petOf = null;
      return;
    }
    if (p && p.kind === 'player') {
      c.petOf = p;
      c.angry = false;
      c.target = null;
      setOrder(c, null);
    }
  },
  weather(x, kind, mins) {
    const g = x.game;
    const now = g.day * 24 * 60 + g.minute;
    g.modWeather = kind === 'as it would be' ? null : { kind, until: now + Math.max(1, mins) };
    if (g.weather) g.weather.t = 0;
  },
  setTime(x, how, h) {
    const g = x.game;
    const m = Math.round(h * 60);
    if (how === 'add hours') {
      const t = g.minute + m;
      g.day += Math.floor(t / 1440);
      g.minute = ((t % 1440) + 1440) % 1440;
    } else g.minute = ((m % 1440) + 1440) % 1440;
  },
  fill(x, a, b, ref) {
    const k = key(x, ref);
    const id = !k || k === 'air' ? B.air : B[k];
    if (id === undefined) return 0;
    const w = x.game.world;
    const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
    const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
    const [z0, z1] = [Math.min(a.z, b.z), Math.max(a.z, b.z)];
    let n = 0;
    // (No more than a few thousand at once.)
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let xx = x0; xx <= x1; xx++) {
      if (++n > 4096) return n - 1;
      w.setBlock(xx, y, z, id);
    }
    return n;
  },
  weatherNow(x) {
    const w = x.game.weather;
    return (w && w.kind) || 'clear';
  },
  roofed: (x, at) => !!x.game.roofed?.(at.x, at.y, at.z),
  counter(x, id, every) {
    const holder = x.self && typeof x.self === 'object' ? x.self : modState(x.game);
    const m = (holder.modCounts ||= {});
    const k = `${x.rec ? x.rec.key : ''}:${id}`;
    m[k] = (m[k] || 0) + 1;
    if (m[k] >= every) {
      m[k] = 0;
      return true;
    }
    return false;
  },
  compare: (a, op, b) => compareValues(a, op, b),
  // ------------------------------------------------------------ round 65
  // Towns and their people (see towns.js).
  townOf(x, v, how = 'the one it\'s in', kind = 'any') {
    const g = x.game;
    let s = null;
    if (how === 'by its name') s = townOfV(g, typeof v === 'string' ? v : v && v.name);
    else if (how === 'the nearest') s = nearestTown(g, posOf(v) || posOf(x.pos) || posOf(x.self) || posOf(x.player), kind);
    else s = townOfV(g, v ?? x.self ?? x.pos ?? x.player);
    return townValue(g, s);
  },
  townFact: (x, t, what) => townFact(x.game, townOfV(x.game, t ?? x.self ?? x.pos ?? x.player), what),
  changeTown: (x, t, what, o) => changeTown(x.game, townOfV(x.game, t ?? x.self ?? x.pos ?? x.player), what, { ...o, item: o.item ? key(x, o.item) : null }),
  newcomer(x, t, o) {
    const g = x.game;
    const r = newcomerIn(g, townOfV(g, t ?? x.self ?? x.pos ?? x.player), { first: o.first, job: o.job === 'any' ? null : o.job });
    if (!r) return null;
    // (Its walking self, if the town's about: else its record.)
    const act = g.active && g.active.get(r.sid);
    return (act && act.npcs.find((n) => n.rec === r)) || r;
  },
  peopleOf: (x, t, job) => peopleOf(x.game, townOfV(x.game, t ?? x.self ?? x.pos ?? x.player), job),
  personFact: (x, e, what) => personFact(x.game, e, what),
  changePerson: (x, e, what, o) => changePerson(x.game, e, what, o),
  // Another of the mod's world maps (see Game.requestCross).
  cross: (x, e, mapId, at) => x.game.requestCross?.({ who: e, map: mapId ? { mod: x.mod.id, id: mapId } : null, at }),
  worldMap(x) {
    const m = x.game.worldMap;
    if (!m) return null;
    const mod = MODS.active.find((q) => q.id === m.mod);
    const w = mod && mod.worlds && mod.worlds[m.id];
    return { mod: m.mod, id: m.id, name: w ? w.name : m.id };
  },
  // Who, by how they stand to someone (the Target node).
  target(x, e, which, r) {
    const g = x.game;
    const me = e || x.self;
    const at = posOf(me) || posOf(x.pos);
    const ok = (q) => q && !q.dead && !q.limbo;
    switch (which) {
      case 'its foe': return ok(me && me.target) ? me.target : null;
      case 'who last hurt it': return ok(me && me.modHurtBy) ? me.modHurtBy : null;
      case 'who it last hurt': return ok(me && me.modHit) ? me.modHit : null;
      case 'who it\'s following': {
        const o = me && me.modOrder;
        return ok(o && (o.kind === 'follow' || o.kind === 'hunt' || o.kind === 'keep') ? o.who : me && me.petOf) ? (o && o.who) || me.petOf : null;
      }
      case 'its owner (a companion\'s)': return ok(me && me.petOf) ? me.petOf : null;
      default:
    }
    if (!at) return null;
    if (which === 'the nearest player' || which === 'a player looking at it') {
      let best = null;
      let bd = Infinity;
      for (const p of g.everyone()) {
        if (!ok(p) || p === me) continue;
        const d = Math.hypot(p.x - at.x, p.z - at.z);
        if (d > r) continue;
        if (which === 'a player looking at it') {
          // (Facing it, near enough straight on.)
          const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.dir] || [0, 1];
          const dot = d > 0 ? ((at.x - p.x) * fx + (at.z - p.z) * fz) / d : 1;
          if (dot < 0.8) continue;
        }
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      return best;
    }
    const foes = near(g, at, r, 'foes of self', me).filter((q) => q !== me);
    if (!foes.length) return null;
    if (which === 'a random foe near') return foes[Math.floor(Math.random() * foes.length)];
    foes.sort((a, b) => (which === 'the weakest foe near' ? a.hp - b.hp : b.hp - a.hp));
    return foes[0];
  },
  // The nearest of anything (the Nearest node): { ent?, town?, pos, dist }.
  findNearest(x, at, o) {
    const g = x.game;
    const r = Math.max(1, o.r);
    const flat = (q) => Math.hypot(q.x - at.x, q.z - at.z);
    const best = (list) => {
      let b = null;
      let bd = Infinity;
      for (const q of list) {
        const d = flat(q);
        if (d <= r + 0.01 && d < bd) {
          bd = d;
          b = q;
        }
      }
      return b ? { b, d: bd } : null;
    };
    const w = o.which;
    if (w === 'a block') {
      const id = (() => {
        const k = key(x, o.block);
        return k && B[k] !== undefined ? B[k] : null;
      })();
      if (id === null) return null;
      const R0 = Math.min(16, Math.ceil(r));
      let hit = null;
      let hd = Infinity;
      for (let dy = -4; dy <= 4; dy++) for (let dz = -R0; dz <= R0; dz++) for (let dx = -R0; dx <= R0; dx++) {
        const d = Math.hypot(dx, dz) + Math.abs(dy) * 0.5;
        if (d >= hd || d > r) continue;
        if (g.world.getBlock(at.x + dx, (at.y ?? 6) + dy, at.z + dz) === id) {
          hd = d;
          hit = { x: at.x + dx, y: (at.y ?? 6) + dy, z: at.z + dz };
        }
      }
      return hit ? { pos: hit, dist: hd } : null;
    }
    if (w === 'a dropped item') {
      const k = o.item ? key(x, o.item) : null;
      const h = best(g.drops.filter((d) => !d.dead && (!k || d.item === k)));
      return h ? { pos: { x: Math.round(h.b.x), y: Math.round(h.b.y), z: Math.round(h.b.z) }, dist: h.d } : null;
    }
    if (w === 'one of your structures') {
      const h = o.structure ? best(MODS.structureSpots?.(g, x.mod.id, o.structure) || []) : null;
      return h ? { pos: h.b, dist: h.d } : null;
    }
    if (w === 'a town') {
      const s = nearestTown(g, at, o.kind);
      const t = townValue(g, s);
      if (!t) return null;
      const d = flat(t);
      return d <= r ? { town: t, pos: { x: t.x, y: t.y, z: t.z }, dist: d } : null;
    }
    let list;
    if (w === 'people (of a trade)') list = (g.npcs || []).filter((n) => !n.dead && (!o.job || o.job === 'anyone' || (n.rec && n.rec.job === o.job)));
    else if (w === 'a kind of creature') list = g.creatures.filter((c) => !c.dead);
    else list = near(g, at, r, w, x.self);
    const sp = o.species ? SVC.speciesKey(x, o.species) : null;
    list = list.filter((e) => (!sp || e.species === sp) && !(o.notSelf && e === x.self) && !e.limbo && Math.abs((e.y ?? at.y) - (at.y ?? e.y)) <= 4);
    if (o.sight && g.sim && g.sim.lineOfSight) list = list.filter((e) => g.sim.lineOfSight(Math.round(at.x), Math.round(at.z), Math.round(e.x), Math.round(e.z), (at.y ?? e.y) + 1));
    const h = best(list);
    return h ? { ent: h.b, pos: posOf(h.b), dist: h.d } : null;
  },
  // Anything about someone (the About someone node).
  entFact(x, e, what) {
    const g = x.game;
    if (!e) return what === 'name' || what === 'kind' ? '' : null;
    const at = posOf(e);
    switch (what) {
      case 'name': return e.kind === 'player' ? (e.account && e.account.name) || g.playerName || 'you' : e.rec ? `${e.rec.name.first} ${e.rec.name.last}` : e.name || (e.S && e.S.name) || e.species || '';
      case 'kind': return e.kind === 'player' ? 'player' : e.kind === 'npc' ? 'person' : e.species || e.kind;
      case 'place': return at;
      case 'health': return Math.round(e.hp ?? 0);
      case 'most health': return Math.round(e.maxHp ?? 0);
      case 'health %': return e.maxHp ? Math.round((100 * Math.max(0, e.hp)) / e.maxHp) : 0;
      case 'speed': return e.stepTime ? +(0.36 / Math.max(0.05, e.stepTime())).toFixed(2) : 1;
      case 'damage': return e.S ? e.S.dmg || 0 : 0;
      case 'facing': return ['south', 'west', 'north', 'east'][e.dir] || 'south';
      case 'place ahead': {
        const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][e.dir] || [0, 1];
        return at ? { x: at.x + fx, y: at.y, z: at.z + fz } : null;
      }
      case 'block under': return at ? SVC.blockAt(x, { x: at.x, y: at.y - 1, z: at.z }) : 'air';
      case 'biome': return SVC.biome(x, at);
      case 'town': return townValue(g, townOfV(g, e));
      case 'moving': return !!e.moving;
      case 'hostile': return e.kind === 'player' ? false : !!e.hostileNow;
      case 'its foe': return e.target && !e.target.dead ? e.target : null;
      case 'its home': return e.home ? { x: e.home.x, y: e.home.y ?? at.y, z: e.home.z } : at;
      case 'what it\'s doing': return doingOf(e);
      case 'held item': return e.heldItem ? e.heldItem() : null;
      case 'is a player': return e.kind === 'player';
      case 'is a person': return e.kind === 'npc' || !!(e.S && e.S.npc);
      case 'is a boss': return !!(e.S && e.S.boss) || !!e.isBoss;
      case 'flies': return !!(e.S && e.S.floats);
      case 'in water': return !!e.inWater;
      case 'burning': return e.burnT > 0;
      case 'conditions': return ['burnT', 'slowT', 'stunT', 'poisonT', 'bleedT', 'frozenT'].filter((k) => e[k] > 0).map((k) => k.slice(0, -1)).join(', ');
      case 'tier': return e.tier || 1;
      default: return null;
    }
  },
  playerFact(x, p, what) {
    const g = x.game;
    if (!p || p.kind !== 'player') return what === 'name' ? '' : 0;
    const hero = g.asPlayer(p, () => g.hero) || {};
    switch (what) {
      case 'name': return (p.account && p.account.name) || g.playerName || 'you';
      case 'coins': return countItem(p.inv, 'coin');
      case 'health': return Math.round(p.hp);
      case 'most health': return Math.round(p.maxHp);
      case 'stamina': return Math.round((p.stamina ?? 0) * 10) / 10;
      case 'held item': return p.heldItem();
      case 'selected slot': return (p.selected | 0) + 1;
      case 'armour %': return p.armorPct ? Math.round(p.armorPct() * 100) : 0;
      case 'items carried': return p.inv.reduce((n, q) => n + (q ? q.count : 0), 0);
      case 'empty slots': return p.inv.filter((q) => !q).length;
      case 'traits': return (hero.traits || []).join(', ');
      case 'came as': return hero.modOrigin || hero.origin || '';
      case 'fame': {
        const S = g.sim && g.sim.saga;
        const pid = S && S.players().find((q) => q.p === p)?.pid;
        return pid ? S.person(pid).fame || 0 : 0;
      }
      case 'days played': return g.day;
      case 'riding': return !!p.mount;
      case 'sleeping': return !!p.sleeping;
      case 'in a dungeon': return !!g.world.inInstance(p.x);
      case 'wanted here': {
        const s = townOfV(g, p);
        return !!(s && g.isWanted(s.id));
      }
      default: return 0;
    }
  },
  itemFact(x, ref, what) {
    const k = key(x, ref);
    const d = k && ITEMS[k];
    if (!d) return what === 'name' || what === 'kind' || what === 'worn on' ? '' : what === 'ranged' || what === 'a block' || what === 'food' ? false : 0;
    switch (what) {
      case 'name': return d.name;
      case 'kind': return d.kind || '';
      case 'value': return d.value || 0;
      case 'damage': return d.damage || 0;
      case 'armour %': return Math.round((d.armor || 0) * 100);
      case 'stack': return d.stack || 1;
      case 'heals': return d.heal || 0;
      case 'worn on': return d.slot || '';
      case 'ranged': return !!d.ranged;
      case 'a block': return d.kind === 'block';
      case 'food': return d.kind === 'food' || d.kind === 'potion';
      case 'stars': return d.stars || 0;
      default: return 0;
    }
  },
  blockFact(x, at, what) {
    if (!at) return null;
    const id = x.game.world.getBlock(at.x, at.y, at.z);
    const b = BLOCKS[id] || {};
    switch (what) {
      case 'name': return b.label || b.name || 'air';
      case 'its key': return b.name || 'air';
      case 'air': return id === B.air;
      case 'solid': return !!b.solid;
      case 'liquid': return !!(b.liquid || b.lava);
      case 'hardness': return Number.isFinite(b.hardness) ? b.hardness : 999;
      case 'light': return b.light || 0;
      case 'tool': return b.tool || 'none';
      case 'see-through': return b.opaque === false;
      case 'one of yours': return !!(b.mod && b.mod === x.mod.id) || String(b.name || '').startsWith(`m:${x.mod.id}:`);
      default: return null;
    }
  },
  abilities(x, c, nm) {
    const rec = c && c.S && MODS.ents.get(c.S.modKey);
    if (!rec) return null;
    const abs = rec.prog.starts.filter((n) => n.type === 'ev.ability');
    const cd = c.modAbCd || {};
    const ready = abs.filter((n) => !(cd[n.id] > 0));
    const named = (nm) => abs.find((n) => String((n.v || {}).name || '').toLowerCase() === String(nm || '').toLowerCase());
    return {
      n: abs.length, ready: ready.length, next: ready.length ? String((ready[0].v || {}).name || '') : '', names: abs.map((n) => (n.v || {}).name || '').join(', '),
      left: (() => {
        const q = named(nm);
        return q ? Math.max(0, +(cd[q.id] || 0).toFixed(1)) : 0;
      })(),
      casting: !!c.modCast,
    };
  },
  structInfo(x, ref, at, r) {
    const g = x.game;
    const spots = ref ? MODS.structureSpots?.(g, x.mod.id, ref) || [] : [];
    if (!spots.length) return { pos: null, n: 0, dist: 0, busy: false };
    let b = spots[0];
    let bd = Infinity;
    for (const s of spots) {
      const d = at ? Math.hypot(s.x - at.x, s.z - at.z) : 0;
      if (d < bd) {
        bd = d;
        b = s;
      }
    }
    return { pos: b, n: spots.length, dist: at ? Math.round(bd) : 0, busy: near(g, b, r, 'players').length > 0 };
  },
});

// The values kept for the world (saved with it).
export function modState(game) {
  return (game.modState ||= { vars: {}, once: {}, blocks: {}, events: {}, killed: {}, trig: {} });
}
// (Round 63) Kept with the player's character: what they chose on the
// character screen (each row's choice by its id, and the values its
// options set), and whatever a graph keeps there.
function playerVars(x) {
  const g = x.game;
  const p = x.player && x.player.kind === 'player' ? x.player : x.self && x.self.kind === 'player' ? x.self : x.target && x.target.kind === 'player' ? x.target : g.player;
  const hero = p ? g.asPlayer(p, () => g.hero) : g.hero;
  return hero ? (hero.modFlags ||= {}) : modState(g).vars;
}

function selfVars(x) {
  if (x.self && typeof x.self === 'object') return (x.self.modVars ||= {});
  if (x.blockKey) return (modState(x.game).blocks[x.blockKey] ||= {});
  return modState(x.game).vars;
}

// Those near a place: players, creatures, people, or the foes of `self`.
export function near(game, at, r, which = 'everyone', self = null) {
  const out = [];
  const close = (e) => e && !e.dead && !e.down && !e.limbo && Math.hypot(e.x - at.x, e.z - at.z) <= r + 0.01 && Math.abs((e.y ?? at.y) - (at.y ?? e.y)) <= 3;
  const players = game.everyone().filter(close);
  const creatures = game.creatures.filter(close);
  const npcs = (game.npcs || []).filter(close);
  if (which === 'players') return players;
  if (which === 'creatures') return creatures;
  if (which === 'foes of self') {
    if (!self || self.kind === 'player') return creatures.filter((c) => c.hostileNow || c.S?.boss);
    if (self.hostileNow || self.S?.boss) return [...players, ...npcs].filter((e) => !sameSide(self, e));
    return creatures.filter((c) => c.hostileNow);
  }
  out.push(...players, ...creatures, ...npcs);
  return out;
}
const everyoneNear = (game, at, r) => near(game, at, r, 'everyone');

// ------------------------------------------------------------ harm and help
// An element's own harm, besides the blow.
function elementOn(game, src, t, element) {
  if (!t || t.dead) return;
  if (element === 'fire') burn(game, t, src, 3);
  else if (element === 'frost') chill(t, 2.5);
  else if (element === 'shock') {
    stun(t, 0.8);
    game.renderer.emit(t.x, t.y + 1, t.z, { n: 8, color: ['#fff8a0', '#a0d0ff'], up: 20, speed: 50, life: 0.3, glow: true });
  } else if (element === 'poison') giveStatus(game, t, 'poison', 4, src);
  else if (element === 'force' && src) knockBack(game, src, t, 2);
}

// The plain conditions (burning, chilled, ...): some the game's own, the
// rest kept on whoever has them (see tickEffects).
const BUILTIN = {
  poison: { color: '#8ac040', regen: -1, name: 'Poisoned' },
  haste: { color: '#ffe070', speed: 40, name: 'Quickened' },
  slow: { color: '#80a0c0', speed: -40, name: 'Slowed' },
  regen: { color: '#80e070', regen: 1, name: 'Mending' },
  weak: { color: '#a07070', damage: -30, name: 'Weakened' },
  shield: { color: '#a0d0ff', armor: 30, name: 'Shielded' },
};
export function giveStatus(game, t, s, secs, src = null) {
  if (!t || t.dead) return;
  if (s === 'burn') return burn(game, t, src, secs);
  if (s === 'chill') return chill(t, secs);
  if (s === 'stun') return stun(t, secs);
  if (s === 'haste' && t.kind !== 'player') {
    t.hasteT = Math.max(t.hasteT || 0, secs);
    return null;
  }
  if (s === 'slow' && t.kind !== 'player') {
    t.slowT = Math.max(t.slowT || 0, secs);
    return null;
  }
  const B0 = BUILTIN[s];
  if (!B0) return null;
  const list = (t.modFx ||= []);
  const now = game.modClock || 0;
  const had = list.find((q) => q.builtin === s);
  if (had) had.until = Math.max(had.until, now + secs);
  else list.push({ builtin: s, def: B0, until: now + secs, tickT: 1, name: B0.name, color: B0.color });
  return null;
}

// One of a mod's Effects, on someone for `secs`.
export function applyEffect(game, t, effKey, secs) {
  const rec = MODS.effects.get(effKey);
  if (!rec || !t || t.dead) return;
  const list = (t.modFx ||= []);
  const now = game.modClock || 0;
  const had = list.find((q) => q.key === effKey);
  const f = rec.f;
  if (had) {
    if (f.stack === 'ignore') return;
    had.until = f.stack === 'add time' ? had.until + secs : Math.max(had.until, now + secs);
    return;
  }
  const q = { key: effKey, rec, until: now + secs, tickT: 1, name: f.name, color: f.color, vfx: null };
  list.push(q);
  if (f.vfx) q.vfx = MODS.playVfx?.(game, rec.mod, f.vfx, t, { follow: true, loop: true });
  fire(game, effKey, 'onApply', { self: t });
}

function tickEffects(game, e, dt) {
  const list = e.modFx;
  if (!list || !list.length) return;
  const now = game.modClock || 0;
  for (const q of list) {
    if (q.until <= now) {
      q.gone = true;
      if (q.vfx) MODS.stopVfx?.(game, q.vfx);
      if (q.key) fire(game, q.key, 'onExpire', { self: e });
      continue;
    }
    q.tickT -= dt;
    if (q.tickT > 0) continue;
    q.tickT += 1;
    const d = q.rec ? q.rec.f : q.def;
    const regen = d && typeof d.regen === 'number' ? d.regen : 0;
    if (regen > 0 && e.hp < e.maxHp) mend(game, e, regen);
    else if (regen < 0 && !e.dead) {
      game.dotHit = true;
      try {
        game.damage(e, Math.max(1, Math.round(-regen)), null);
      } finally {
        game.dotHit = false;
      }
    }
    if (q.key) fire(game, q.key, 'onTick', { self: e });
  }
  e.modFx = list.filter((q) => !q.gone);
}

// A blast: everyone in it hurt (and thrown back), the blocks round it
// broken if it's that kind.
function explode(game, at, r, dmg, blocks, by) {
  const ren = game.renderer;
  ren.effect?.({ type: 'blast', wx: at.x, wy: at.y, wz: at.z, r1: 14 * r, life: 0.5, oy: 2 });
  ren.effect?.({ type: 'ring', wx: at.x, wy: at.y, wz: at.z, r0: 4, r1: 16 * r, color: ['#ffe070', '#ff9030'], life: 0.4, oy: 4, flat: 0.5, thick: 2 });
  ren.emit(at.x, at.y + 1, at.z, { n: 10 + r * 6, color: ['#ff9030', '#ffe070', '#5a5048'], up: 40, speed: 70, gravity: 120, life: 0.7 });
  game.audio?.play('boom', at);
  for (const p of game.everyone()) if (cheb(p, at) <= r + 8) game.asPlayer(p, () => (game.shake = Math.min(1.4, (game.shake || 0) + 0.3 + r * 0.1)));
  for (const e of everyoneNear(game, at, r)) {
    if (e === by) continue;
    game.damage(e, Math.round(dmg * (1 - Math.hypot(e.x - at.x, e.z - at.z) / (r + 1) * 0.5)), by);
    if (!e.dead) knockBack(game, at, e, 2);
  }
  if (!blocks) return;
  const w = game.world;
  for (let dy = -r; dy <= r; dy++) for (const t of areaTiles(at.x, at.z, r, true)) {
    const y = at.y + dy;
    const id = w.getBlock(t.x, y, t.z);
    const b = BLOCKS[id];
    if (!b || id === B.air || !isFinite(b.hardness) || b.liquid || b.interact === 'container') continue;
    if (Math.hypot(t.x - at.x, t.z - at.z, dy) > r + 0.3) continue;
    w.setBlock(t.x, y, t.z, B.air);
  }
}

// ------------------------------------------------------------ attacks
function hazard(x, o) {
  const g = x.game;
  const c = x.self;
  const at = o.at || posOf(c);
  if (!at) return;
  const t = x.target || (isEnt(c) ? g.findPrey?.(c, 30) : null);
  const r = Math.max(1, Math.round(o.r));
  let tiles = [];
  const dir = t ? [Math.sign(Math.round(t.x - at.x)), Math.sign(Math.round(t.z - at.z))] : [1, 0];
  if (!dir[0] && !dir[1]) dir[0] = 1;
  if (o.shape === 'ring') tiles = ringTiles(at.x, at.z, r);
  else if (o.shape === 'circle') tiles = areaTiles(at.x, at.z, r, true);
  else if (o.shape === 'line') for (let k = 1; k <= r * 2; k++) tiles.push({ x: at.x + dir[0] * k, z: at.z + dir[1] * k });
  else if (o.shape === 'cross') for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 1; k <= r * 2; k++) tiles.push({ x: at.x + dx * k, z: at.z + dz * k });
  else {
    // A cone, widening toward the foe.
    for (let k = 1; k <= r * 2; k++) for (let s = -Math.floor(k / 2); s <= Math.floor(k / 2); s++) tiles.push({ x: at.x + dir[0] * k + (dir[1] ? s : 0), z: at.z + dir[1] * k + (dir[0] ? s : 0) });
  }
  const h = { by: isEnt(c) ? c : null, tiles, y: at.y, dur: Math.max(0.1, o.windup), kind: o.shape === 'ring' || o.shape === 'circle' ? 'slam' : 'burst', center: { x: at.x, z: at.z }, radius: r, dmg: Math.round(o.dmg), color: hexRgb(o.color), from: { x: at.x, z: at.z + 0.001 } };
  if (o.element === 'fire') h.burn = 2;
  else if (o.element === 'frost') h.chill = 2;
  else if (o.element === 'shock') h.stun = 0.8;
  else if (o.element === 'force') h.knock = 2;
  addHazard(g, h);
}

function rings(x, n, gap, dmg, color, element) {
  const g = x.game;
  const c = x.self;
  if (!isEnt(c)) return;
  const t = x.target || g.findPrey?.(c, 30);
  let gapA = t ? Math.atan2(t.z - c.z, t.x - c.x) + Math.PI : Math.random() * Math.PI * 2;
  const base = (c.foot || 0) + 2;
  proc(g, c, gap, n, (k) => {
    const r = base + k * 2;
    gapA += Math.PI * (0.6 + Math.random() * 0.8);
    const tiles = ringTiles(c.x, c.z, r).filter((q) => {
      let d = Math.atan2(q.z - c.z, q.x - c.x) - gapA;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      return Math.abs(d) * r > 1.6;
    });
    const h = { by: c, tiles, y: c.y, dur: 0.85, kind: 'burst', center: { x: c.x, z: c.z }, from: { x: c.x, z: c.z + 0.001 }, dmg: Math.round(dmg), color: hexRgb(color), quiet: k > 0 };
    if (element === 'fire') h.burn = 2;
    else if (element === 'frost') h.chill = 2;
    else if (element === 'shock') h.stun = 0.8;
    else if (element === 'force') h.knock = 1;
    addHazard(g, h);
  });
  g.audio?.play('pulse', c);
}

function charge(x, t, far, dmg) {
  const g = x.game;
  const c = x.self;
  if (!isEnt(c) || !t) return;
  const dx = Math.sign(Math.round(t.x - c.x));
  const dz = Math.sign(Math.round(t.z - c.z));
  const ux = Math.abs(t.x - c.x) >= Math.abs(t.z - c.z) ? dx || 1 : 0;
  const uz = ux ? 0 : dz || 1;
  const path = [];
  let y = c.y;
  let px = c.x;
  let pz = c.z;
  for (let k = 1; k <= far; k++) {
    const ny = g.world.stepTarget(px, y, pz, px + ux, pz + uz, false);
    if (ny < 0) break;
    px += ux;
    pz += uz;
    y = ny;
    path.push({ x: px, z: pz, y });
  }
  if (!path.length) return;
  addHazard(g, { by: c, tiles: path.map((q) => ({ x: q.x, z: q.z })), y: c.y, dur: 0.55, kind: 'burst', dmg: Math.round(dmg), knock: 2, center: { x: path[path.length - 1].x, z: path[path.length - 1].z }, from: { x: c.x, z: c.z }, color: [255, 200, 120] });
  // (It goes, as the blow lands.)
  proc(g, c, 0.55, 1, () => {
    const end = path[path.length - 1];
    g.removeOcc?.(c);
    c.teleport(end.x, end.y, end.z);
    g.moveEntity?.(c, end.x, end.y, end.z);
    for (const q of path) g.renderer.emit(q.x, q.y + 0.2, q.z, { n: 2, color: ['#a89878', '#c8b898'], up: 12, speed: 20, life: 0.4, shape: 'puff' });
    g.audio?.play('stomp', end);
  });
}

// Shots of a mod's own (a Projectile entity, or a plain bolt of colour):
// flown and drawn here (see tickShots, and render.js).
function shoot(x, o) {
  const g = x.game;
  const c = isEnt(x.self) ? x.self : x.player;
  const from = posOf(x.self) || posOf(x.pos);
  const to = o.at ? posOf(o.at) : null;
  if (!from || !to) return;
  let P = null;
  if (typeof o.proj === 'string' && o.proj) P = MODS.ents.get(gameKey(x.mod.id, o.proj)) || null;
  const f = P ? P.f : {};
  const speed = P ? Math.max(2, f.speed || 12) : 12;
  const base = Math.atan2(to.z - from.z, to.x - from.x);
  const n = Math.max(1, Math.min(12, Math.round(o.n)));
  const spread = ((o.spread || 0) * Math.PI) / 180;
  const dist = Math.max(1, Math.hypot(to.x - from.x, to.z - from.z));
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? base : base - spread / 2 + (spread * i) / (n - 1);
    const lob = P ? f.path === 'lobbed' : false;
    (g.modShots ||= []).push({
      x: from.x, y: from.y + 1, z: from.z, vx: Math.cos(a) * speed, vz: Math.sin(a) * speed, t: 0, life: lob ? dist / speed : Math.min(4, 22 / speed + 0.3), lob, arc: lob ? 1 + dist * 0.15 : 0, y0: from.y + 1,
      by: c, dmg: P ? f.damage ?? o.dmg : o.dmg, radius: P ? f.radius || 0 : 0, element: P ? f.element || 'none' : o.element, color: o.color || '#ff9040',
      mod: x.mod, look: P ? f.look || null : null, trail: P ? f.trail || null : null, burst: P ? f.burst || null : null, proj: P, onHit: o.onHit, trailT: 0,
    });
    // (Seen by the players of a world hosted here too: see render.js.)
    const s = g.modShots[g.modShots.length - 1];
    g.renderer?.modShot?.(x.mod.id, s.look, s.color, s.x, s.y, s.z, s.vx, s.vz, s.life, s.lob, s.arc);
  }
  g.audio?.play(P ? 'whoosh' : 'orb', from);
}

function tickShots(game, dt) {
  const list = game.modShots;
  if (!list || !list.length) return;
  const w = game.world;
  for (const s of list) {
    s.t += dt;
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    if (s.lob) {
      const k = Math.min(1, s.t / s.life);
      s.y = s.y0 + Math.sin(k * Math.PI) * s.arc;
    }
    s.trailT -= dt;
    if (s.trail && s.trailT <= 0) {
      s.trailT = 0.08;
      MODS.playVfx?.(game, s.mod, s.trail, { x: Math.round(s.x), y: Math.round(s.y - 1), z: Math.round(s.z) }, { scale: 0.6 });
    }
    const tx = Math.round(s.x);
    const tz = Math.round(s.z);
    const ty = Math.round(s.y - 1);
    let hit = null;
    if (!s.lob || s.t >= s.life) {
      for (const e of near(game, { x: s.x, y: ty, z: s.z }, 0.75, 'everyone')) {
        if (e === s.by || sameSide(s.by, e) || (s.by && s.by.kind !== 'player' && e.kind !== 'player' && e.kind !== 'npc' && s.by.hostileNow && e.hostileNow)) continue;
        hit = e;
        break;
      }
    }
    const b = BLOCKS[w.getBlock(tx, Math.round(s.y), tz)];
    const wall = b && b.solid && !s.lob;
    if (!hit && !wall && s.t < s.life) continue;
    s.done = true;
    const at = { x: tx, y: Math.max(1, ty), z: tz };
    if (s.burst) MODS.playVfx?.(game, s.mod, s.burst, at, {});
    else game.renderer.emit(at.x, at.y + 1, at.z, { n: 10, color: [s.color, '#ffffff'], up: 30, speed: 50, life: 0.45, glow: true });
    const victims = s.radius > 0 ? near(game, at, s.radius, 'everyone').filter((e) => e !== s.by && !sameSide(s.by, e)) : hit ? [hit] : [];
    for (const e of victims) {
      elementOn(game, s.by, e, s.element);
      if (s.dmg > 0 && !e.dead) game.damage(e, Math.round(s.dmg), s.by || null);
    }
    if (s.proj) fire(game, s.proj.key, 'onHit', { self: s.by, target: hit, pos: at });
    try {
      s.onHit?.({ target: hit, pos: at });
    } catch (e) {
      MODS.host.fault(e);
    }
  }
  game.modShots = list.filter((s) => !s.done);
}

// ------------------------------------------------------------ loot tables
// What a loot table gives, rolled: [{ item, count }]. A table: { rolls:
// [min, max], entries: [{ item, w, min, max }], always: [{ item, min, max,
// chance }] }.
export function rollLoot(t, rand = Math.random) {
  const out = [];
  if (!t) return out;
  const tab = t.v || t;
  const mod = t.mod || null;
  const res = (k) => {
    const v = mod ? resolveRef(mod, k) : k;
    return ITEMS[v] ? v : null;
  };
  for (const a of tab.always || []) {
    if (rand() * 100 >= (a.chance ?? 100)) continue;
    const k = res(a.item);
    if (k) out.push({ item: k, count: (a.min ?? 1) + Math.floor(rand() * ((a.max ?? a.min ?? 1) - (a.min ?? 1) + 1)) });
  }
  const ents = (tab.entries || []).filter((e) => res(e.item) && (e.w ?? 1) > 0);
  const [r0, r1] = tab.rolls || [1, 2];
  const rolls = r0 + Math.floor(rand() * (r1 - r0 + 1));
  const total = ents.reduce((s, e) => s + (e.w ?? 1), 0);
  for (let i = 0; i < rolls && total > 0; i++) {
    let r = rand() * total;
    const e = ents.find((q) => (r -= q.w ?? 1) < 0) || ents[ents.length - 1];
    out.push({ item: res(e.item), count: (e.min ?? 1) + Math.floor(rand() * ((e.max ?? e.min ?? 1) - (e.min ?? 1) + 1)) });
  }
  // (The same thing twice: one heap.)
  const m = new Map();
  for (const d of out) m.set(d.item, (m.get(d.item) || 0) + d.count);
  return [...m].map(([item, count]) => ({ item, count: Math.min(count, ITEMS[item].stack || 64) }));
}

// A chest filled from a loot table: `size` slots.
export function lootSlots(t, size, rand = Math.random) {
  const slots = new Array(size).fill(null);
  for (const d of rollLoot(t, rand)) {
    for (let k = 0; k < size * 2; k++) {
      const i = Math.floor(rand() * size);
      if (!slots[i]) {
        slots[i] = d;
        break;
      }
    }
  }
  return slots;
}

// ------------------------------------------------------------ events
// Every event of a name heard (a World event set to it, an On event node
// in any graph). For creatures' graphs, each of that kind alive hears it.
export function sendEvent(game, name, value, o = {}) {
  if (!name) return;
  const depth = (o.from && o.from.sendDepth) || 0;
  if (depth > 8) return;
  // (Heard by the stories too: see storyrun.js, Wait for.)
  game.sim?.saga?.emit('mod_event', { name, value, pos: o.pos ? { x: o.pos.x, z: o.pos.z } : null });
  for (const rec of MODS.events) {
    if (rec.f.when !== 'custom event' || String(rec.f.custom) !== name) continue;
    worldEvent(game, rec, { payload: value, target: o.target, pos: o.pos, sendDepth: depth + 1 });
  }
  for (const rec of MODS.ents.values()) {
    for (const n of rec.prog.starts) {
      if (n.type !== 'ev.custom') continue;
      if (String((n.v && n.v.name) ?? 'my_event') !== name) continue;
      const run = (self) => {
        const x = rec.runner.ctx({ ...ctx(game, rec, { self, target: o.target, pos: o.pos, payload: value }), sendDepth: depth + 1 });
        rec.runner.fire(x, n.id, 'fire');
      };
      if (rec.kind === 'creature') for (const c of game.creatures) if (!c.dead && c.species === rec.key) run(c);
      if (rec.kind !== 'creature') run(null);
    }
  }
}

function worldEvent(game, rec, o = {}) {
  const f = rec.f;
  const st = modState(game);
  if (f.once && st.events[rec.key]) return;
  if (Math.random() * 100 >= (typeof f.chance === 'number' ? f.chance : 100)) return;
  st.events[rec.key] = (st.events[rec.key] || 0) + 1;
  const x = rec.runner.ctx({ ...ctx(game, rec, o), sendDepth: o.sendDepth || 0 });
  rec.runner.fire(x, rec.prog.root.id, 'fire');
}

// ------------------------------------------------------------ the game calls these
// A mod's item used (right button). True if it did anything.
export function modUse(game, p, def) {
  const rec = def && def.key && MODS.ents.get(def.key);
  if (!rec) return false;
  if (rec.kind === 'item' && rec.tpl !== 'tpl.food' && wired(rec, 'onUse')) {
    fire(game, def.key, 'onUse', { self: p, player: p, item: def.key });
    p.doAction?.(0.3);
    return true;
  }
  return false;
}

// A mod's food eaten (after the game's own healing).
export function modEaten(game, p, def) {
  const rec = MODS.ents.get(def.key);
  if (!rec) return;
  if (rec.f.effect) applyEffect(game, p, gameKey(rec.mod.id, rec.f.effect), Math.max(1, rec.f.effectSecs || 30));
  fire(game, def.key, 'onUse', { self: p, player: p, target: p, item: def.key });
}

// A blow landed (by anyone, on anyone).
export function modStruck(game, a, v, amount) {
  if (!a || !v) return;
  // (Round 65) Who struck whom last (for the Target node).
  a.modHit = v;
  v.modHurtBy = a;
  if (a.kind === 'player') {
    const k = a.heldItem ? a.heldItem() : null;
    const it = k && ITEMS[k];
    if (it && it.mod) {
      if (it.modElement) elementOn(game, a, v, it.modElement);
      if (it.modKnock > 0 && !v.dead) knockBack(game, a, v, Math.round(it.modKnock));
      fire(game, k, 'onHit', { self: a, player: a, target: v, item: k, pos: posOf(v) });
    }
  } else if (a.S && a.S.modKey) fire(game, a.S.modKey, 'onAttack', { self: a, target: v });
}

// (Round 64) A mod's weapon swung (or shot); a blow taken on a mod's shield.
export function modSwung(game, p, shot) {
  const k = p && p.heldItem ? p.heldItem() : null;
  if (k && ITEMS[k] && ITEMS[k].mod) fire(game, k, shot ? 'onShoot' : 'onSwing', { self: p, player: p, item: k, pos: posOf(p), target: p.swing?.target || null });
}
export function modBlockedBlow(game, v, a) {
  const k = v && v.equip && v.equip.shield;
  if (k && ITEMS[k] && ITEMS[k].mod) fire(game, k, 'onBlock', { self: v, player: v.kind === 'player' ? v : null, target: a, item: k, pos: posOf(v) });
}

// Someone hurt (after armour): their own graph, their worn pieces', a
// master's phases.
export function modHurt(game, t, src, amount) {
  if (t.S && t.S.modKey) {
    fire(game, t.S.modKey, 'onHurt', { self: t, target: src });
    if (t.S.boss) bossPhases(game, t);
  }
  if (t.kind === 'player' && t.equip) {
    for (const k of Object.values(t.equip)) if (k && ITEMS[k] && ITEMS[k].mod) fire(game, k, 'onHurt', { self: t, player: t, target: src });
  }
}

// How much a blow comes to, with what's on the striker and the struck.
export function modScaleDamage(t, src, amount) {
  if (t && t.modGuardT > 0) return 0;
  let a = amount;
  const up = src ? modStat(src, 'damage') : 0;
  if (up) a *= 1 + up / 100;
  const arm = t ? modStat(t, 'armor') : 0;
  if (arm) a *= Math.max(0.1, 1 - arm / 100);
  return a;
}

// Something killed.
export function modKilled(game, e, src) {
  // (Someone's companion: back in the morning.)
  if (e.petId) petFell(game, e);
  // (One of a structure's people or beasts: gone, till it comes again.)
  if (e.modMark) {
    const st = modState(game);
    (st.killed ||= {})[e.modMark] = game.sim ? game.sim.abs : game.modClock || 1;
  }
  if (src && src.kind === 'player') {
    const k = src.heldItem ? src.heldItem() : null;
    if (k && ITEMS[k] && ITEMS[k].mod) fire(game, k, 'onKill', { self: src, player: src, target: e, item: k, pos: posOf(e) });
  }
  if (e.S && e.S.modKey) {
    const S = e.S;
    if (S.modLoot) for (const d of rollLoot(MODS.loot.get(S.modLoot))) game.spawnDrop(d.item, d.count, e.x, e.y, e.z, true);
    if (S.boss && S.modDeath) e.say?.(S.modDeath, 3, '#ffd0a0');
    fire(game, S.modKey, 'onDeath', { self: e, target: src });
  }
  for (const rec of MODS.events) {
    if (rec.f.when !== 'killed') continue;
    const want = rec.f.creature ? resolveRef(rec.mod, rec.f.creature) : null;
    if (want && e.species !== want) continue;
    worldEvent(game, rec, { target: src, pos: posOf(e), payload: e.species || e.kind });
  }
}

// A block's events.
export function modBlockBroken(game, x, y, z, id, byPlayer) {
  const rec = MODS.blocks.get(id);
  const p = byPlayer ? game.player : null;
  if (p) {
    const k = p.heldItem();
    if (k && ITEMS[k] && ITEMS[k].mod) fire(game, k, 'onBreak', { self: p, player: p, pos: { x, y, z }, item: k });
  }
  if (!rec) return;
  if (rec.f.loot) for (const d of rollLoot(MODS.loot.get(`${rec.mod.id}:${rec.f.loot}`))) game.spawnDrop(d.item, d.count, x, y, z, true);
  fire(game, rec.key, 'onBreak', { target: p, player: p, pos: { x, y, z }, blockKey: `${x},${y},${z}` });
  delete modState(game).blocks[`${x},${y},${z}`];
}
export function modBlockPlaced(game, x, y, z, id) {
  const rec = MODS.blocks.get(id);
  if (rec) fire(game, rec.key, 'onPlace', { target: game.player, player: game.player, pos: { x, y, z }, blockKey: `${x},${y},${z}` });
}
export function modBlockUse(game, x, y, z, id) {
  const rec = MODS.blocks.get(id);
  if (!rec) return false;
  return fire(game, rec.key, 'onUse', { target: game.player, player: game.player, pos: { x, y, z }, blockKey: `${x},${y},${z}` });
}

// A creature of a mod's: right-clicked (a person: talked to).
export function modTalk(game, p, c) {
  const S = c && c.S;
  if (!S || !S.modKey) return false;
  const port = S.npc ? 'onTalk' : 'onUse';
  if (!wired(MODS.ents.get(S.modKey), port)) {
    if (S.npc) {
      c.face?.(p.x, p.z);
      c.say?.(['Hm?', 'Good day.', 'Well met.'][Math.floor(Math.random() * 3)], 2.5);
      return true;
    }
    return false;
  }
  c.face?.(p.x, p.z);
  c.talkT = 6;
  fire(game, S.modKey, port, { self: c, target: p, player: p });
  return true;
}

// ------------------------------------------------------------ creatures
// A mod creature's turn (before its kind's own way of moving). True if
// it's busy (winding up an ability, talking).
export function modBrain(c, dt) {
  const S = c.S;
  const rec = S && MODS.ents.get(S.modKey);
  if (!rec) return false;
  const game = c.game;
  if (!c.modBorn) {
    c.modBorn = true;
    c.modTickT = rec.f.tick || 1;
    if (S.boss) c.modPhase = 1;
    fire(game, rec.key, S.boss ? 'onWake' : 'onSpawn', { self: c });
    if (S.boss && S.modIntro) c.say?.(S.modIntro, 3.5, '#ffd0a0');
  }
  // (Talking: it stands and faces you.)
  if (c.talkT > 0) {
    c.talkT -= dt;
    return true;
  }
  // (Its clocks: see creatureClock, every frame.)
  // A foe seen for the first time.
  if (c.target && c.target !== c.modSeen) {
    c.modSeen = c.target;
    fire(game, rec.key, 'onSee', { self: c, target: c.target });
  }
  // Winding up an ability.
  if (c.modCast) {
    const q = c.modCast;
    q.t -= dt;
    if (q.t > 0) return true;
    c.modCast = null;
    const x = rec.runner.ctx(ctx(game, rec, { self: c, target: q.target }));
    rec.runner.fire(x, q.node.id, 'cast');
    c.attackCd = Math.max(c.attackCd || 0, 0.6);
    return true;
  }
  // An ability ready, its foe in range: begun.
  if (c.hostileNow && c.target && !c.target.dead && !c.windup && !c.moving) {
    const ab = pickAbility(c, rec);
    if (ab) {
      const v = ab.v || {};
      const cds = (c.modAbCd ||= {});
      cds[ab.id] = Math.max(0.5, v.cooldown ?? 6) * (c.tier >= 3 ? 0.67 : c.tier === 2 ? 0.83 : 1);
      const wind = Math.max(0, v.windup ?? 0.8) / (c.tempo || 1);
      c.face?.(c.target.x, c.target.z);
      if ((ab.p || {}).shout !== false && v.name) game.renderer.floatText(c.x, c.y + (c.foot ? 3.2 : 2.4), c.z, String(v.name).toUpperCase(), rec.mod.color || '#ffd070');
      if (wind > 0) {
        c.modCast = { t: wind, node: ab, target: c.target };
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 10, color: [rec.mod.color || '#ffd070', '#ffffff'], up: 16, speed: 18, life: wind, gravity: -20, glow: true });
        return true;
      }
      const x = rec.runner.ctx(ctx(game, rec, { self: c, target: c.target }));
      rec.runner.fire(x, ab.id, 'cast');
      return true;
    }
  }
  // (Its abilities' cooldowns: see creatureClock.)
  // (Round 64) What it's been told to do, before its own ways (see
  // behave.js).
  if (c.modOrder && orderTick(c, dt)) return true;
  // (One with no blow of its own keeps its distance: its abilities are
  // all it has.)
  if (S.noAttack && c.hostileNow && c.target && Math.hypot(c.target.x - c.x, c.target.z - c.z) <= 4) return true;
  // A person wanders near home; never far.
  if (S.npc && !c.hostileNow) {
    c.thinkT -= dt;
    if (c.thinkT <= 0) {
      c.thinkT = 2 + Math.random() * 4;
      const R0 = S.wander ?? 4;
      if (R0 > 0 && Math.random() < 0.6) {
        const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
        if (Math.abs(c.x + dx - c.home.x) <= R0 && Math.abs(c.z + dz - c.home.z) <= R0) c.tryStep(c.x + dx, c.z + dz, S.step * 1.6);
      }
    }
    return true;
  }
  return false;
}

// (Round 64) Someone come within so many paces of a creature (its On
// someone near), or gone off again.
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(+v) ? +v : d);
function nearTick(game, rec, c, n, dt) {
  const m = (c.modNearT ||= {});
  m[n.id] = (m[n.id] ?? Math.random() * 0.4) - dt;
  if (m[n.id] > 0) return;
  m[n.id] = 0.4;
  const v = n.v || {};
  const sp = v.species ? resolveRef(rec.mod, v.species) : null;
  const list = near(game, c, num(v.r, 5), (n.p && n.p.which) || 'players', c).filter((e) => e !== c && (!sp || e.species === sp));
  const was = ((c.modNearIn ||= {})[n.id] ||= new Set());
  const now = new Set(list);
  for (const e of list) if (!was.has(e)) rec.runner.fire(rec.runner.ctx(ctx(game, rec, { self: c, target: e })), n.id, 'fire');
  for (const e of was) if (!now.has(e) && rec.prog.next.has(`${n.id}.gone`)) rec.runner.fire(rec.runner.ctx(ctx(game, rec, { self: c, target: e })), n.id, 'gone');
  c.modNearIn[n.id] = now;
}

// (Round 64) A mod creature's clocks: its ticks, its timers, someone come
// near, its health low, a while calm or quick run out. Every frame (they
// were kept on its turn, which only comes between its steps: they ran slow
// while it walked).
function creatureClock(game, c, dt) {
  const rec = MODS.ents.get(c.S.modKey);
  if (!rec || !c.modBorn || c.dead || c.dormant) return;
  if (c.modGuardT > 0) c.modGuardT -= dt;
  if (c.modAbCd) for (const k of Object.keys(c.modAbCd)) c.modAbCd[k] -= dt;
  if (c.modCalmT > 0 && (c.modCalmT -= dt) <= 0) {
    c.modCalm = false;
    if (c.modCalmAs === 'hostile') c.angry = false;
  }
  if (c.modPaceT > 0 && (c.modPaceT -= dt) <= 0) c.modPace = 1;
  if (c.talkT > 0) return;
  c.modTickT -= dt;
  if (c.modTickT <= 0) {
    c.modTickT = Math.max(0.2, rec.f.tick || 1);
    fire(game, rec.key, 'onTick', { self: c });
  }
  for (const n of rec.prog.starts) {
    if (n.type === 'ev.near') {
      nearTick(game, rec, c, n, dt);
      continue;
    }
    if (n.type === 'ev.lowhp') {
      const low = (100 * c.hp) / Math.max(1, c.maxHp) < num((n.v || {}).pct, 50);
      const m = (c.modLow ||= {});
      if (low && !m[n.id]) rec.runner.fire(rec.runner.ctx(ctx(game, rec, { self: c, target: c.target || null })), n.id, 'fire');
      m[n.id] = low;
      continue;
    }
    if (n.type !== 'ev.timer') continue;
    const k = `t:${n.id}`;
    const m = (c.modTimersT ||= {});
    m[k] = (m[k] ?? 0) - dt;
    if (m[k] > 0) continue;
    m[k] = Math.max(0.2, num((n.v || {}).every, 5));
    rec.runner.fire(rec.runner.ctx(ctx(game, rec, { self: c })), n.id, 'fire');
  }
}

function pickAbility(c, rec) {
  const ph = c.modPhase || 1;
  const d = Math.hypot(c.target.x - c.x, c.target.z - c.z) - (c.foot || 0);
  const ready = [];
  for (const n of rec.prog.starts) {
    if (n.type !== 'ev.ability') continue;
    const v = n.v || {};
    if ((c.modAbCd && c.modAbCd[n.id] > 0) || ph < (v.fromPhase ?? 1) || ph > (v.toPhase ?? 4)) continue;
    if (d < (v.min ?? 0) - 0.5 || d > (v.max ?? 6) + 0.5) continue;
    if (!rec.prog.next.has(`${n.id}.cast`)) continue;
    ready.push(n);
  }
  if (!ready.length) return null;
  // (Not every moment it can: now and then, as a beast picks its time.)
  if (Math.random() > (c.S.boss ? 0.6 : 0.3)) return null;
  let r = Math.random() * ready.reduce((s, n) => s + Math.max(0.1, (n.v && n.v.weight) ?? 1), 0);
  for (const n of ready) if ((r -= Math.max(0.1, (n.v && n.v.weight) ?? 1)) <= 0) return n;
  return ready[ready.length - 1];
}

// A master worn down past a phase: its phase output, a cry, a shake.
function bossPhases(game, c) {
  const S = c.S;
  const n = S.phases || 3;
  const k = c.hp / Math.max(1, c.maxHp);
  const want = Math.min(n, 1 + Math.floor((1 - k) * n + 1e-9));
  while ((c.modPhase || 1) < want && !c.dead) {
    c.modPhase = (c.modPhase || 1) + 1;
    game.renderer.floatText(c.x, c.y + 3.4, c.z, `PHASE ${c.modPhase}`, c.S.modColor || '#ffd070');
    for (const p of game.everyone()) if (cheb(p, c) <= 20) game.asPlayer(p, () => (game.shake = Math.min(1.4, (game.shake || 0) + 0.5)));
    game.audio?.play('roar', c);
    fire(game, S.modKey, `onPhase${c.modPhase}`, { self: c, target: c.target });
  }
}

// One of a mod's creatures to wander out here, if any suits (null: the
// game's own). `night`, `biome`.
export function modSpawnPick(night, biome) {
  const opts = [];
  for (const [k, S] of Object.entries(SPECIES)) {
    const sp = S.modSpawn;
    if (!sp) continue;
    if (sp.when === 'day' && night) continue;
    if (sp.when === 'night' && !night) continue;
    if (sp.biomes.length && !sp.biomes.includes(biome)) continue;
    opts.push([k, sp.weight]);
  }
  if (!opts.length) return null;
  // (Theirs among the game's own: as common as their weights say, against
  // the game's ten.)
  const total = opts.reduce((s, [, w]) => s + w, 0);
  if (Math.random() * (total + 10) >= total) return null;
  let r = Math.random() * total;
  for (const [k, w] of opts) if ((r -= w) <= 0) return k;
  return opts[opts.length - 1][0];
}

// ------------------------------------------------------------ each frame
const NEAR_EVERY = 0.5;
export function modTick(game, dt) {
  if (!MODS.active.length) return;
  game.modClock = (game.modClock || 0) + dt;
  // Waits come round.
  const ts = game.modTimers;
  if (ts && ts.length) {
    const due = [];
    for (const q of ts) {
      q.t -= dt;
      if (q.t <= 0) due.push(q);
    }
    if (due.length) {
      game.modTimers = ts.filter((q) => q.t > 0);
      for (const q of due) {
        try {
          q.fn();
        } catch (e) {
          MODS.host.fault(e);
        }
      }
    }
  }
  tickShots(game, dt);
  // (Round 63) What the character screen gave: lasting effects,
  // companions, stories begun.
  game.modCgT = (game.modCgT || 0) - dt;
  if (game.modCgT <= 0) {
    game.modCgT = 1;
    charGenTick(game);
  }
  // Effects on everyone.
  for (const p of game.everyone()) tickEffects(game, p, dt);
  for (const c of game.creatures) if (c.modFx) tickEffects(game, c, dt);
  for (const n of game.npcs || []) if (n.modFx) tickEffects(game, n, dt);
  // Worn pieces: put on, taken off, and each second while worn.
  game.modWornT = (game.modWornT || 0) - dt;
  const second = game.modWornT <= 0;
  if (second) game.modWornT += 1;
  for (const p of game.everyone()) {
    const now = {};
    for (const [slot, k] of Object.entries(p.equip || {})) if (k && ITEMS[k] && ITEMS[k].mod) now[slot] = k;
    const was = p.modWorn || {};
    for (const [s, k] of Object.entries(now)) if (was[s] !== k) fire(game, k, 'onEquip', { self: p, player: p, item: k });
    for (const [s, k] of Object.entries(was)) if (now[s] !== k) fire(game, k, 'onUnequip', { self: p, player: p, item: k });
    p.modWorn = now;
    if (second) for (const k of Object.values(now)) fire(game, k, 'onWorn', { self: p, player: p, item: k });
    // Stood on a mod block (once, as you step onto it).
    const id = game.world.getBlock(p.x, p.y - 1, p.z);
    const at = `${p.x},${p.y - 1},${p.z}`;
    if (at !== p.modStepAt) {
      p.modStepAt = at;
      const rec = MODS.blocks.get(id);
      if (rec) fire(game, rec.key, 'onStep', { target: p, player: p, pos: { x: p.x, y: p.y - 1, z: p.z }, blockKey: at });
    }
  }
  // World events: timers, dawn and dusk, the world's start.
  const st = modState(game);
  const hour = game.minute / 60;
  for (const rec of MODS.events) {
    const f = rec.f;
    if (f.when === 'world starts') {
      if (!st.events[`start:${rec.key}`]) {
        st.events[`start:${rec.key}`] = 1;
        worldEvent(game, rec, { player: game.player });
      }
    } else if (f.when === 'every so often') {
      rec.timer = (rec.timer ?? Math.max(1, f.every || 60)) - dt;
      if (rec.timer <= 0) {
        rec.timer = Math.max(1, f.every || 60);
        worldEvent(game, rec, { player: game.player, pos: posOf(game.player) });
      }
    } else if (f.when === 'dawn' || f.when === 'dusk' || f.when === 'at an hour') {
      const at = f.when === 'dawn' ? 6 : f.when === 'dusk' ? 19.5 : Math.max(0, Math.min(23.99, num(f.hour, 12)));
      const k = `${f.when}:${rec.key}`;
      const day = game.day;
      if (hour >= at && st.events[k] !== day) {
        st.events[k] = day;
        worldEvent(game, rec, { player: game.player, pos: posOf(game.player) });
      }
    } else if (f.when === 'a player joins' || f.when === 'a player is downed') {
      // (Round 64) Each player come into the world, or knocked down.
      for (const p of game.everyone()) {
        const k = f.when === 'a player joins' ? 'modJoined' : 'modDowned';
        const seen = (p[k] ||= {});
        const now = f.when === 'a player joins' ? true : !!(p.down || p.dead);
        if (now && !seen[rec.key]) worldEvent(game, rec, { target: p, player: p, pos: posOf(p) });
        seen[rec.key] = now;
      }
    } else if (f.when === 'it starts to rain') {
      const wet = !!(game.weather && (game.weather.kind === 'rain' || game.weather.kind === 'snow'));
      if (wet && !rec.wasWet) worldEvent(game, rec, { player: game.player, pos: posOf(game.player), payload: game.weather.kind });
      rec.wasWet = wet;
    }
  }
  // (Round 64) Leaps through the air, carried along; mod creatures' clocks.
  for (const c of game.creatures) {
    if (c.modLeap) leapTick(c, dt);
    if (c.S && c.S.modKey) creatureClock(game, c, dt);
  }
  // (Round 64) Every so often, for what a player holds or wears.
  for (const p of game.everyone()) {
    const keys = new Set([p.heldItem ? p.heldItem() : null, ...Object.values(p.equip || {})].filter((k) => k && ITEMS[k] && ITEMS[k].mod));
    for (const k of keys) {
      const rec = MODS.ents.get(k);
      if (!rec) continue;
      for (const n of rec.prog.starts) {
        if (n.type !== 'ev.timer') continue;
        const m = (p.modTimersT ||= {});
        const tk = `${k}:${n.id}`;
        m[tk] = (m[tk] ?? 0) - dt;
        if (m[tk] > 0) continue;
        m[tk] = Math.max(0.2, num((n.v || {}).every, 5));
        rec.runner.fire(rec.runner.ctx(ctx(game, rec, { self: p, player: p, item: k })), n.id, 'fire');
      }
    }
  }
  // Near things: blocks that care who comes near, structures' triggers.
  game.modNearT = (game.modNearT || 0) - dt;
  if (game.modNearT <= 0) {
    game.modNearT = NEAR_EVERY;
    nearChecks(game);
    MODS.triggerTick?.(game);
  }
}

// Mod blocks that care when someone comes near (looked for round each
// player, now and then), and world events near a structure.
function nearChecks(game) {
  const wants = [...MODS.blocks.values()].filter((r) => wired(r, 'onNear'));
  const w = game.world;
  if (wants.length) {
    const ids = new Set(wants.map((r) => r.blockId));
    for (const p of game.everyone()) {
      const seen = (p.modNear ||= new Map());
      const nowSeen = new Set();
      const R0 = 12;
      for (let dz = -R0; dz <= R0; dz++) for (let dx = -R0; dx <= R0; dx++) {
        const top = w.topAt(p.x + dx, p.z + dz);
        for (let y = Math.max(0, p.y - 4); y <= Math.min(top, p.y + 4); y++) {
          const id = w.getBlock(p.x + dx, y, p.z + dz);
          if (!ids.has(id)) continue;
          const rec = MODS.blocks.get(id);
          const r = Math.max(1, rec.f.near || 3);
          if (Math.hypot(dx, dz) > r) continue;
          const k = `${p.x + dx},${y},${p.z + dz}`;
          nowSeen.add(k);
          if (!seen.has(k)) fire(game, rec.key, 'onNear', { target: p, player: p, pos: { x: p.x + dx, y, z: p.z + dz }, blockKey: k });
        }
      }
      p.modNear = new Map([...nowSeen].map((k) => [k, 1]));
    }
  }
  for (const rec of MODS.events) {
    if (rec.f.when !== 'near structure' || !rec.f.structure) continue;
    const spots = MODS.structureSpots?.(game, rec.mod.id, rec.f.structure) || [];
    for (const p of game.everyone()) {
      const r = Math.max(1, rec.f.radius || 8);
      const s = spots.find((q) => Math.hypot(q.x - p.x, q.z - p.z) <= r);
      const k = `near:${rec.key}`;
      const inside = (p.modIn ||= {});
      if (s && !inside[k]) {
        inside[k] = 1;
        worldEvent(game, rec, { target: p, player: p, pos: { x: s.x, y: s.y ?? p.y, z: s.z } });
      } else if (!s) inside[k] = 0;
    }
  }
}

// ------------------------------------------------------------ the save
export function modSave(game) {
  if (!MODS.active.length) return null;
  const st = modState(game);
  return { refs: MODS.active.map((m) => ({ id: m.id, hash: m.hash, name: m.name, version: m.version, author: m.author, color: m.color })), blockIds: { ...MODS.blockIds }, state: { vars: st.vars, once: st.once, blocks: st.blocks, events: st.events, killed: st.killed || {}, trig: st.trig || {} } };
}
export function modLoad(game, data) {
  if (!data) return;
  const st = modState(game);
  Object.assign(st, { vars: {}, once: {}, blocks: {}, events: {}, killed: {}, trig: {}, ...(data.state || {}) });
}

// What build.js (and others) reach through MODS.
MODS.lootSlots = lootSlots;
MODS.applyEffect = applyEffect;
MODS.state = modState;
MODS.species = (k) => SPECIES[k] || null;
// A structure's trigger set off by someone coming near (see build.js).
MODS.sendEvent = sendEvent;
MODS.fireTrigger = (game, mk, who) => {
  const m = mk.mod;
  const x = { game, mod: m, rec: null, self: null, target: who, player: who, pos: { x: mk.x, y: mk.y, z: mk.z }, vars: {}, locals: {}, steps: 0 };
  if (mk.message) game.asPlayer(who, () => game.ui.msg(String(mk.message), mk.color || '#ffe070'));
  if (mk.sound) game.audio?.play(mk.sound, mk);
  if (mk.vfx) MODS.playVfx?.(game, m, mk.vfx, { x: mk.x, y: mk.y, z: mk.z }, {});
  if (mk.creature && mk.count) SVC.spawn(x, mk.creature, { x: mk.x, y: mk.y, z: mk.z }, Math.min(8, mk.count));
  if (mk.item) SVC.give(x, who, mk.item, mk.itemCount || 1);
  if (mk.event) sendEvent(game, String(mk.event), mk.value ?? null, { target: who, pos: { x: mk.x, y: mk.y, z: mk.z } });
  if (mk.story) MODS.startStory?.(game, m, mk.story, x);
};

// What the world's mods are called (for lists).
export const activeMods = () => MODS.active;
export { NODES };
