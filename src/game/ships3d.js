// The great ships at sea (round 68): a sloop, a brigantine, a galleon, a
// frigate (see world/shipmodels.js for how each is built, render/shipvox.js
// for how she's drawn). A ship is a thing of the world in her own right:
// where she is (to the fraction of a pace) and which way she's heading (to
// any angle), how fast she's going, her sails (how much is set, how it's
// trimmed), her helm, her guns, and her cubes (each plank of her, knocked
// out or mended).
//   She sails by the wind: it blows from somewhere (turning slowly through
// the day, stronger in rain and storm), and how well she goes depends on
// where it is to her (square sails love a wind from astern, fore-and-aft
// sails a wind on the beam; nothing sails into it) and how well her sails
// are trimmed to it: eased out running before it, hauled in close to it.
// At her best a sloop makes nearly three times what a raft does, a frigate
// six. She answers her helm slowly when she's slow, the great ships slowly
// always.
//   She runs aground, rams and is rammed: her planks stove in where she
// struck. Shot holes her; holed under the waterline, she takes on water
// (her pumps fighting it), settles, and in the end founders. In the storm
// round the islands, waves and lightning beat at her. Mended plank by
// plank, from outside or in (see shiphold.js for her inside).
//   Whoever's aboard walks her deck (her own cells, turned with her: see
// deck*), goes below (down her hatches, through a cabin door, through a
// hole in her deck), takes her wheel, mans a gun, or goes over the side.
import { GROUND, SURFACE, PLAYER_STEP_TIME } from '../config.js';
import { B, BLOCKS, PLANK_BLOCKS } from '../world/blocks.js';
import { shipModel, SHIP_TYPES, standOn, stepOn, onPlan, isInside, vAt } from '../world/shipmodels.js';
import { hash4 } from '../util/rng.js';
import { STORM_WALL } from '../entities/raft.js';
import { enterHold, holdTick, holdVoxel, closeHold, holdFlood } from './shiphold.js';
import { crewTick } from './shipcrew.js';
import { washAshore } from './stormsea.js';

const TAU = Math.PI * 2;
export const BALL_SPEED = 32;
export const BALL_GRAV = 18;
export const RELOAD = 7;

let SEQ = 1;

// --------------------------------------------------------------- a ship
export class Ship {
  constructor(o) {
    this.id = o.id ?? SEQ;
    SEQ = Math.max(SEQ, this.id + 1);
    this.type = o.type;
    this.m = shipModel(o.type);
    this.vox = new Uint16Array(this.m.vox);
    if (o.diff) for (const [vi, id] of o.diff) if (vi >= 0 && vi < this.vox.length) this.vox[vi] = id;
    this.x = o.x;
    this.z = o.z;
    this.yaw = o.yaw || 0;
    this.v = 0;
    this.yawV = 0;
    this.sailSet = o.sailSet ?? 0;
    this.sailGoal = this.sailSet;
    this.sheet = o.sheet ?? 0.6;
    this.brace = 0;
    this.boom = 0.6;
    this.fill = 0;
    this.lee = 1;
    this.rudder = 0;
    this.wheel = 0;
    this.floodCells = o.flood || 0;
    this.yOff = 0;
    this.guns = this.m.guns.map(() => ({ aim: 0, elev: 0.12, cd: 0, recoil: 0 }));
    this.sailHp = o.sailHp ? [...o.sailHp] : this.m.masts.map(() => 1);
    this.runOut = false;
    this.owner = o.owner ?? null;
    this.civ = o.civ ?? null;
    this.name = o.name || SHIP_TYPES[o.type].name;
    this.paint = o.paint || '#8a2a1e';
    this.paint2 = o.paint2 || '#1e1e24';
    this.flag = o.flag || '#a02020';
    this.emblem = o.emblem || null;
    this.anchor = o.anchor ?? true;
    this.crewRecs = o.crew || [];
    this.store = new Map(o.store || []);
    this.mission = o.mission || null;
    this.ammo = o.ammo ?? 0;
    this.ver = 1;
    this.sinking = 0;
    this.manualT = 0;
    this.shakeT = 0;
    this.stormT = 3;
    this.wake = [];
    this.recount();
  }

  // Her own frame to the world's (pace coordinates: a whole number is a
  // cell's middle), and back.
  toWorld(lx, lz) {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const dx = lx - this.m.px;
    const dz = lz - this.m.pz;
    return [this.x + dx * c + dz * s, this.z - dx * s + dz * c];
  }

  toLocal(wx, wz) {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const dx = wx - this.x;
    const dz = wz - this.z;
    return [this.m.px + dx * c - dz * s, this.m.pz + dx * s + dz * c];
  }

  // A direction in the world, in her frame.
  dirLocal(wx, wz) {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return [wx * c - wz * s, wx * s + wz * c];
  }

  dirWorld(lx, lz) {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return [lx * c + lz * s, -lx * s + lz * c];
  }

  // The world layer of a layer of hers.
  layerY(ly) {
    return ly + this.m.yBase + this.yOff;
  }

  // How much of her is whole (her hull's planking, decks, rails, masts).
  recount() {
    const m = this.m;
    let n = 0;
    const leaks = [];
    for (let i = 0; i < m.N; i++) {
      if (!m.struct[i]) continue;
      if (this.vox[i] !== 0) n++;
      else if (m.skin[i]) {
        const y = Math.floor(i / (m.W * m.L));
        leaks.push({ i, x: i % m.W, y, z: Math.floor(i / m.W) % m.L });
      }
    }
    this.whole = n / m.total;
    this.leaks = leaks;
    if (this.capacity === undefined) {
      let cap = 0;
      for (let i = 0; i < m.N; i++) if (m.inside[i] && m.vox[i] === 0) cap++;
      this.capacity = Math.max(20, cap);
    }
  }

  get flood() {
    return Math.min(1, this.floodCells / this.capacity);
  }

  // What's saved of her.
  save() {
    const diff = [];
    const m = this.m;
    for (let i = 0; i < m.N; i++) if (this.vox[i] !== m.vox[i]) diff.push([i, this.vox[i]]);
    return {
      id: this.id, type: this.type, x: Math.round(this.x * 100) / 100, z: Math.round(this.z * 100) / 100, yaw: Math.round(this.yaw * 1000) / 1000,
      sailSet: this.sailGoal, sheet: this.sheet, flood: Math.round(this.floodCells * 10) / 10, sailHp: this.sailHp, owner: this.owner, civ: this.civ,
      name: this.name, paint: this.paint, paint2: this.paint2, flag: this.flag, emblem: this.emblem, anchor: this.anchor, crew: this.crewRecs,
      store: [...this.store], mission: this.mission, ammo: this.ammo, diff,
    };
  }
}

// Her name as it's said ("the Sea Wolf", "The Frigate").
export function theShip(S, cap = false) {
  const n = S.name || 'the ship';
  if (/^the /i.test(n)) return cap ? n[0].toUpperCase() + n.slice(1) : 'the' + n.slice(3);
  return `${cap ? 'The' : 'the'} ${n}`;
}

export function shipsOf(game) {
  return (game.ships3d ||= []);
}

export function shipById(game, id) {
  for (const S of shipsOf(game)) if (S.id === id) return S;
  return null;
}

// A new ship on the water at (x, z), heading `yaw`.
export function addShip(game, o) {
  const S = new Ship(o);
  shipsOf(game).push(S);
  return S;
}

// Is there room for a ship of `type` on the water at (x, z), heading yaw
// (with `margin` paces of open water all round her)?
export function roomFor(game, type, x, z, yaw, skip = null, margin = 0) {
  const m = shipModel(type);
  const probe = { m, x, z, yaw, toWorld: Ship.prototype.toWorld };
  for (const p of m.perim) {
    const nx = p.x - m.px;
    const nz = p.z - m.pz;
    const nl = Math.hypot(nx, nz) || 1;
    for (const k of margin ? [0, margin] : [0]) {
      const [wx, wz] = probe.toWorld(p.x + (nx / nl) * k, p.z + (nz / nl) * k);
      if (!sailable(game, Math.round(wx), Math.round(wz))) return false;
    }
  }
  for (const o of shipsOf(game)) if (o !== skip && Math.hypot(o.x - x, o.z - z) < (o.m.L + m.L) / 2 + 1) return false;
  return true;
}

