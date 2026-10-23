// How the things in the world go over the network (host to players: see
// host.js and guest.js). Each person, beast, dropped thing or wagon goes
// as its own fields, plain data: another thing it points at (whoever a
// wolf's after) by its id, the world and the game left out; and after the
// first time only the fields that have changed. On the far side the same
// kind of thing is put together again out of them, to be drawn.
import { Player } from '../entities/player.js';
import { NPC } from '../entities/npc.js';
import { Creature, SPECIES } from '../entities/creature.js';
import { ItemDrop } from '../entities/itemdrop.js';
import { Engine } from '../game/engines.js';
import { Sailor } from '../entities/sailor.js';

// Never sent: the game itself, private workings, and what each screen
// works out for itself to draw (a master's limbs swinging, a roll's
// trail, a sprite's cached look).
const SKIP = new Set([
  'game', 'rng', 'path', 'pathI', 'layout', 'settlement', 'seat', 'store', 'S', 'rec', 'brainState', 'openedDoors', 'home', 'goal', 'spot',
  'faceR', 'sideLeft', 'shimmerT', 'rollTrail', 'moteT', 'rig', 'legRig', 'legCv', 'artPhase', 'mat', 'strike', 'swapping', 'victim', 'hunting',
  'schedule', 'memory', 'pathFails', 'idleT', 'waitT', 'stateT', 'greetCd', 'emoteCd', 'lineCd', 'fxT', 'wareT', 'haltT', 'thinkT',
  '_dishFx', 'dishStatKey', 'tacGoal',
  // (Round 68: a ship's hand's own reckoning, and their place on her crew list.)
  'recRef', 'task', 'hpath', 'hpathTried', 'upTried', 'wx', 'wz',
  // (Round 71: an evolved master's own reckoning: what it remembers, what
  // it's counted of your arms, what it's told you.)
  'mem', 'memT', 'usedArms', 'toldForms', 'haulArms',
  // (Round 141) The host's own clocks, counting down every frame for every
  // townsperson and beast about you, and never drawn: they were most of
  // what went over the network (see the README, Round 141).
  'trailEatT', 'gemMendT', 'chairT', 'roofT', 'bedCheckT', 'idleCd', 'biteT', 'attackCd', 'tidyT', 'dishClock', 'restT', 'avoid',
]);
// (Round 141) Clocks the far side runs itself between words (see
// guest.tick): sent when they're set, or when they've gone their own way,
// not every time they tick on. `rate`: how fast each runs, a second (of
// the thing itself, `e`); `lo`/`hi`: where it stops. A number, or an
// object's own `t`.
export const CLOCKS = {
  moveT: { rate: (e) => 1 / (e.moveDur || 0.2), lo: 0, hi: 1, tol: 0.12 },
  actionTimer: { rate: () => -1, lo: 0, hi: Infinity, tol: 0.15 },
  flash: { rate: () => -1, lo: 0, hi: Infinity, tol: 0.15 },
  bubble: { rate: () => -1, lo: 0, hi: Infinity, tol: 0.4, obj: true },
  emote: { rate: () => -1, lo: 0, hi: Infinity, tol: 0.25, obj: true },
  // (Its `fx`: the host's own countdown to the next puff of dust or wave
  // of a hand, those sent as they happen: left out.)
  idleAnim: { rate: () => 1, lo: 0, hi: Infinity, tol: 0.25, obj: true, omit: ['fx'] },
  windup: { rate: () => 1, lo: 0, hi: Infinity, tol: 0.08, obj: true },
};
// Of a townsperson's record, what anyone sees of them.
const REC = ['idx', 'sid', 'name', 'age', 'job', 'look', 'equipment', 'wear', 'traits', 'personality', 'hp', 'maxHp', 'gems', 'tier', 'soldier', 'bandit', 'drafted', 'captive', 'ruler', 'councillor', 'title', 'alive'];

const isEnt = (v) => v instanceof Player || v instanceof NPC || v instanceof Creature || v instanceof ItemDrop || v instanceof Engine || v instanceof Sailor;

