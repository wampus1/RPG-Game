// Rigs (round 62): a piece of art cut into parts, each part on a bone,
// the bones jointed one to another; moved not frame by frame but by
// simple simulation: limbs swinging on their joints in time (a walk, an
// idle breath, an attack's swing, a flinch), keyframes where wanted, and
// springy bones (tails, ears, hair, wings) that lag and sway as the body
// moves. Baked into frames for the game's creatures (see MODS.rigLook),
// and drawn live in the Rig tool. Pure: no canvases here.
//
// A rig: { asset, frame (which of the art's frames is cut up), mask (each
// pixel's part, 1.., packed as format.encodeCel; 0: on the root bone),
// parts: [{ id, name, bone, z }], bones: [{ id, name, parent, x, y
// (its joint, in the art's pixels), role, phys: { on, stiff, damp, swing }
// }], anims: { name: { dur, loop, moves: { boneId: { rot, x, y, sq:
// [amp, cycles, phase] } }, keys: { boneId: { rot, x, y: [{ t, v, e }] } } }
// }, baseZ }.
import { MODS } from './state.js';
import { decodeCel, encodeCel, composite } from './format.js';
import { Px } from '../render/pixel.js';

export const ROLES = ['body', 'head', 'arm', 'leg', 'tail', 'wing', 'ear', 'hair', 'other'];
export const ANIMS = ['walk', 'idle', 'attack', 'hurt'];
export const PART_COLORS = ['#ff6060', '#60c0ff', '#80e070', '#ffd040', '#c080ff', '#ff9040', '#40e0c0', '#ff70c0', '#a0a0ff', '#e0e070', '#70a050', '#d08060', '#60e0ff', '#ffb0b0', '#b0ffb0', '#b0b0ff'];

// ------------------------------------------------------------ geometry
// 2D affine [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f.
const I = [1, 0, 0, 1, 0, 0];
export function mul(A, B) {
  return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
}
export function inv(A) {
  const det = A[0] * A[3] - A[1] * A[2] || 1e-9;
  const a = A[3] / det;
  const b = -A[1] / det;
  const c = -A[2] / det;
  const d = A[0] / det;
  return [a, b, c, d, -(a * A[4] + c * A[5]), -(b * A[4] + d * A[5])];
}
export const apply = (A, x, y) => [A[0] * x + A[2] * y + A[4], A[1] * x + A[3] * y + A[5]];
// Turned by θ (degrees) about joint (jx, jy), then moved (dx, dy).
function about(jx, jy, deg, dx = 0, dy = 0) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, jx + dx - (c * jx - s * jy), jy + dy - (s * jx + c * jy)];
}

// ------------------------------------------------------------ easing, waves
function ease(k, e) {
  k = Math.max(0, Math.min(1, k));
  if (e === 'in') return k * k;
  if (e === 'out') return 1 - (1 - k) * (1 - k);
  if (e === 'linear') return k;
  return k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
}
export function keyAt(keys, t) {
  if (!keys || !keys.length) return 0;
  if (t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.t && t <= b.t) return a.v + (b.v - a.v) * ease((t - a.t) / Math.max(1e-6, b.t - a.t), b.e || 'inout');
  }
  return 0;
}
// A wave [amp, cycles (over the animation), phase (0..1)] at time t.
const wave = (w, t, dur) => (w && w[0] ? w[0] * Math.sin(((t / dur) * (w[1] || 1) + (w[2] || 0)) * Math.PI * 2) : 0);