// The nearest open water to (x, z), at least `min` paces off, a ship of
// `type` has room in (and which way she'd lie): null if none near.
export function waterSpot(game, type, x, z, min = 0) {
  for (let R = Math.max(4, min); R < 360; R += 4) {
    const n = Math.max(12, Math.round(R / 2));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      const px = Math.round(x + Math.cos(a) * R);
      const pz = Math.round(z + Math.sin(a) * R);
      if (!game.world.regionAt(px, pz)) game.loadAround?.(px, pz, true);
      if (!sailable(game, px, pz)) continue;
      for (const yaw of [a + Math.PI / 2, a, a - Math.PI / 2, a + Math.PI]) if (roomFor(game, type, px, pz, yaw, null, R > 200 ? 1 : 4)) return { x: px, z: pz, yaw: ((yaw % TAU) + TAU) % TAU };
    }
  }
  return null;
}

// --------------------------------------------------------------- the wind
// Where it blows to (x, z), and how hard (1 a good sailing breeze). The
// same for everyone at the same hour (so it's the same on every screen).
export function windOf(game) {
  const hours = ((game.day || 0) * 1440 + (game.minute || 0)) / 60;
  const seed = ((game.world && game.world.seed) || 7) % 997;
  const ang = seed * 0.37 + Math.sin(hours * 0.11 + seed) * 1.6 + Math.sin(hours * 0.037 + 2.1) * 2.4;
  let k = 0.85 + 0.17 * Math.sin(hours * 0.23 + seed * 0.1);
  const w = game.weather;
  if (w && w.kind === 'rain') k += 0.12;
  if (w && w.storm) k += w.storm * 0.5;
  return { ang, k, x: Math.sin(ang), z: Math.cos(ang) };
}

// How well each kind of sail draws with the wind at angle θ (degrees,
// 0 dead astern, 180 dead ahead), trimmed right.
const SQ_EFF = [[0, 0.92], [45, 1], [90, 0.84], [115, 0.52], [135, 0.12], [150, -0.1], [180, -0.35]];
const FA_EFF = [[0, 0.58], [45, 0.78], [90, 1], [120, 0.9], [135, 0.62], [150, 0.04], [180, 0]];
function table(T, x) {
  for (let i = 1; i < T.length; i++) {
    if (x <= T[i][0]) {
      const [x0, y0] = T[i - 1];
      const [x1, y1] = T[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return T[T.length - 1][1];
}
// How her sail's made up: square and fore-and-aft, by the mast.
const RIG_AREA = { square3: [3, 0], square2: [2, 0], gaff: [0, 2.5], sloop: [0, 3.2], lateen: [0, 2], mizzen: [1, 1.5] };
function rigAreas(m) {
  let sq = 0;
  let fa = m.T.W >= 9 ? 2 : 1;
  for (const mm of m.masts) {
    const a = RIG_AREA[mm.rig] || [1, 1];
    sq += a[0];
    fa += a[1];
  }
  return { sq, fa };
}

// The sheet each kind of sail wants with the wind at θ (radians): 0
// hauled in hard, 1 eased right out.
export function idealSheet(m, theta) {
  const sqI = 1 - Math.min(1.05, theta * 0.6) / 1.05;
  const faI = (Math.max(0.26, Math.min(1.4, (Math.PI - theta) * 0.5)) - 0.26) / 1.14;
  const { sq, fa } = rigAreas(m);
  return { sq: sqI, fa: faI, both: (sqI * sq + faI * fa) / (sq + fa) };
}

// How she's sailing now: the wind's angle to her, how well her sails draw
// (0 to 1, or less than nothing taken aback), and how well they're trimmed.
export function pointOfSail(S, W) {
  const hx = Math.sin(S.yaw);
  const hz = Math.cos(S.yaw);
  const dot = W.x * hx + W.z * hz;
  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  const deg = (theta * 180) / Math.PI;
  const m = S.m;
  const { sq, fa } = rigAreas(m);
  const I = idealSheet(m, theta);
  const tk = (err) => Math.pow(Math.max(0, 1 - Math.min(1, err * 2.2)), 1.2);
  const tSq = tk(Math.abs(S.sheet - I.sq));
  const tFa = tk(Math.abs(S.sheet - I.fa));
  const eSq = table(SQ_EFF, deg);
  const eFa = table(FA_EFF, deg);
  const drive = (sq * eSq * (eSq > 0 ? tSq : 1) + fa * eFa * tFa) / (sq + fa);
  // (How well trimmed, against the best her sails can do together.)
  const at = (sh) => (sq * tk(Math.abs(sh - I.sq)) + fa * tk(Math.abs(sh - I.fa))) / (sq + fa);
  const best = Math.max(0.01, at(I.both));
  const trim = Math.min(1, at(S.sheet) / best);
  return { theta, deg, drive, trim, ideal: I.both, eSq, eFa };
}

// Hands aboard to work her (crew, and players).
function hands(game, S) {
  let n = 0;
  for (const e of aboardOf(game, S)) if (!e.dead && e.kind !== 'item') n++;
  return n;
}

export function aboardOf(game, S) {
  const out = [];
  for (const q of game.everyone ? game.everyone() : [game.player]) if (q && q.deck && q.deck.s === S.id) out.push(q);
  for (const c of game.sailors || []) if (c.deck && c.deck.s === S.id && !c.dead) out.push(c);
  return out;
}

// --------------------------------------------------------------- each frame
export function updateShips3d(game, dt) {
  const list = shipsOf(game);
  if (!list.length && !(game.cannonballs && game.cannonballs.length)) return;
  const W = windOf(game);
  for (const S of [...list]) {
    // (Far from all of you, she lies where she is.)
    const near = game.nearPlayer ? game.nearPlayer(S, 160) : true;
    if (!near && !S.sinking) continue;
    sail(game, S, W, dt);
    crewTick(game, S, dt);
  }
  collideShips(game);
  for (const S of [...list]) {
    flooding(game, S, dt);
    if (S.sinking) sinkTick(game, S, dt);
  }
  tickBalls(game, dt);
  syncWalkers(game, dt);
  holdTick(game, dt);
}

function sail(game, S, W, dt) {
  const m = S.m;
  const T = m.T;
  const P = pointOfSail(S, W);
  // How the sails are set, eased to where they're wanted.
  S.sailSet += Math.sign(S.sailGoal - S.sailSet) * Math.min(Math.abs(S.sailGoal - S.sailSet), dt * 0.45);
  // The crew trim them (unless whoever's at the wheel has lately).
  if (S.manualT > 0) S.manualT -= dt;
  const crew = (game.sailors || []).filter((c) => c.deck && c.deck.s === S.id && !c.dead).length;
  if (crew > 0 && S.manualT <= 0) {
    const skill = Math.min(1, 0.4 + crew / Math.max(2, T.crew));
    const goal = P.ideal + Math.sin(((game.renderer && game.renderer.time) || 0) * 0.3 + S.id) * 0.06 * (1 - skill);
    S.sheet += Math.sign(goal - S.sheet) * Math.min(Math.abs(goal - S.sheet), dt * 0.12 * skill);
  }
  // The yards and boom swing round with the sheet, to leeward.
  const [lwx, lwz] = S.dirLocal(W.x, W.z);
  S.windLocal = { x: lwx, z: lwz };
  const lee = lwx >= 0 ? 1 : -1;
  S.lee = lee;
  const braceGoal = lee * (1 - S.sheet) * 1.05;
  const boomGoal = -lee * (0.26 + S.sheet * 1.14);
  S.brace += (braceGoal - S.brace) * Math.min(1, dt * 2);
  S.boom += (boomGoal - S.boom) * Math.min(1, dt * 2);
  S.fill = S.sailSet > 0.05 ? Math.max(-1, Math.min(1, P.drive * 1.1 * Math.min(1.2, W.k))) : 0;
  S.trim = P.trim;
  S.drive = P.drive;
  // How fast she'd go, as she's sailed.
  const h = hands(game, S);
  const handling = Math.sqrt(Math.min(1, (h + 2) / (T.crew + 2)));
  const masts = S.sailHp.reduce((a, b) => a + b, 0) / S.sailHp.length;
  const hull = Math.max(0.2, 1 - S.flood * 0.7 - (1 - S.whole) * 0.6);
  let goal = T.speed * S.sailSet * P.drive * Math.min(1.25, W.k) * handling * masts * hull;
  goal = Math.min(T.speed * 1.05, goal);
  if (S.anchor) goal = 0;
  if (S.sinking) goal *= 0.2;
  // (Sails laid aback to back her off: hard aground, or on purpose.)
  if (S.backT > 0) {
    S.backT -= dt;
    goal = -Math.max(1.6, T.speed * 0.14);
  }
  const acc = T.accel * (goal < S.v ? (S.anchor ? 2.5 : 0.7) : 1);
  S.v += (goal - S.v) * Math.min(1, acc * dt);
  if (Math.abs(S.v) < 0.01 && goal === 0) S.v = 0;
  // Her helm: the wheel eases back amidships when nobody's holding it.
  if (!S.helmHeld) S.rudder -= Math.sign(S.rudder) * Math.min(Math.abs(S.rudder), dt * 0.5);
  S.helmHeld = false;
  S.wheel += (S.rudder * 2.6 - S.wheel) * Math.min(1, dt * 6);
  const way = Math.max(0.3, Math.min(1, 0.3 + Math.abs(S.v) / 7));
  const turnGoal = S.rudder * T.turn * way * (S.v < -0.2 ? -1 : 1) * (S.anchor ? 0.35 : 1);
  S.yawV += (turnGoal - S.yawV) * Math.min(1, dt * 1.8);
  // Moving: where she'd be, if nothing's in her way.
  const ny = S.yaw + S.yawV * dt;
  const nx = S.x + Math.sin(ny) * S.v * dt;
  const nz = S.z + Math.cos(ny) * S.v * dt;
  const hits = poseHits(game, S, nx, nz, ny);
  if (!hits.length) {
    S.x = nx;
    S.z = nz;
    S.yaw = ((ny % TAU) + TAU) % TAU;
  } else {
    // (Turning in place, if that's clear.)
    const turnOnly = poseHits(game, S, S.x, S.z, ny);
    if (!turnOnly.length) S.yaw = ((ny % TAU) + TAU) % TAU;
    else S.yawV = 0;
    strike(game, S, hits, null);
    // Hard aground and going nowhere: back her off.
    S.stuckT = (S.stuckT || 0) + dt;
    if (S.stuckT > 1.5 && !(S.backT > 0)) {
      S.backT = 3;
      S.stuckT = 0;
    }
  }
  if (!hits.length && S.stuckT) S.stuckT = Math.max(0, S.stuckT - dt);
  // The storm round the islands.
  stormTick(game, S, dt);
  // Guns cooling and running back.
  for (const g of S.guns) {
    if (g.cd > 0) g.cd -= dt;
    if (g.recoil > 0) g.recoil = Math.max(0, g.recoil - dt * 1.4);
  }
  if (S.shakeT > 0) S.shakeT -= dt;
  // Spray at her bow, going fast.
  const r = game.renderer;
  if (r && r.emit && Math.abs(S.v) > 6 && Math.random() < dt * Math.abs(S.v) * 0.6) {
    const [bx, bz] = S.toWorld(m.px + (Math.random() - 0.5) * 2, m.L + 0.2);
    r.emit(bx, GROUND + 0.1, bz, { n: 3, color: ['#e8f4ff', '#c0e0f8', '#ffffff'], up: 30, speed: 20, gravity: 80, life: 0.5 });
  }
}

// Is (x, z) water a ship can be on? (Open sea or lake, nothing built over
// it: a pier, a bridge.)
export function sailable(game, x, z) {
  const w = game.world;
  if (!w.regionAt(x, z)) return false;
  if (!w.isWaterAt(x, SURFACE, z)) return false;
  for (let y = GROUND; y <= GROUND + 2; y++) {
    const id = w.getBlock(x, y, z);
    if (id && BLOCKS[id].solid) return false;
  }
  return true;
}

// Which of her waterline points would be on something, posed so.
function poseHits(game, S, x, z, yaw) {
  const out = [];
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const m = S.m;
  for (const p of m.perim) {
    const dx = p.x - m.px;
    const dz = p.z - m.pz;
    const wx = x + dx * c + dz * s;
    const wz = z - dx * s + dz * c;
    if (!sailable(game, Math.round(wx), Math.round(wz))) out.push(p);
  }
  return out;
}

// She's hit something at `hits` (her own waterline points): stove in
// there, the faster the worse; brought up short.
function strike(game, S, hits, other) {
  const sp = Math.abs(S.v);
  if (sp > 2.2 && !S.sinking) {
    const n = Math.min(6, Math.round((sp - 1.5) / 2.5) + 1);
    const pts = hits.slice().sort((a, b) => (S.v > 0 ? b.z - a.z : a.z - b.z)).slice(0, 3);
    for (let k = 0; k < n; k++) {
      const p = pts[k % pts.length];
      const y = S.m.wl - 1 + (k % 3);
      breakNear(game, S, p.cx, y, p.cz, 1, 'ram');
    }
    shakeAboard(game, S, Math.min(1.2, 0.3 + sp * 0.06));
    game.audio?.play('crash', ...shipWhere(S));
    const [wx, wz] = S.toWorld(pts[0].x, pts[0].z);
    game.renderer?.emit(wx, GROUND + 0.5, wz, { n: 18, color: ['#8a6438', '#5a3c22', '#c8e0f0', '#ffffff'], up: 50, speed: 50, gravity: 120, life: 0.9 });
  }
  S.v = -S.v * 0.25;
  S.yawV *= 0.3;
  if (other) return;
}

function shipWhere(S) {
  return [{ x: Math.round(S.x), y: GROUND, z: Math.round(S.z) }];
}

// Two ships meeting: each stove in where they touch.
function collideShips(game) {
  const list = shipsOf(game);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i];
      const Bs = list[j];
      if (A.sinking > 3 || Bs.sinking > 3) continue;
      if (Math.hypot(A.x - Bs.x, A.z - Bs.z) > (A.m.L + Bs.m.L) / 2 + 2) continue;
      const hitA = [];
      for (const p of A.m.perim) {
        const [wx, wz] = A.toWorld(p.x, p.z);
        const [lx, lz] = Bs.toLocal(wx, wz);
        if (onPlan(Bs.m, Math.floor(lx), Math.floor(lz))) hitA.push({ p, lx, lz });
      }
      if (!hitA.length) continue;
      const rel = Math.abs(A.v - Bs.v * Math.cos(A.yaw - Bs.yaw));
      const save = [A.v, Bs.v];
      A.v = rel;
      strike(game, A, hitA.map((h) => h.p), Bs);
      Bs.v = rel;
      const q = hitA[0];
      if (rel > 2.2) breakNear(game, Bs, Math.floor(q.lx), Bs.m.wl, Math.floor(q.lz), 1, 'ram');
      // (Pushed apart.)
      const dx = A.x - Bs.x;
      const dz = A.z - Bs.z;
      const d = Math.hypot(dx, dz) || 1;
      A.x += (dx / d) * 0.25;
      A.z += (dz / d) * 0.25;
      Bs.x -= (dx / d) * 0.25;
      Bs.z -= (dz / d) * 0.25;
      A.v = -save[0] * 0.25;
      Bs.v = -save[1] * 0.25;
    }
  }
}