// A value as plain data (`depth` levels into it at most).
export function enc(v, depth = 4) {
  if (v === null || v === undefined) return null;
  const t = typeof v;
  if (t === 'number') return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'function' || t === 'symbol' || t === 'bigint') return undefined;
  if (isEnt(v) || (v.kind === 'prop' && v.id !== undefined)) return { $e: v.id };
  if (depth <= 0) return null;
  if (Array.isArray(v)) return v.length > 400 ? null : v.map((x) => enc(x, depth - 1) ?? null);
  if (v instanceof Map) return { $m: [...v].slice(0, 200).map(([k, x]) => [enc(k, 1), enc(x, depth - 1)]) };
  if (v instanceof Set) return { $s: [...v].slice(0, 200).map((x) => enc(x, depth - 1)) };
  if (ArrayBuffer.isView(v)) return null;
  // (A canvas, an image, a sound: not data.)
  if (v.getContext || v.nodeType || v.constructor && v.constructor.name && !['Object', 'Array'].includes(v.constructor.name) && !v.$plain) return undefined;
  const out = {};
  for (const k of Object.keys(v)) {
    if (k === 'game' || k === 'ent' || k === 'layout') continue;
    const x = enc(v[k], depth - 1);
    if (x !== undefined) out[k] = x;
  }
  return out;
}

// Back from plain data, a thing pointed at found by id with `find`.
export function dec(v, find) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => dec(x, find));
  if (v.$e !== undefined) return find(v.$e);
  if (v.$m) return new Map(v.$m.map(([k, x]) => [k, dec(x, find)]));
  if (v.$s) return new Set(v.$s.map((x) => dec(x, find)));
  const out = {};
  for (const k of Object.keys(v)) out[k] = dec(v[k], find);
  return out;
}

// What kind of thing it is (to make one on the far side).
export function kindOf(e) {
  if (e instanceof Player) return 'P';
  if (e instanceof NPC) return 'N';
  if (e instanceof Creature) return 'C';
  if (e instanceof ItemDrop) return 'D';
  if (e instanceof Engine) return 'E';
  if (e instanceof Sailor) return 'S';
  return 'R';
}

const PROTO = { P: Player.prototype, N: NPC.prototype, C: Creature.prototype, D: ItemDrop.prototype, E: Engine.prototype, S: Sailor.prototype, R: Object.prototype };

// Its fields, as data (each as a string, to compare with what was sent).
// (Round 141: a running clock's reading, and the rest of it, kept beside
// them, out of sight: see diffFields.)
export function fieldsOf(e) {
  const out = {};
  let clk = null;
  for (const k of Object.keys(e)) {
    if (SKIP.has(k) || k[0] === '_') continue;
    const x = enc(e[k]);
    if (x === undefined) continue;
    const C = CLOCKS[k];
    if (C && C.omit && x && typeof x === 'object') for (const o of C.omit) delete x[o];
    out[k] = JSON.stringify(x);
    if (!C || x === null) continue;
    if (C.obj) {
      if (typeof x !== 'object' || typeof x.t !== 'number') continue;
      const { t, ...rest } = x;
      (clk ||= {})[k] = { v: t, sig: JSON.stringify(rest), rate: C.rate(e) };
    } else if (typeof x === 'number') (clk ||= {})[k] = { v: x, sig: '', rate: C.rate(e) };
  }
  if (clk) Object.defineProperty(out, '$clk', { value: clk, enumerable: false });
  // An item's place in the air (kept in its own fields, behind getters).
  if (e instanceof ItemDrop) for (const k of ['px', 'py', 'pz']) out[k] = JSON.stringify(enc(e[k]));
  // A townsperson's record: only what's seen.
  if (e.rec) {
    const r = {};
    for (const k of REC) if (e.rec[k] !== undefined) r[k] = enc(e.rec[k], 3);
    out.rec = JSON.stringify(r);
  }
  return out;
}