// ------------------------------------------------------------ a rig in use
export class RigPose {
  // src: { rgba, w, h } (the art's pixels).
  constructor(rig, src) {
    this.rig = rig;
    this.src = src;
    this.w = src.w;
    this.h = src.h;
    this.mask = decodeCel(rig.mask, src.w * src.h);
    const bones = rig.bones || [];
    this.byId = new Map(bones.map((b) => [b.id, b]));
    // (Parents before their children.)
    const order = [];
    const seen = new Set();
    const visit = (b, d = 0) => {
      if (!b || seen.has(b.id) || d > 32) return;
      if (b.parent && this.byId.has(b.parent)) visit(this.byId.get(b.parent), d + 1);
      if (!seen.has(b.id)) {
        seen.add(b.id);
        order.push(b);
      }
    };
    for (const b of bones) visit(b);
    this.order = order;
    this.root = order.find((b) => !b.parent || !this.byId.has(b.parent)) || null;
    // Each part's bone, and its pixels' box and middle.
    const parts = rig.parts || [];
    this.parts = parts.map((p, i) => ({ ...p, idx: i + 1, bone: this.byId.has(p.bone) ? p.bone : this.root ? this.root.id : null, box: null }));
    this.base = { idx: 0, bone: this.root ? this.root.id : null, z: rig.baseZ ?? 0, box: null };
    const all = [this.base, ...this.parts];
    const sums = new Map();
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = y * src.w + x;
      if (!src.rgba[i * 4 + 3]) continue;
      const k = this.mask[i];
      const P = all[k] || this.base;
      const b = P.box || (P.box = [x, y, x, y]);
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x;
      if (y > b[3]) b[3] = y;
      if (P.bone) {
        const s = sums.get(P.bone) || [0, 0, 0];
        s[0] += x;
        s[1] += y;
        s[2]++;
        sums.set(P.bone, s);
      }
    }
    this.layers = all.filter((p) => p.box).sort((a, b) => (b.z || 0) - (a.z || 0));
    // Where each bone's weight is (its "tip", for springing).
    this.tips = new Map();
    for (const b of bones) {
      const s = sums.get(b.id);
      this.tips.set(b.id, s ? [s[0] / s[2], s[1] / s[2]] : [b.x, b.y + 4]);
    }
    // The art's feet: the bottom middle of all of it (for squash).
    let bx0 = src.w;
    let bx1 = 0;
    let by1 = 0;
    for (const p of all) if (p.box) {
      bx0 = Math.min(bx0, p.box[0]);
      bx1 = Math.max(bx1, p.box[2]);
      by1 = Math.max(by1, p.box[3]);
    }
    this.feet = [(bx0 + bx1 + 1) / 2, by1 + 1];
    this.phys = new Map();
  }

  // Bones' places at time t of an animation (rigid: no springs).
  rigid(anim, t) {
    const out = new Map();
    const A = anim || { dur: 1, moves: {}, keys: {} };
    const dur = Math.max(0.05, A.dur || 1);
    const tt = A.loop === false ? Math.min(t, dur) : ((t % dur) + dur) % dur;
    for (const b of this.order) {
      const mv = (A.moves || {})[b.id] || {};
      const ky = (A.keys || {})[b.id] || {};
      const rot = wave(mv.rot, tt, dur) + keyAt(ky.rot, tt) + (b.rest || 0);
      const dx = wave(mv.x, tt, dur) + keyAt(ky.x, tt);
      const dy = wave(mv.y, tt, dur) + keyAt(ky.y, tt);
      let M = about(b.x, b.y, rot, dx, dy);
      const sq = wave(mv.sq, tt, dur);
      if (sq && b === this.root) {
        const [fx, fy] = this.feet;
        const S = [1 + sq, 0, 0, 1 - sq, fx - fx * (1 + sq), fy - fy * (1 - sq)];
        M = mul(S, M);
      }
      const P = b.parent && out.has(b.parent) ? out.get(b.parent) : I;
      out.set(b.id, mul(P, M));
    }
    return out;
  }

  // Bones' places at time t, the springy ones swung by how the rest moved
  // (call in order with a small dt; `reset` to start again).
  step(anim, t, dt, reset = false) {
    if (reset) this.phys.clear();
    const M = this.rigid(anim, t);
    const springs = this.order.filter((b) => b.phys && b.phys.on);
    if (!springs.length) return M;
    for (const b of springs) {
      const Mb = M.get(b.id);
      const [jx, jy] = apply(Mb, b.x, b.y);
      const [tx, ty] = apply(Mb, ...this.tips.get(b.id));
      let s = this.phys.get(b.id);
      if (!s) {
        s = { phi: 0, om: 0, px: jx, py: jy, vx: 0, vy: 0 };
        this.phys.set(b.id, s);
      }
      // How the joint was pushed about: its acceleration across the bone.
      const vx = (jx - s.px) / Math.max(1e-4, dt);
      const vy = (jy - s.py) / Math.max(1e-4, dt);
      const ax = dt > 0 ? (vx - s.vx) / dt : 0;
      const ay = dt > 0 ? (vy - s.vy) / dt : 0;
      s.px = jx;
      s.py = jy;
      s.vx = vx;
      s.vy = vy;
      const lx = tx - jx;
      const ly = ty - jy;
      const L = Math.hypot(lx, ly) || 1;
      const across = (ax * -ly + ay * lx) / L;
      const k = b.phys.stiff ?? 40;
      const c = b.phys.damp ?? 6;
      const sw = b.phys.swing ?? 1;
      const acc = -k * s.phi - c * s.om - (across / L) * sw * 0.9;
      s.om += acc * dt;
      s.phi += s.om * dt;
      s.phi = Math.max(-1.2, Math.min(1.2, s.phi));
      // (Turned about its own joint, and its children with it.)
      const R = about(jx, jy, (s.phi * 180) / Math.PI);
      const sub = new Set([b.id]);
      for (const q of this.order) if (q.parent && sub.has(q.parent)) sub.add(q.id);
      for (const id of sub) M.set(id, mul(R, M.get(id)));
    }
    return M;
  }

  // The posed art: RGBA of w x h, the art's (0, 0) at (ox, oy).
  render(M, w, h, ox, oy) {
    const out = new Uint8ClampedArray(w * h * 4);
    const S = this.src;
    for (const P of this.layers) {
      const B = (P.bone && M.get(P.bone)) || I;
      const iv = inv(B);
      // (Only where the part could have gone.)
      const bx = P.box;
      const corners = [apply(B, bx[0], bx[1]), apply(B, bx[2] + 1, bx[1]), apply(B, bx[0], bx[3] + 1), apply(B, bx[2] + 1, bx[3] + 1)];
      const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])) + ox) - 1);
      const x1 = Math.min(w - 1, Math.ceil(Math.max(...corners.map((c) => c[0])) + ox) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])) + oy) - 1);
      const y1 = Math.min(h - 1, Math.ceil(Math.max(...corners.map((c) => c[1])) + oy) + 1);
      for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
        const o = (Y * w + X) * 4;
        if (out[o + 3]) continue;
        const qx = X - ox + 0.5;
        const qy = Y - oy + 0.5;
        const sx = Math.floor(iv[0] * qx + iv[2] * qy + iv[4]);
        const sy = Math.floor(iv[1] * qx + iv[3] * qy + iv[5]);
        if (sx < 0 || sy < 0 || sx >= S.w || sy >= S.h) continue;
        const i = sy * S.w + sx;
        if (this.mask[i] !== P.idx || !S.rgba[i * 4 + 3]) continue;
        out[o] = S.rgba[i * 4];
        out[o + 1] = S.rgba[i * 4 + 1];
        out[o + 2] = S.rgba[i * 4 + 2];
        out[o + 3] = S.rgba[i * 4 + 3];
      }
    }
    return out;
  }

  // An animation baked into n frames (each w x h, padded about the art),
  // the springs settled by a turn round first.
  bake(animName, n, pad = null) {
    const A = (this.rig.anims || {})[animName] || null;
    const dur = Math.max(0.05, (A && A.dur) || 1);
    const p = pad ?? Math.ceil(Math.max(this.w, this.h) * 0.25);
    const W = this.w + p * 2;
    const H = this.h + p;
    const dt = 1 / 60;
    let t = 0;
    this.phys.clear();
    if (A && A.loop !== false) for (; t < dur; t += dt) this.step(A, t, dt);
    const frames = [];
    for (let i = 0; i < n; i++) {
      const target = (A && A.loop !== false ? dur : 0) + (i / n) * dur;
      let M = null;
      while (t <= target + 1e-9) {
        M = this.step(A, t, dt);
        t += dt;
      }
      frames.push(this.render(M || this.step(A, target, dt), W, H, p, p));
    }
    return { frames, w: W, h: H, pad: p };
  }
}