// The storm round the islands (while the wall stands): seas breaking over
// her and stoving in her planks, lightning striking her rigging. A real
// ship can live through it, if she's quick; it tears at her all the way.
function stormTick(game, S, dt) {
  const ow = game.world.ow;
  if (!ow || !ow.stormAt || ow.wallDown) return;
  const depth = ow.stormAt(S.x, S.z);
  if (depth <= STORM_WALL * 0.5) return;
  S.stormT -= dt * (0.6 + depth * 1.6);
  S.rudder += (Math.random() - 0.5) * dt * depth * 2;
  if (S.stormT > 0) return;
  S.stormT = 1.2 + Math.random() * 1.6;
  const m = S.m;
  if (Math.random() < 0.45) {
    // A bolt into her rigging and down onto her deck.
    const mi = Math.floor(Math.random() * m.masts.length);
    const mm = m.masts[mi];
    S.sailHp[mi] = Math.max(0, S.sailHp[mi] - 0.1 - depth * 0.15);
    breakNear(game, S, mm.x + Math.round((Math.random() - 0.5) * 4), mm.base - 1, mm.z + Math.round((Math.random() - 0.5) * 6), 1, 'storm');
    const [wx, wz] = S.toWorld(mm.x + 0.5, mm.z + 0.5);
    game.renderer?.effect?.({ type: 'bolt', from: 'sky', wx: Math.round(wx), wy: GROUND + 4, wz: Math.round(wz), tx: Math.round(wx), ty: GROUND + 4, tz: Math.round(wz), life: 0.45, oy: -4 });
    game.audio?.play('thunder');
    if (game.stormSea) game.stormSea.flash = 1;
  } else {
    // A sea coming aboard: planks stove in along her side.
    const side = Math.random() < 0.5 ? 0 : m.W - 1;
    const z = 2 + Math.floor(Math.random() * (m.L - 4));
    const n = 1 + Math.round(depth * 3);
    for (let k = 0; k < n; k++) breakNear(game, S, side, m.wl + Math.floor(Math.random() * 3), z + k, 0.8, 'storm');
    game.audio?.play('splash', ...shipWhere(S));
  }
  shakeAboard(game, S, 0.4 + depth * 0.5);
}