// What changed in its fields since `last` (all of them the first time);
// `last` brought up to date. Null if nothing did.
// (`now`: its fields as already worked out this frame, for another of you.
// `clock`: the time, in seconds, if running clocks may be left to run on
// the far side: see CLOCKS.)
export function diffFields(e, last, now = fieldsOf(e), clock = null) {
  let out = null;
  const clk = clock === null ? null : now.$clk;
  for (const k of Object.keys(now)) {
    const c = clk && clk[k];
    // (A clock's the same as when it was last sent: but the far side's has
    // run on since, so it's reckoned below, not passed over.)
    if (last[k] === now[k] && !c) continue;
    if (c) {
      // Where the far side has it now, by its own reckoning since it was
      // last told: near enough, and nothing else about it changed, it's
      // left be.
      if (!Object.prototype.hasOwnProperty.call(last, '$clk')) Object.defineProperty(last, '$clk', { value: {}, enumerable: false });
      const was = last.$clk[k];
      const C = CLOCKS[k];
      if (was && was.sig === c.sig) {
        const guess = Math.max(C.lo, Math.min(C.hi, was.v + was.rate * (clock - was.at)));
        if (Math.abs(guess - c.v) <= C.tol) continue;
      }
      last.$clk[k] = { v: c.v, sig: c.sig, rate: c.rate, at: clock };
    } else if (last.$clk) delete last.$clk[k];
    last[k] = now[k];
    (out ||= {})[k] = now[k];
  }
  // (Fields gone since: sent as null.)
  for (const k of Object.keys(last)) {
    if (k in now) continue;
    delete last[k];
    (out ||= {})[k] = 'null';
  }
  return out;
}

// One thing's update, as sent: [id, kind, { field: json }].
export function packEntity(e, changed) {
  return [e.id, kindOf(e), changed];
}

// Made (or brought up to date) on the far side, in `game`, from what was
// sent; its references to others put back afterwards (resolve).
export function applyEntity(game, map, [id, kind, f]) {
  let e = map.get(id);
  if (!e) {
    e = Object.create(PROTO[kind] || Object.prototype);
    e.game = game;
    e.id = id;
    e.netKind = kind;
    // (A wagon or a sail standing about: drawn where it stands.)
    if (kind === 'R') e.renderPos = function renderPos() {
      return { x: this.x, y: this.y, z: this.z };
    };
    map.set(id, e);
  }
  const raw = e.netRaw || (e.netRaw = {});
  for (const k of Object.keys(f)) {
    const v = JSON.parse(f[k]);
    raw[k] = v;
    if (k === 'id') continue;
    if (k === 'rec') {
      e.rec = v;
      continue;
    }
    // (An item's place lives in px/py/pz: x, y and z are worked out.)
    if (kind === 'D' && (k === 'x' || k === 'y' || k === 'z')) continue;
    e[k] = v;
  }
  if (kind === 'C' && e.species) e.S = SPECIES[e.species] || e.S || { name: e.species };
  return e;
}

// Point each thing's references at the things themselves (or nothing, if
// what it points at isn't in sight).
export function resolveEntity(e, find) {
  const raw = e.netRaw;
  if (!raw) return;
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    if (v && typeof v === 'object' && k !== 'rec') e[k] = dec(v, find);
  }
}

// (Round 115) A floor's plan, for a player's map (sent once a floor: they
// used to lay the whole floor out again themselves just to have it). Its
// open squares and their rooms, run by run; where it lies; its stairs,
// its way up, the gate before its master.
const runs = (a) => {
  const out = [];
  for (let i = 0; i < a.length; ) {
    let j = i + 1;
    while (j < a.length && a[j] === a[i]) j++;
    out.push(a[i], j - i);
    i = j;
  }
  return out;
};
const unrun = (r, n, T) => {
  const a = new T(n);
  let i = 0;
  for (let k = 0; k < r.length; k += 2) {
    a.fill(r[k], i, i + r[k + 1]);
    i += r[k + 1];
  }
  return a;
};
export function packPlan(data, key) {
  const P = data.plan;
  return {
    k: key,
    W: P.W,
    D: P.D,
    open: runs(P.open),
    room: P.room ? runs(P.room) : null,
    x0: data.x0,
    z0: data.z0 || 0,
    stairs: (data.rooms || []).filter((r) => r.stairs).map((r) => [r.stairs.x, r.stairs.z]),
    bossGate: data.bossGate ? { x: data.bossGate.x, z: data.bossGate.z } : null,
    up: data.up ? { x: data.up.x, z: data.up.z } : null,
  };
}
export function unpackPlan(p) {
  const n = p.W * p.D;
  return {
    plan: { W: p.W, D: p.D, open: unrun(p.open, n, Uint8Array), room: p.room ? unrun(p.room, n, Int16Array) : null },
    x0: p.x0,
    z0: p.z0,
    rooms: (p.stairs || []).map(([x, z]) => ({ stairs: { x, z } })),
    bossGate: p.bossGate,
    up: p.up,
  };
}