// ------------------------------------------------------------ quick rigs
// A rig made for art at a go: its bones where such a body's joints would
// be, its pixels shared out among them (by where they are in the art), and
// its animations made to suit. Kinds: walker (two legs), beast (four),
// flyer, blob, serpent, plant.
export const RIG_KINDS = {
  walker: 'Two legs (a person, a skeleton, a goblin)',
  beast: 'Four legs (a wolf, a boar, a lizard)',
  flyer: 'Wings (a bat, a bird, a moth)',
  blob: 'A blob (a slime, a jelly)',
  serpent: 'A serpent (a worm, an eel, a snake)',
  plant: 'Rooted (a plant, a totem, a tree creature)',
};

export function quickRig(kind, src, prev = {}) {
  const { w, h, rgba } = src;
  // The art's box.
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3]) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) {
    x0 = 0;
    y0 = 0;
    x1 = w - 1;
    y1 = h - 1;
  }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const X = (k) => x0 + bw * k;
  const Y = (k) => y0 + bh * k;
  const bones = [];
  const parts = [];
  const B = (id, name, parent, x, y, role, phys = null, rest = 0) => bones.push({ id, name, parent, x: Math.round(x), y: Math.round(y), role, rest, phys: phys || { on: false, stiff: 40, damp: 6, swing: 1 } });
  const P = (id, name, bone, z, test) => parts.push({ id, name, bone, z, test });
  const springy = (stiff = 30, damp = 4, swing = 1.4) => ({ on: true, stiff, damp, swing });
  if (kind === 'walker') {
    B('body', 'Body', null, X(0.5), Y(0.62), 'body');
    B('head', 'Head', 'body', X(0.5), Y(0.32), 'head');
    B('armf', 'Front arm', 'body', X(0.6), Y(0.38), 'arm');
    B('armb', 'Back arm', 'body', X(0.4), Y(0.38), 'arm');
    B('legf', 'Front leg', 'body', X(0.56), Y(0.66), 'leg');
    B('legb', 'Back leg', 'body', X(0.44), Y(0.66), 'leg');
    P('head', 'Head', 'head', 2, (x, y) => y < Y(0.32));
    P('legf', 'Front leg', 'legf', 1, (x, y) => y >= Y(0.68) && x >= X(0.5));
    P('legb', 'Back leg', 'legb', -1, (x, y) => y >= Y(0.68) && x < X(0.5));
    P('armf', 'Front arm', 'armf', 3, (x, y) => y >= Y(0.32) && y < Y(0.68) && x >= X(0.72));
    P('armb', 'Back arm', 'armb', -2, (x, y) => y >= Y(0.32) && y < Y(0.68) && x < X(0.28));
  } else if (kind === 'beast') {
    B('body', 'Body', null, X(0.45), Y(0.5), 'body');
    B('head', 'Head', 'body', X(0.72), Y(0.42), 'head');
    B('tail', 'Tail', 'body', X(0.18), Y(0.38), 'tail', springy());
    B('legf', 'Front legs', 'body', X(0.66), Y(0.68), 'leg');
    B('legb', 'Back legs', 'body', X(0.3), Y(0.68), 'leg');
    P('head', 'Head', 'head', 2, (x, y) => x >= X(0.74) && y < Y(0.7));
    P('tail', 'Tail', 'tail', -1, (x, y) => x < X(0.18) && y < Y(0.66));
    P('legf', 'Front legs', 'legf', 1, (x, y) => y >= Y(0.7) && x >= X(0.5));
    P('legb', 'Back legs', 'legb', 1, (x, y) => y >= Y(0.7) && x < X(0.5));
  } else if (kind === 'flyer') {
    B('body', 'Body', null, X(0.5), Y(0.55), 'body');
    B('wingf', 'Front wing', 'body', X(0.5), Y(0.45), 'wing');
    B('wingb', 'Back wing', 'body', X(0.45), Y(0.42), 'wing');
    B('head', 'Head', 'body', X(0.75), Y(0.5), 'head');
    P('wingf', 'Front wing', 'wingf', 2, (x, y) => y < Y(0.45) && x >= X(0.45));
    P('wingb', 'Back wing', 'wingb', -1, (x, y) => y < Y(0.45) && x < X(0.45));
    P('head', 'Head', 'head', 1, (x, y) => x >= X(0.75) && y >= Y(0.45));
  } else if (kind === 'blob') {
    B('body', 'Body', null, X(0.5), Y(1), 'body');
    B('top', 'Top', 'body', X(0.5), Y(0.45), 'hair', springy(24, 3, 1.6));
    P('top', 'Top', 'top', 1, (x, y) => y < Y(0.3));
  } else if (kind === 'serpent') {
    const n = Math.max(3, Math.min(6, Math.round(bw / 5)));
    for (let i = 0; i < n; i++) {
      const k = 1 - (i + 0.5) / n;
      B(`s${i}`, i ? `Segment ${i + 1}` : 'Head', i ? `s${i - 1}` : null, X(k + 0.5 / n), Y(0.55), i ? 'tail' : 'head', i ? springy(26 + i * 2, 4, 1.2) : null);
      P(`s${i}`, i ? `Segment ${i + 1}` : 'Head', `s${i}`, n - i, (x) => x >= X(k - 0.5 / n) && x < X(k + 0.5 / n) + (i ? 0 : 99));
    }
  } else {
    B('root', 'Root', null, X(0.5), Y(1), 'body');
    B('trunk', 'Trunk', 'root', X(0.5), Y(0.8), 'body', springy(36, 5, 1));
    B('top', 'Top', 'trunk', X(0.5), Y(0.45), 'hair', springy(22, 3, 1.4));
    P('trunk', 'Trunk', 'trunk', 0, (x, y) => y >= Y(0.45) && y < Y(0.85));
    P('top', 'Top', 'top', 1, (x, y) => y < Y(0.45));
  }
  // The pixels shared out (the first test that takes each).
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!rgba[(y * w + x) * 4 + 3]) continue;
    const i = parts.findIndex((p) => p.test(x + 0.5, y + 0.5));
    if (i >= 0) mask[y * w + x] = i + 1;
  }
  const rig = { ...prev, kind, mask: encodeCel(mask), parts: parts.map(({ id, name, bone, z }) => ({ id, name, bone, z })), bones, baseZ: 0 };
  rig.anims = autoAnims(rig);
  return rig;
}