// Water coming in through her holes under the waterline (the deeper she
// settles, the more of them are under it); the crew at the pumps.
function flooding(game, S, dt) {
  const m = S.m;
  const line = m.wl - S.yOff;
  let inflow = 0;
  for (const L of S.leaks || []) if (L.y <= line) inflow += (L.y <= m.wl - 1 ? 1.1 : 0.7) * (1 + Math.abs(S.v) / 25);
  const pumping = (S.pumpers || 0) * 1.1 + (game.sailors || []).filter((c) => c.deck && c.deck.s === S.id && !c.dead).length * 0.12;
  S.floodCells = Math.max(0, S.floodCells + (inflow - pumping) * dt);
  S.pumpers = 0;
  const f = S.flood;
  const goal = -f * (m.deck - m.wl) * 0.8 - (S.sinking ? S.sinking * 0.7 : 0);
  S.yOff += (goal - S.yOff) * Math.min(1, dt * 0.8);
  holdFlood(game, S);
  if (!S.sinking && (f >= 0.98 || S.whole < 0.45)) {
    S.sinking = 0.001;
    for (const e of aboardOf(game, S)) if (e.kind === 'player') game.asPlayer(e, () => game.ui.msg(`${theShip(S, true)} is going down! Over the side!`, '#ff8060'));
    game.audio?.play('crash', ...shipWhere(S));
  }
}

// Going down: lower and lower, then gone; whoever's aboard in the sea.
function sinkTick(game, S, dt) {
  S.sinking += dt;
  S.v *= Math.max(0, 1 - dt);
  if (S.sinking < 2.5) return;
  // (Everyone off her as her deck goes under.)
  for (const e of aboardOf(game, S)) overboard(game, S, e, true);
  closeHold(game, S, true);
  if (S.sinking > 7) {
    // What floats up from her hold.
    const r = game.renderer;
    const [wx, wz] = [Math.round(S.x), Math.round(S.z)];
    r?.emit(wx, GROUND + 0.2, wz, { n: 30, color: ['#c8e0f0', '#ffffff', '#8a6438'], up: 40, speed: 60, gravity: 60, life: 1.4 });
    let k = 0;
    for (const slots of S.store.values()) {
      for (const it of slots) {
        if (!it || k > 10) continue;
        const a = (k++ / 10) * TAU;
        const x = Math.round(S.x + Math.cos(a) * 2);
        const z = Math.round(S.z + Math.sin(a) * 2);
        game.spawnDrop?.(it.item, it.count, x, GROUND, z, true);
      }
    }
    const list = shipsOf(game);
    const i = list.indexOf(S);
    if (i >= 0) list.splice(i, 1);
    for (const c of game.sailors || []) if (c.shipId === S.id) c.shipId = null;
    game.onShipLost?.(S);
  }
}

function shakeAboard(game, S, k) {
  S.shakeT = Math.max(S.shakeT, 0.4);
  const hold = S.hold;
  for (const q of game.everyone ? game.everyone() : [game.player]) {
    const aboard = (q.deck && q.deck.s === S.id) || (hold && hold.has(q));
    if (!aboard) continue;
    game.asPlayer(q, () => {
      game.shake = Math.min(1.5, (game.shake || 0) + k);
    });
  }
}

// ----------------------------------------------------------- her planks
// Knock out cell vi of hers (what was there is gone: from her outside and
// her inside both).
export function breakVoxel(game, S, vi, why = null) {
  const id = S.vox[vi];
  if (!id) return false;
  S.vox[vi] = 0;
  S.ver++;
  const m = S.m;
  const x = vi % m.W;
  const z = Math.floor(vi / m.W) % m.L;
  const y = Math.floor(vi / (m.W * m.L));
  // (A mast's foot: the mast goes by the board.)
  if (id === B.ship_mast) {
    const mi = m.masts.findIndex((mm) => mm.x === x && mm.z === z && y >= mm.base - 3);
    if (mi >= 0) S.sailHp[mi] = 0;
  }
  S.recount();
  holdVoxel(game, S, vi);
  game.net?.shipChanged?.(S, vi);
  // Splinters.
  const [wx, wz] = S.toWorld(x + 0.5, z + 0.5);
  const r = game.renderer;
  if (r && r.emit && why !== 'quiet') r.emit(wx, S.layerY(y) + 0.4, wz, { n: 7, color: ['#8a6438', '#5a3c22', '#c8a070'], up: 40, speed: 45, gravity: 140, life: 0.7 });
  return true;
}

// Knock out what's within `rad` of cell (x, y, z) of hers.
export function breakNear(game, S, x, y, z, rad, why) {
  const m = S.m;
  let n = 0;
  const R = Math.ceil(rad);
  for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy + dz * dz > rad * rad + 0.01) continue;
    const X = x + dx;
    const Y = y + dy;
    const Z = z + dz;
    if (X < 0 || Y < 0 || Z < 0 || X >= m.W || Y >= m.H || Z >= m.L) continue;
    const vi = (Y * m.L + Z) * m.W + X;
    // (Her keel's too stout for a single blow.)
    if (Y === 0) continue;
    if (breakVoxel(game, S, vi, why)) n++;
  }
  // Whoever's aboard and near: hurt by the splinters.
  if (n && why === 'shot') {
    for (const e of aboardOf(game, S)) {
      if (Math.hypot(e.deck.x - (x + 0.5), e.deck.z - (z + 0.5)) < 1.8 && Math.abs(e.deck.y - y) < 3) game.damage?.(e, 4 + Math.round(Math.random() * 4), null);
    }
  }
  return n;
}

// Mend cell vi of hers with a plank (or put back what was there): whatever
// it was built of. True if mended.
export function mendVoxel(game, S, vi) {
  const m = S.m;
  if (S.vox[vi] !== 0 || m.vox[vi] === 0) return false;
  S.vox[vi] = m.vox[vi];
  S.ver++;
  const x = vi % m.W;
  const z = Math.floor(vi / m.W) % m.L;
  if (m.vox[vi] === B.ship_mast) {
    const mi = m.masts.findIndex((mm) => mm.x === x && mm.z === z);
    if (mi >= 0 && S.sailHp[mi] === 0) S.sailHp[mi] = 0.3;
  }
  S.recount();
  holdVoxel(game, S, vi);
  game.net?.shipChanged?.(S, vi);
  return true;
}

// What can mend a plank of hers: any planks.
export const MENDS = (key) => key === 'planks' || (B[key] !== undefined && PLANK_BLOCKS.has(B[key]));

// ----------------------------------------------------------- the guns
// Fire gun `gi` of hers (`by`: whoever fired it). False if it's not ready.
export function fireGun(game, S, gi, by = null) {
  const g = S.m.guns[gi];
  const st = S.guns[gi];
  if (!g || !st || st.cd > 0 || S.vox[(g.y * S.m.L + g.z) * S.m.W + g.x] !== B.ship_cannon) return false;
  // (A gun deck's guns fire through their ports: shut, or stove in, no.)
  if (!g.deck && S.vox[(g.port.y * S.m.L + g.port.z) * S.m.W + g.port.x] !== B.gunport) return false;
  st.cd = RELOAD * (0.85 + Math.random() * 0.3);
  st.recoil = 1;
  S.runOut = true;
  S.runOutT = 20;
  const out = g.side;
  const ldx = out * Math.cos(st.aim);
  const ldz = -out * Math.sin(st.aim);
  const mx = (g.deck ? g.x : g.port.x) + 0.5 + ldx * 1.1;
  const mz = g.z + 0.5 + ldz * 1.1;
  const [wx, wz] = S.toWorld(mx, mz);
  const [dx, dz] = S.dirWorld(ldx, ldz);
  const h = S.layerY(g.y - 1) + 0.55;
  const sp = BALL_SPEED;
  const vy = st.elev * 22;
  const ball = { x: wx, y: h, z: wz, vx: dx * sp + Math.sin(S.yaw) * S.v, vy, vz: dz * sp + Math.cos(S.yaw) * S.v, t: 0, ship: S.id, by: by ? by.id : null };
  (game.cannonballs ||= []).push(ball);
  // Smoke and fire at the muzzle; the bang; the deck jumps.
  const r = game.renderer;
  if (r && r.emit) {
    r.emit(wx, h + 0.3, wz, { n: 14, color: ['#e8e4dc', '#c8c4bc', '#a8a49c'], up: 18, speed: 26, gravity: -10, life: 1.6, size: 2 });
    r.emit(wx, h + 0.3, wz, { n: 8, color: ['#fff0a0', '#ffb040', '#ff7020'], up: 10, speed: 40, gravity: 0, life: 0.18, glow: true });
  }
  game.audio?.play('cannon', { x: Math.round(wx), y: GROUND, z: Math.round(wz) });
  shakeAboard(game, S, 0.18);
  return true;
}

