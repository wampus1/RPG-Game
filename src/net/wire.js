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

// Never sent: the game itself, private workings, and what each screen
// works out for itself to draw (a master's limbs swinging, a roll's
// trail, a sprite's cached look).
const SKIP = new Set([
  'game', 'rng', 'path', 'pathI', 'layout', 'settlement', 'seat', 'store', 'S', 'rec', 'brainState', 'openedDoors', 'home', 'goal', 'spot',
  'faceR', 'sideLeft', 'shimmerT', 'rollTrail', 'moteT', 'rig', 'legRig', 'legCv', 'artPhase', 'mat', 'strike', 'swapping', 'victim', 'hunting',
  'schedule', 'memory', 'pathFails', 'idleT', 'waitT', 'stateT', 'greetCd', 'emoteCd', 'lineCd', 'fxT', 'wareT', 'haltT', 'thinkT',
  '_dishFx', 'dishStatKey', 'tacGoal',
]);
// Of a townsperson's record, what anyone sees of them.
const REC = ['idx', 'sid', 'name', 'age', 'job', 'look', 'equipment', 'wear', 'traits', 'personality', 'hp', 'maxHp', 'gems', 'tier', 'soldier', 'bandit', 'drafted', 'captive', 'ruler', 'councillor', 'title', 'alive'];

const isEnt = (v) => v instanceof Player || v instanceof NPC || v instanceof Creature || v instanceof ItemDrop || v instanceof Engine;

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
  return 'R';
}

const PROTO = { P: Player.prototype, N: NPC.prototype, C: Creature.prototype, D: ItemDrop.prototype, E: Engine.prototype, R: Object.prototype };

// Its fields, as data (each as a string, to compare with what was sent).
export function fieldsOf(e) {
  const out = {};
  for (const k of Object.keys(e)) {
    if (SKIP.has(k) || k[0] === '_') continue;
    const x = enc(e[k]);
    if (x !== undefined) out[k] = JSON.stringify(x);
  }
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
export function diffFields(e, last) {
  const now = fieldsOf(e);
  let out = null;
  for (const k of Object.keys(now)) {
    if (last[k] === now[k]) continue;
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