// Animations made from the bones' roles: a walk, an idle, an attack, a
// flinch.
export function autoAnims(rig, only = null) {
  const out = { ...(rig.anims || {}) };
  const bones = rig.bones || [];
  const front = (b) => /f$|front/i.test(b.id + b.name);
  const want = (k) => !only || only === k;
  const kind = rig.kind || 'walker';
  if (want('walk')) {
    const moves = {};
    for (const b of bones) {
      const ph = front(b) ? 0 : 0.5;
      if (b.role === 'leg') moves[b.id] = { rot: [kind === 'beast' ? 22 : 28, 1, ph] };
      else if (b.role === 'arm') moves[b.id] = { rot: [22, 1, ph + 0.5] };
      else if (b.role === 'body' && !b.parent) moves[b.id] = kind === 'blob' ? { sq: [0.14, 2, 0], y: [1, 2, 0.25] } : kind === 'serpent' ? { x: [1, 1, 0] } : { y: [1, 2, 0.25] };
      else if (b.role === 'head') moves[b.id] = kind === 'serpent' ? { rot: [10, 1, 0] } : { rot: [3, 2, 0.1] };
      else if (b.role === 'wing') moves[b.id] = { rot: [35, 3, front(b) ? 0 : 0.08] };
      else if (b.role === 'tail' && kind === 'serpent') moves[b.id] = { rot: [12, 1, 0.15] };
    }
    out.walk = { dur: kind === 'blob' ? 0.8 : 0.6, loop: true, moves, keys: {} };
  }
  if (want('idle')) {
    const moves = {};
    for (const b of bones) {
      if (b.role === 'body' && !b.parent) moves[b.id] = kind === 'blob' ? { sq: [0.06, 1, 0] } : { y: [0.5, 1, 0] };
      else if (b.role === 'head') moves[b.id] = { rot: [3, 1, 0.3] };
      else if (b.role === 'arm') moves[b.id] = { rot: [3, 1, front(b) ? 0.1 : 0.6] };
      else if (b.role === 'wing') moves[b.id] = { rot: [20, 2, 0] };
      else if (b.role === 'tail' || b.role === 'hair') moves[b.id] = { rot: [4, 1, 0.2] };
    }
    out.idle = { dur: 1.6, loop: true, moves, keys: {} };
  }
  if (want('attack')) {
    const keys = {};
    const arm = bones.find((b) => b.role === 'arm' && front(b)) || bones.find((b) => b.role === 'arm');
    const head = bones.find((b) => b.role === 'head');
    const body = bones.find((b) => !b.parent);
    if (arm) keys[arm.id] = { rot: [{ t: 0, v: 0 }, { t: 0.18, v: -70, e: 'out' }, { t: 0.3, v: 65, e: 'in' }, { t: 0.5, v: 0 }] };
    if (head && !arm) keys[head.id] = { rot: [{ t: 0, v: 0 }, { t: 0.15, v: -14, e: 'out' }, { t: 0.28, v: 12, e: 'in' }, { t: 0.5, v: 0 }], x: [{ t: 0, v: 0 }, { t: 0.15, v: -1 }, { t: 0.28, v: 3, e: 'in' }, { t: 0.5, v: 0 }] };
    if (body) keys[body.id] = { rot: [{ t: 0, v: 0 }, { t: 0.18, v: -6, e: 'out' }, { t: 0.3, v: 8, e: 'in' }, { t: 0.5, v: 0 }], x: [{ t: 0, v: 0 }, { t: 0.3, v: 2, e: 'in' }, { t: 0.5, v: 0 }] };
    out.attack = { dur: 0.5, loop: false, moves: {}, keys };
  }
  if (want('hurt')) {
    const body = bones.find((b) => !b.parent);
    const head = bones.find((b) => b.role === 'head');
    const keys = {};
    if (body) keys[body.id] = { rot: [{ t: 0, v: 0 }, { t: 0.08, v: -12, e: 'out' }, { t: 0.3, v: 0 }], x: [{ t: 0, v: 0 }, { t: 0.08, v: -2, e: 'out' }, { t: 0.3, v: 0 }] };
    if (head) keys[head.id] = { rot: [{ t: 0, v: 0 }, { t: 0.1, v: -10, e: 'out' }, { t: 0.32, v: 0 }] };
    out.hurt = { dur: 0.32, loop: false, moves: {}, keys };
  }
  return out;
}