// Cannonballs in flight: what they hit (a ship's planks, her sails, anyone
// in the way, the shore, the sea).
function tickBalls(game, dt) {
  const list = game.cannonballs;
  if (!list || !list.length) return;
  const keep = [];
  for (const b of list) {
    const steps = 3;
    let done = false;
    for (let k = 0; k < steps && !done; k++) {
      const h = dt / steps;
      b.x += b.vx * h;
      b.z += b.vz * h;
      b.y += b.vy * h;
      b.vy -= BALL_GRAV * h;
      b.t += h;
      done = ballHits(game, b);
    }
    if (!done && b.t < 5) keep.push(b);
  }
  game.cannonballs = keep;
}

function ballHits(game, b) {
  const r = game.renderer;
  // A ship?
  for (const S of shipsOf(game)) {
    if (S.id === b.ship && b.t < 0.35) continue;
    if (Math.hypot(S.x - b.x, S.z - b.z) > S.m.L * 0.6 + 4) continue;
    const [lx, lz] = S.toLocal(b.x, b.z);
    const m = S.m;
    const ly = Math.ceil(b.y - m.yBase - S.yOff);
    const cx = Math.floor(lx);
    const cz = Math.floor(lz);
    // Through her sails: holed.
    for (let mi = 0; mi < m.masts.length; mi++) {
      const mm = m.masts[mi];
      if (Math.abs(lz - (mm.z + 0.5)) < 1.2 && Math.abs(lx - m.px) < m.W * 0.7 && ly > mm.base + 1 && ly < mm.base + mm.h * 0.9 && !b.sails?.includes(mi)) {
        (b.sails ||= []).push(mi);
        S.sailHp[mi] = Math.max(0, S.sailHp[mi] - 0.09);
      }
    }
    if (cx < 0 || cz < 0 || cx >= m.W || cz >= m.L || ly < 0 || ly >= m.H) continue;
    const id = vAt(m, S.vox, cx, ly, cz);
    if (!id) continue;
    breakNear(game, S, cx, ly, cz, 1.25, 'shot');
    shakeAboard(game, S, 0.5);
    r?.emit(b.x, b.y + 0.3, b.z, { n: 16, color: ['#8a6438', '#5a3c22', '#c8a070', '#3a3a3a'], up: 50, speed: 60, gravity: 140, life: 0.9 });
    r?.emit(b.x, b.y + 0.3, b.z, { n: 8, color: ['#b8b4ac', '#d8d4cc'], up: 14, speed: 16, gravity: -8, life: 1.4, size: 2 });
    game.audio?.play('crash', { x: Math.round(b.x), y: GROUND, z: Math.round(b.z) });
    game.onShipShot?.(S, b);
    return true;
  }
  // Someone in the way (not aboard a ship: they're the ship's to hurt).
  const tx = Math.round(b.x);
  const tz = Math.round(b.z);
  for (const list of [game.creatures || [], game.npcs || [], game.everyone ? game.everyone() : []]) {
    for (const e of list) {
      if (e.dead || e.deck || Math.abs(e.x - tx) > 0 || Math.abs(e.z - tz) > 0 || Math.abs(e.y + 0.8 - b.y) > 1.6) continue;
      const by = b.by !== null ? findBy(game, b.by) : null;
      game.damage?.(e, 14, by);
      r?.emit(b.x, b.y, b.z, { n: 10, color: ['#c83a32', '#8a2a2a', '#5a5a5a'], up: 40, speed: 40, gravity: 120, life: 0.6 });
      return true;
    }
  }
  // The sea, or the shore.
  const w = game.world;
  const below = Math.floor(b.y);
  if (b.y < SURFACE - 0.25 + 1) {
    if (w.isWaterAt(tx, SURFACE, tz)) {
      r?.emit(b.x, GROUND, b.z, { n: 22, color: ['#ffffff', '#c8e8ff', '#a0d0f0'], up: 90, speed: 30, gravity: 160, life: 0.9 });
      game.audio?.play('splash', { x: tx, y: GROUND, z: tz });
      return true;
    }
  }
  const id = w.getBlock(tx, below, tz);
  if (id && BLOCKS[id].solid) {
    r?.emit(b.x, b.y + 0.2, b.z, { n: 16, color: ['#8a7a68', '#6a5a48', '#b8a890'], up: 40, speed: 50, gravity: 140, life: 0.8 });
    r?.emit(b.x, b.y + 0.4, b.z, { n: 6, color: ['#b8b4ac', '#d8d4cc'], up: 14, speed: 16, gravity: -8, life: 1.4, size: 2 });
    game.audio?.play('boom', { x: tx, y: GROUND, z: tz });
    return true;
  }
  return false;
}

function findBy(game, id) {
  for (const q of game.everyone ? game.everyone() : [game.player]) if (q.id === id) return q;
  for (const c of game.sailors || []) if (c.id === id) return c;
  return null;
}

// ----------------------------------------------------------- aboard her
// Someone's place on her deck: `e.deck` = { s: her id, x, z (where they're
// drawn, in her frame), y (their feet's layer of hers), cx, cz (their
// cell), mv (a step under way), role ('helm', 'gun', null) }.
export function putAboard(game, S, e, cx, y, cz) {
  game.removeOcc?.(e);
  e.sitting = null;
  e.raft = null;
  e.mount = null;
  e.deck = { s: S.id, x: cx + 0.5, z: cz + 0.5, y, cx, cz, mv: null, role: null };
  e.moveT = 1;
  e.inWater = false;
  syncOne(game, S, e);
}

// The nearest place to stand on her deck to her cell (x, z) (out on
// deck, not below), within `r` cells; null if none.
export function deckSpotNear(S, x, z, r = 3, fy = null) {
  const m = S.m;
  let best = null;
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const cx = Math.round(x) + dx;
    const cz = Math.round(z) + dz;
    if (!onPlan(m, cx, cz)) continue;
    for (let y = m.H + 1; y >= 1; y--) {
      if (!standOn(m, S.vox, cx, y, cz) || isInside(m, cx, y, cz)) continue;
      const d = Math.hypot(cx + 0.5 - x, cz + 0.5 - z) + (fy !== null ? Math.abs(y - fy) * 0.3 : 0) + (occupiedOn(null, S, cx, y, cz) ? 5 : 0);
      if (!best || d < best.d) best = { cx, y, cz, d };
      break;
    }
  }
  return best;
}

let walkersCache = null;
function occupiedOn(game, S, cx, y, cz, self = null) {
  const list = walkersCache || [];
  for (const e of list) if (e !== self && e.deck && e.deck.s === S.id && e.deck.cx === cx && e.deck.cz === cz && Math.abs(e.deck.y - y) < 2) return e;
  return null;
}

// Each frame: everyone aboard carried with her (and where they are in the
// world brought up to date, for whoever's looking for them).
function syncWalkers(game, dt) {
  const all = [];
  for (const q of game.everyone ? game.everyone() : [game.player]) if (q && q.deck) all.push(q);
  for (const c of game.sailors || []) if (c.deck) all.push(c);
  walkersCache = all;
  for (const e of all) {
    const S = shipById(game, e.deck.s);
    if (!S) {
      e.deck = null;
      continue;
    }
    advanceStep(game, S, e, dt);
    if (e.deck) syncOne(game, S, e);
  }
}

function syncOne(game, S, e) {
  const d = e.deck;
  const [wx, wz] = S.toWorld(d.x, d.z);
  const tx = Math.round(wx);
  const tz = Math.round(wz);
  const ty = Math.round(S.layerY(d.y));
  e.wx = wx;
  e.wz = wz;
  if (tx !== e.x || tz !== e.z || ty !== e.y) {
    if (game.moveEntity) game.moveEntity(e, tx, ty, tz);
    else {
      e.x = tx;
      e.y = ty;
      e.z = tz;
    }
  }
  e.fx = e.x;
  e.fy = e.y;
  e.fz = e.z;
  e.moveT = 1;
  e.inWater = false;
}

// A step on her deck going on.
function advanceStep(game, S, e, dt) {
  const d = e.deck;
  const mv = d.mv;
  if (!mv) return;
  mv.t = Math.min(1, mv.t + dt / mv.dur);
  const k = mv.t < 0.5 ? 2 * mv.t * mv.t : 1 - Math.pow(-2 * mv.t + 2, 2) / 2;
  d.x = mv.fx + (mv.tx - mv.fx) * k;
  d.z = mv.fz + (mv.tz - mv.fz) * k;
  e.walking = true;
  if (mv.t < 1) return;
  d.mv = null;
  e.walking = false;
  d.x = d.cx + 0.5;
  d.z = d.cz + 0.5;
  // Down a hatch, through a door, through a hole in her deck: below.
  if (isInside(S.m, d.cx, d.y, d.cz)) enterHold(game, S, e, d.cx, d.y, d.cz);
}

// Take a step on her deck, `dx`/`dz` cells of hers (each -1, 0 or 1).
export function deckStep(game, S, e, dx, dz, dur) {
  const d = e.deck;
  const m = S.m;
  if (d.mv) return false;
  const tx = d.cx + dx;
  const tz = d.cz + dz;
  if (dx && dz) {
    // (No cutting corners.)
    if (stepOn(m, S.vox, d.cx, d.y, d.cz, d.cx + dx, d.cz) < 0 || stepOn(m, S.vox, d.cx, d.y, d.cz, d.cx, d.cz + dz) < 0) return false;
  }
  // Off her edge (a gangway, a gap in the rail, a hole in her side):
  // ashore, or over the side.
  if (!onPlan(m, tx, tz)) return offEdge(game, S, e, tx, tz);
  const ny = stepOn(m, S.vox, d.cx, d.y, d.cz, tx, tz);
  if (ny < 0) return false;
  const other = occupiedOn(game, S, tx, ny, tz, e);
  if (other && other.kind !== 'player') {
    // (Squeeze past one of the crew: they step where you were.)
    if (other.deck && !other.deck.mv && !other.deck.role) {
      other.deck.mv = { fx: other.deck.x, fz: other.deck.z, tx: d.cx + 0.5, tz: d.cz + 0.5, t: 0, dur };
      other.deck.cx = d.cx;
      other.deck.cz = d.cz;
      other.deck.y = d.y;
    } else return false;
  } else if (other) return false;
  d.mv = { fx: d.x, fz: d.z, tx: tx + 0.5, tz: tz + 0.5, t: 0, dur: dur * (dx && dz ? 1.41 : 1) * (ny !== d.y ? 1.15 : 1) };
  d.cx = tx;
  d.cz = tz;
  d.y = ny;
  // Facing the way they're going (in the world).
  const [wdx, wdz] = S.dirWorld(dx, dz);
  e.dir = Math.abs(wdx) > Math.abs(wdz) ? (wdx < 0 ? 1 : 3) : wdz < 0 ? 2 : 0;
  return true;
}

// Off her edge at her cell (tx, tz): onto a pier or the shore if there's
// one level enough, else into the sea.
function offEdge(game, S, e, tx, tz) {
  const [wx, wz] = S.toWorld(tx + 0.5, tz + 0.5);
  const rx = Math.round(wx);
  const rz = Math.round(wz);
  const w = game.world;
  const fy = Math.round(S.layerY(e.deck.y));
  for (const y of [fy, fy - 1, fy + 1, fy - 2, fy - 3]) {
    if (w.canStand(rx, y, rz) && !w.isWaterAt(rx, y, rz) && !w.isWaterAt(rx, y - 1, rz)) {
      leaveDeck(game, e);
      e.teleport(rx, y, rz);
      if (e.kind === 'player') game.asPlayer(e, () => game.ui.msg(`You step off ${theShip(S)}.`, '#a0d8ff', true));
      return true;
    }
  }
  if (e.kind !== 'player') return false;
  // (Over the side only on purpose: a moment's hold at the rail.)
  e.deck.edgeT = (e.deck.edgeT || 0) + 1;
  if (e.deck.edgeT < 4) {
    if (e.deck.edgeT === 1) game.asPlayer(e, () => game.ui.msg('Keep going to go over the side.', '#c8c8c8', true));
    return false;
  }
  overboard(game, S, e, false);
  return true;
}

// Into the sea from her, at or near where they are.
export function overboard(game, S, e, sinking) {
  const d = e.deck;
  if (!d) return;
  const [wx, wz] = S.toWorld(d.x, d.z);
  leaveDeck(game, e);
  const w = game.world;
  // (Clear of her side.)
  const [ox, oz] = S.dirWorld(d.x < S.m.px ? -1 : 1, 0);
  let best = null;
  for (let k = 1; k <= 6 && !best; k++) {
    const x = Math.round(wx + ox * k * 1.2);
    const z = Math.round(wz + oz * k * 1.2);
    if (w.isWaterAt(x, SURFACE, z) || w.canStand(x, GROUND, z)) best = { x, z };
  }
  best ||= { x: Math.round(wx), z: Math.round(wz) };
  const y = w.findStandY(best.x, best.z, SURFACE);
  if (e.kind === 'sailor') {
    e.dead = true;
    return;
  }
  e.teleport(best.x, y >= 0 ? y : SURFACE, best.z);
  game.audio?.play('splash', { x: best.x, y: GROUND, z: best.z });
  game.renderer?.emit(best.x, GROUND, best.z, { n: 14, color: ['#ffffff', '#c8e8ff'], up: 60, speed: 30, gravity: 140, life: 0.7 });
  if (e.kind === 'player') {
    game.asPlayer(e, () => {
      game.ui.msg(sinking ? 'You\'re in the sea, the ship going down beside you.' : 'Over the side you go, into the sea.', '#a0d8ff');
      // (Gone down in the storm round the islands: the sea has you.)
      const ow = w.ow;
      if (sinking && ow && ow.stormAt && !ow.wallDown && ow.stormAt(best.x, best.z) > STORM_WALL) washAshore(game);
    });
  }
}

export function leaveDeck(game, e) {
  const d = e.deck;
  if (!d) return;
  const S = shipById(game, d.s);
  if (S) {
    if (S.helmBy === e.id) S.helmBy = null;
    for (const g of S.guns) if (g.by === e.id) g.by = null;
  }
  e.deck = null;
  e.walking = false;
}

// Climb aboard her from the world: the place on her deck nearest (wx, wz).
export function boardAt(game, S, e, wx, wz) {
  const [lx, lz] = S.toLocal(wx, wz);
  const spot = deckSpotNear(S, lx, lz, 4, null);
  if (!spot) return false;
  putAboard(game, S, e, spot.cx, spot.y, spot.cz);
  if (e.kind === 'player') game.asPlayer(e, () => {
    game.ui.msg(`You climb aboard ${theShip(S)}.`, '#a0d8ff', true);
    game.audio?.play('step');
  });
  return true;
}

// The ship whose hull covers world (wx, wz), if any (and where in her).
export function shipAtWorld(game, wx, wz, pad = 0) {
  for (const S of shipsOf(game)) {
    if (S.sinking > 2) continue;
    if (Math.hypot(S.x - wx, S.z - wz) > S.m.L / 2 + 2 + pad) continue;
    const [lx, lz] = S.toLocal(wx, wz);
    for (const [ox, oz] of pad ? [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]] : [[0, 0]]) {
      const cx = Math.floor(lx + ox);
      const cz = Math.floor(lz + oz);
      if (onPlan(S.m, cx, cz)) return { S, lx, lz, cx, cz };
    }
  }
  return null;
}

// A step from the world toward (nx, nz) onto a ship's deck: aboard, if her
// deck's within a climb of where they are (from the water, any climb).
export function tryBoardStep(game, e, nx, nz) {
  const hit = shipAtWorld(game, nx, nz);
  if (!hit) return false;
  const { S } = hit;
  if (S.sinking) return false;
  const spot = deckSpotNear(S, hit.lx, hit.lz, 2, null);
  if (!spot) return false;
  const dy = S.layerY(spot.y) - e.y;
  if (dy > 3 && !e.inWater && !game.world.isWaterAt(e.x, e.y, e.z)) return false;
  return boardAt(game, S, e, nx, nz);
}

// --------------------------------------------------------- the player
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
function toWorldDir(du, dv, view) {
  switch (view) {
    case 1: return [dv, 0 - du];
    case 2: return [0 - du, 0 - dv];
    case 3: return [0 - dv, du];
    default: return [du, dv];
  }
}