// ------------------------------------------------------------ in the game
// A creature's look from its rig: its walk, baked (facing left, as the
// game draws them), square, `big` for a boss.
MODS.rigLook = (m, rig, big) => {
  const a = rig && m.assets[rig.asset];
  if (!a || !(rig.bones || []).length) return null;
  const src = { rgba: composite(a, Math.min(a.frames.length - 1, rig.frame || 0)), w: a.w, h: a.h };
  const pose = new RigPose(rig, src);
  const anims = rig.anims || {};
  const sz = big || a.w > 20 || a.h > 20 ? 32 : 16;
  // Its walk (or, with none, its idle) first, as every creature's frames
  // are; then its idle, its attack and its flinch, each a group of its
  // own (see sprites.lookFrame).
  const frames = [];
  const groups = {};
  const add = (name, k, n) => {
    if (!anims[k] && name !== 'walk') return;
    const b = pose.bake(anims[k] ? k : null, n);
    // (Round 67: and how long it lasts, played at its own pace.)
    groups[name] = [frames.length, n, anims[k] ? Math.max(0.1, Math.min(20, anims[k].dur || 1)) : 0];
    for (const rgba of b.frames) frames.push(fitFlip(rgba, b, a.w, a.h, sz));
  };
  add('walk', anims.walk ? 'walk' : 'idle', 6);
  add('idle', 'idle', 6);
  add('attack', 'attack', 6);
  add('hurt', 'hurt', 4);
  return { frames: frames.length, size: sz, modAsset: true, groups, draw: (fr) => frames[fr % frames.length] };
};