// A player aboard, each frame: walking her deck, or at her wheel, or at a
// gun.
export function deckUpdate(game, p, dt, input, blocked) {
  const d = p.deck;
  const S = shipById(game, d.s);
  if (!S) {
    p.deck = null;
    return;
  }
  if (blocked) return;
  const down = (k) => input.isDown(k);
  if (d.role === 'helm') return helmControl(game, S, p, dt, input);
  if (d.role === 'gun') return gunControl(game, S, p, dt, input);
  if (d.role === 'pump') {
    S.pumpers = (S.pumpers || 0) + 1;
    if (Object.keys(MOVE).some(down)) d.role = null;
    return;
  }
  if (d.mv) return;
  let du = 0;
  let dv = 0;
  for (const k in MOVE) if (down(k)) {
    du += MOVE[k][0];
    dv += MOVE[k][1];
  }
  if (!du && !dv) {
    if (d.edgeT) d.edgeT = Math.max(0, d.edgeT - dt * 4);
    return;
  }
  const view = game.renderer ? game.renderer.view || 0 : 0;
  const [wdx, wdz] = toWorldDir(du, dv, view);
  const [ldx, ldz] = S.dirLocal(wdx, wdz);
  const k = Math.round(Math.atan2(ldz, ldx) / (Math.PI / 4));
  const a = k * (Math.PI / 4);
  const sx = Math.round(Math.cos(a));
  const sz = Math.round(Math.sin(a));
  const sprint = (down('ShiftLeft') || down('ShiftRight')) && (p.stamina ?? 10) > 0.4;
  const dur = PLAYER_STEP_TIME * (sprint ? 0.72 : 1);
  if (!deckStep(game, S, p, sx, sz, dur)) {
    // (Along whichever way's open, if the straight way isn't.)
    if (sx && sz) {
      if (!deckStep(game, S, p, sx, 0, dur)) deckStep(game, S, p, 0, sz, dur);
    }
  }
}

// At the wheel: A and D put the helm over, W and S make and take in sail,
// Z and X (or the mouse wheel) haul in and ease the sheets, R lets go or
// weighs the anchor, a click fires a broadside to whichever side you point.
function helmControl(game, S, p, dt, input) {
  const down = (k) => input.isDown(k);
  const left = down('KeyA') || down('ArrowLeft');
  const right = down('KeyD') || down('ArrowRight');
  if (left || right) {
    S.rudder = Math.max(-1, Math.min(1, S.rudder + (left ? 1 : -1) * dt * 1.4));
    S.helmHeld = true;
  }
  if (down('KeyW') || down('ArrowUp')) S.sailGoal = Math.min(1, S.sailGoal + dt * 0.6);
  if (down('KeyS') || down('ArrowDown')) {
    // (All sail in, and still S: her sails laid aback, backing her.)
    if (S.sailGoal <= 0.02 && S.sailSet <= 0.1) S.backT = Math.max(S.backT || 0, 0.3);
    S.sailGoal = Math.max(0, S.sailGoal - dt * 0.6);
  }
  if (down('KeyZ')) {
    S.sheet = Math.max(0, S.sheet - dt * 0.5);
    S.manualT = 10;
  }
  if (down('KeyX')) {
    S.sheet = Math.min(1, S.sheet + dt * 0.5);
    S.manualT = 10;
  }
  if (S.sailGoal > 0.05 && S.anchor) {
    S.anchor = false;
    game.ui.msg('Anchor\'s aweigh!', '#a0d8ff', true);
  }
  S.helmBy = p.id;
}

// Manning a gun: point to aim it (it trains round within its port), W and
// S (or the mouse wheel) to raise and lower it, click to fire.
function gunControl(game, S, p, dt, input) {
  const d = p.deck;
  const g = S.m.guns[d.gi];
  const st = S.guns[d.gi];
  if (!g || !st) {
    d.role = null;
    return;
  }
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) st.elev = Math.min(0.55, st.elev + dt * 0.35);
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) st.elev = Math.max(-0.08, st.elev - dt * 0.35);
  const ang = game.aimAngle ? game.aimAngle() : null;
  if (ang !== null && ang !== undefined) {
    const [ldx, ldz] = S.dirLocal(Math.cos(ang), Math.sin(ang));
    const aim = Math.atan2(-ldz * g.side, ldx * g.side);
    st.aim = Math.max(-0.6, Math.min(0.6, aim));
  }
  st.by = p.id;
}

// The helm, a gun, the pump, a hatch, the ship's bell: what F does aboard
// (the nearest of them to you). True if it did something.
export function deckInteract(game, p) {
  const d = p.deck;
  const S = shipById(game, d.s);
  if (!S) return false;
  const m = S.m;
  if (d.role) {
    if (d.role === 'helm') {
      S.helmBy = null;
      game.ui.msg('You let go of the wheel.', '#c8c8c8', true);
    } else if (d.role === 'gun') game.ui.msg('You leave the gun.', '#c8c8c8', true);
    d.role = null;
    d.gi = undefined;
    return true;
  }
  const near = (x, y, z, r = 1.6) => Math.hypot(d.cx + 0.5 - (x + 0.5), d.cz + 0.5 - (z + 0.5)) <= r && Math.abs(d.y - y) <= 2;
  // The wheel.
  if (near(m.helm.x, m.helm.y, m.helm.z) && S.vox[(m.helm.y * m.L + m.helm.z) * m.W + m.helm.x] === B.helm) {
    if (S.owner && S.owner !== ownerId(game, p) && !game.cheats?.ships) {
      game.ui.msg('She\'s not your ship: her crew won\'t let you near the wheel.', '#ffb080', true);
      return true;
    }
    const other = S.helmBy && S.helmBy !== p.id ? findBy(game, S.helmBy) : null;
    if (other && other.kind === 'player') {
      game.ui.msg(`${other.name || 'Someone'} has the wheel.`, '#c8c8c8', true);
      return true;
    }
    d.role = 'helm';
    S.helmBy = p.id;
    game.ui.msg('You take the wheel. A/D steer, W/S make and take in sail, Z/X haul and ease the sheets, R the anchor, click to fire a broadside. F to let go.', '#a0d8ff');
    return true;
  }
  // A gun on her deck.
  let gi = -1;
  let best = 9;
  m.guns.forEach((g, i) => {
    if (!g.deck) return;
    const dd = Math.hypot(d.cx - g.x, d.cz - g.z);
    if (dd < best && dd <= 1.6 && Math.abs(d.y - g.y) <= 1) {
      best = dd;
      gi = i;
    }
  });
  if (gi >= 0) {
    d.role = 'gun';
    d.gi = gi;
    game.ui.msg('You man the gun. Point to aim, W/S to raise and lower it, click to fire (a cannonball a shot). F to leave it.', '#a0d8ff');
    return true;
  }
  return false;
}

export function ownerId(game, p) {
  return (p && p.account && p.account.id) || (game.seat && game.seat.profile && game.seat.profile.id) || 'me';
}

// Shot and the like, from whoever's aboard: what a click does there.
// True if it was the ship's to handle.
export function deckClick(game, p) {
  const d = p.deck;
  if (!d) return false;
  const S = shipById(game, d.s);
  if (!S) return false;
  if (d.role === 'gun') {
    const st = S.guns[d.gi];
    if (st.cd > 0) {
      game.ui.msg(`Still loading (${Math.ceil(st.cd)}s).`, '#c8c8c8', true);
      return true;
    }
    if (!takeShot(game, p, S, 1)) return true;
    fireGun(game, S, d.gi, p);
    return true;
  }
  if (d.role === 'helm') {
    // A broadside to the side you point.
    const ang = game.aimAngle ? game.aimAngle() : null;
    if (ang === null || ang === undefined) return true;
    const [ldx] = S.dirLocal(Math.cos(ang), Math.sin(ang));
    const side = ldx >= 0 ? 1 : -1;
    const ready = S.m.guns.map((g, i) => [g, i]).filter(([g, i]) => g.side === side && S.guns[i].cd <= 0);
    if (!ready.length) {
      game.ui.msg('No guns loaded on that side.', '#c8c8c8', true);
      return true;
    }
    // (Each gun needs hands: a gun crew of the crew aboard, or yours.)
    const crew = (game.sailors || []).filter((c) => c.deck && c.deck.s === S.id && !c.dead).length;
    const n = Math.min(ready.length, Math.max(1, crew));
    let fired = 0;
    for (const [, i] of ready.slice(0, n)) {
      if (!takeShot(game, p, S, 1)) break;
      const st = S.guns[i];
      st.aim = 0;
      setTimeout0(game, fired * 0.18, () => fireGun(game, S, i, p));
      fired++;
    }
    if (fired) game.ui.msg(`Broadside! ${fired} gun${fired > 1 ? 's' : ''} to ${side > 0 ? 'starboard' : 'larboard'}.`, '#ffd080', true);
    return true;
  }
  return false;
}

// A shot for a gun: from her own store, or the player's pack.
function takeShot(game, p, S, n) {
  if (S.ammo >= n) {
    S.ammo -= n;
    return true;
  }
  const inv = p.inv || [];
  let have = 0;
  for (const s of inv) if (s && s.item === 'cannonball') have += s.count;
  if (have < n) {
    game.ui.msg('No cannonballs (an anvil makes them out of iron, sulphur and coal; a shipwright sells them).', '#ffb080', true);
    return false;
  }
  let need = n;
  for (let i = 0; i < inv.length && need > 0; i++) {
    const s = inv[i];
    if (!s || s.item !== 'cannonball') continue;
    const k = Math.min(need, s.count);
    s.count -= k;
    need -= k;
    if (s.count <= 0) inv[i] = null;
  }
  return true;
}

// Something to happen a moment from now (in the game's own time).
function setTimeout0(game, delay, fn) {
  if (delay <= 0) return fn();
  (game.shipLater ||= []).push({ t: delay, fn });
}
export function tickLater(game, dt) {
  const L = game.shipLater;
  if (!L || !L.length) return;
  for (const q of [...L]) {
    q.t -= dt;
    if (q.t <= 0) {
      L.splice(L.indexOf(q), 1);
      q.fn();
    }
  }
}

// Where someone aboard is drawn in the world (renderPos): carried with her.
export function deckRenderPos(game, e) {
  const S = shipById(game, e.deck.s);
  if (!S) return null;
  const [wx, wz] = S.toWorld(e.deck.x, e.deck.z);
  return { x: wx, y: S.layerY(e.deck.y), z: wz };
}

// For the HUD: how she's going.
export function shipStatus(game, S) {
  const W = windOf(game);
  const P = pointOfSail(S, W);
  return {
    name: S.name, type: S.type, speed: Math.abs(S.v), raft: Math.abs(S.v) / 5, set: S.sailSet, goal: S.sailGoal, sheet: S.sheet, ideal: P.ideal, trim: P.trim, drive: P.drive,
    deg: P.deg, hull: S.whole, flood: S.flood, anchor: S.anchor, windRel: Math.atan2(...S.dirLocal(W.x, W.z)), windK: W.k, ammo: S.ammo,
    loaded: S.guns.filter((g) => g.cd <= 0).length, guns: S.guns.length, sails: S.sailHp.reduce((a, b) => a + b, 0) / S.sailHp.length,
  };
}

// Saved with the world.
export function saveShips(game) {
  return shipsOf(game).filter((S) => !S.sinking && !S.transient).map((S) => S.save());
}

export function loadShips(game, list) {
  game.ships3d = [];
  for (const o of list || []) {
    try {
      if (SHIP_TYPES[o.type]) game.ships3d.push(new Ship(o));
    } catch {
      // (A ship that can't be put back is lost at sea.)
    }
  }
}

// Mended by hand: hammer a plank into hole vi of hers.
export function mendWith(game, p, S, vi) {
  const inv = p.inv || [];
  const k = inv.findIndex((s) => s && MENDS(s.item));
  if (k < 0) {
    game.ui.msg('You need planks to mend her.', '#ffb080', true);
    return false;
  }
  if (!mendVoxel(game, S, vi)) return false;
  inv[k].count--;
  if (inv[k].count <= 0) inv[k] = null;
  game.audio?.play('place');
  return true;
}

// The hole of hers next to face `face` of cell vi (where a plank would go),
// or the cell itself if it's a hole.
export function holeBeside(S, vi, face) {
  const m = S.m;
  const x = vi % m.W;
  const z = Math.floor(vi / m.W) % m.L;
  const y = Math.floor(vi / (m.W * m.L));
  const D = [[0, 1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, 0, 0]][face] || [0, 0, 0];
  const cands = [[x + D[0], y + D[1], z + D[2]], [x, y, z]];
  // (And any hole round it, nearest first.)
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) cands.push([x + D[0] + dx, y + D[1] + dy, z + D[2] + dz]);
  for (const [cx, cy, cz] of cands) {
    if (cx < 0 || cy < 0 || cz < 0 || cx >= m.W || cy >= m.H || cz >= m.L) continue;
    const j = (cy * m.L + cz) * m.W + cx;
    if (S.vox[j] === 0 && m.vox[j] !== 0) return j;
  }
  return -1;
}

export function hashSeed(S) {
  return hash4(S.id, 77, 13);
}

// ------------------------------------------------------------ over the net
// What a player's screen needs of her, this moment (see net/host.js): where
// she is and how she's going, her sails and helm and guns, and (when it's
// changed since they last had it) every plank of hers that isn't as built.
export function packShip(S, withCells) {
  const r2 = (v) => Math.round(v * 100) / 100;
  const out = {
    id: S.id, type: S.type, x: r2(S.x), z: r2(S.z), yaw: Math.round(S.yaw * 1000) / 1000, v: r2(S.v), yv: Math.round(S.yawV * 1000) / 1000, yo: r2(S.yOff),
    ss: r2(S.sailSet), sg: r2(S.sailGoal), sh: r2(S.sheet), br: r2(S.brace), bo: r2(S.boom), fi: r2(S.fill || 0), le: S.lee || 1, wh: r2(S.wheel), ru: r2(S.rudder),
    ro: S.runOut ? 1 : 0, hp: S.sailHp.map(r2), g: S.guns.map((g) => [r2(g.aim), r2(g.elev), g.cd > 0 ? r2(g.cd) : 0, r2(g.recoil)]),
    n: S.name, pa: S.paint, p2: S.paint2, fl: S.flag, em: S.emblem, ow: S.owner, fd: r2(S.floodCells), an: S.anchor ? 1 : 0, sk: r2(S.sinking || 0),
    wl: S.windLocal ? [r2(S.windLocal.x), r2(S.windLocal.z)] : null, ver: S.ver, hb: S.helmBy ?? null, am: S.ammo,
  };
  if (withCells) {
    const m = S.m;
    const diff = [];
    for (let i = 0; i < m.N; i++) if (S.vox[i] !== m.vox[i]) diff.push(i, S.vox[i]);
    out.vd = diff;
  }
  return out;
}

// Brought up to date on a player's screen from what was sent.
export function applyShips(game, list) {
  const keep = new Set();
  const ships = shipsOf(game);
  for (const d of list || []) {
    keep.add(d.id);
    let S = shipById(game, d.id);
    if (!S) {
      S = new Ship({ id: d.id, type: d.type, x: d.x, z: d.z, yaw: d.yaw, name: d.n });
      ships.push(S);
    }
    // (Where she is: eased toward what's sent, not jumped.)
    const far = Math.hypot(S.x - d.x, S.z - d.z) > 6;
    S.netGoal = { x: d.x, z: d.z, yaw: d.yaw };
    if (far) {
      S.x = d.x;
      S.z = d.z;
      S.yaw = d.yaw;
    }
    S.v = d.v;
    S.yawV = d.yv;
    S.yOff = d.yo;
    S.sailSet = d.ss;
    S.sailGoal = d.sg;
    S.sheet = d.sh;
    S.brace = d.br;
    S.boom = d.bo;
    S.fill = d.fi;
    S.lee = d.le;
    S.wheel = d.wh;
    S.rudder = d.ru;
    S.runOut = !!d.ro;
    S.sailHp = d.hp;
    d.g.forEach((q, i) => {
      if (!S.guns[i]) return;
      Object.assign(S.guns[i], { aim: q[0], elev: q[1], cd: q[2], recoil: q[3] });
    });
    S.name = d.n;
    S.paint = d.pa;
    S.paint2 = d.p2;
    S.flag = d.fl;
    S.emblem = d.em;
    S.owner = d.ow;
    S.floodCells = d.fd;
    S.anchor = !!d.an;
    S.sinking = d.sk;
    S.windLocal = d.wl ? { x: d.wl[0], z: d.wl[1] } : S.windLocal;
    S.helmBy = d.hb;
    S.ammo = d.am;
    if (d.vd) {
      S.vox.set(S.m.vox);
      for (let k = 0; k < d.vd.length; k += 2) S.vox[d.vd[k]] = d.vd[k + 1];
      S.ver = d.ver;
      S.recount();
    }
  }
  game.ships3d = ships.filter((S) => keep.has(S.id));
}

// Between words from the host: on as she was going.
export function driftShips(game, dt) {
  for (const S of shipsOf(game)) {
    S.yaw += (S.yawV || 0) * dt;
    S.x += Math.sin(S.yaw) * S.v * dt;
    S.z += Math.cos(S.yaw) * S.v * dt;
    const g = S.netGoal;
    if (g) {
      const k = Math.min(1, dt * 4);
      S.x += (g.x - S.x) * k;
      S.z += (g.z - S.z) * k;
      let dy = (g.yaw - S.yaw) % TAU;
      if (dy > Math.PI) dy -= TAU;
      if (dy < -Math.PI) dy += TAU;
      S.yaw += dy * k;
      g.x += Math.sin(S.yaw) * S.v * dt;
      g.z += Math.cos(S.yaw) * S.v * dt;
    }
    for (const q of S.guns) if (q.recoil > 0) q.recoil = Math.max(0, q.recoil - dt * 1.4);
  }
  for (const b of game.cannonballs || []) {
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.y += b.vy * dt;
    b.vy -= BALL_GRAV * dt;
  }
}