// (Round 67) How long a group of a rigged look's frames takes, once
// through: the animation's own length, or (none given) the game's pace.
export function groupSecs(name, g) {
  if (g && g[2] > 0) return g[2];
  return name === 'idle' ? 1 / 0.6 : name === 'walk' ? 1 / 1.6 : name === 'hurt' ? 0.32 : 0.6;
}

// Into sz x sz at the art's own scale (what swings past its edges cut
// off), standing on its bottom, mirrored to face left.
function fitFlip(rgba, B, aw, ah, sz) {
  const k = Math.min(1, sz / Math.max(aw, ah));
  const ox = Math.floor((sz - aw * k) / 2);
  const oy = sz - ah * k;
  const p = new Px(sz, sz);
  for (let Y = 0; Y < sz; Y++) for (let X = 0; X < sz; X++) {
    const bx = Math.floor(B.pad + (X - ox) / k);
    const by = Math.floor(B.pad + (Y - oy) / k);
    if (bx < 0 || by < 0 || bx >= B.w || by >= B.h) continue;
    const i = (by * B.w + bx) * 4;
    if (!rgba[i + 3]) continue;
    const j = (Y * sz + (sz - 1 - X)) * 4;
    p.d[j] = rgba[i];
    p.d[j + 1] = rgba[i + 1];
    p.d[j + 2] = rgba[i + 2];
    p.d[j + 3] = rgba[i + 3];
  }
  return p;
}
