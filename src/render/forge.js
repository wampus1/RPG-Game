// (Round 71) The masters of the old places, forged anew: each painted on a
// texture of its own, sixty-four pixels square (a hundred and twenty-eight
// for the Kavorent's and the evolved masters of the ancient places), one
// pixel of it to one of the world's, as a pixel artist paints: big lit
// forms in clean bands of colour, shadows cool and lights warm, each stuff
// as it is (fur in locks, feathers each one, plates with their shine and
// rivets, bone, cloth in folds), its edge drawn in, and what burns in it
// (eyes, runes, embers) glowing.
//   And cut free of it, whatever moves of itself (see `parts`): the arm
// that swings the weapon, the head, a jaw, wings, a tail, tentacles, a
// cape, each painted apart and turned about its own hinge, every frame,
// pixel for pixel. How each moves is its `role`, driven by what the master
// is doing (see drive below, and bossanim.js): a weapon arm drawn back as
// a blow winds up and brought down as it lands; a jaw dropped for a breath
// or a roar; wings beating harder as it works or roars; a tail lashing as
// it slams; a head thrown back roaring; all of it sagging as it dies.
import { Sculpt } from './sculpt.js';
import { Paint, hash2 } from './paint.js';
import { Part } from './bossrig.js';

export const FORGE = {};
export function forge(defs) {
  for (const [k, d] of Object.entries(defs)) {
    d.size ||= 64;
    d.ax ??= d.size / 2;
    d.ay ??= d.size - 2;
    d.parts ||= {};
    FORGE[k] = d;
  }
}
export const isForged = (species) => !!FORGE[species];

export const FRAMES = 24;
const TAU = Math.PI * 2;
const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
const ease = (k) => k * k * (3 - 2 * k);
const seedOf = (s) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0) % 9973;
};
// The rise of its chest at `t` (0..1 of a breath), in pixels.
export const breathOf = (t, d = 1) => (Math.sin(t * TAU) * 0.5 + 0.5) * d;

function toCanvas(px) {
  if (typeof document === 'undefined') return px;
  const c = document.createElement('canvas');
  c.width = px.w;
  c.height = px.h;
  c.getContext('2d').putImageData(px.toImageData(), 0, 0);
  return c;
}

// One frame of its body, painted: its forms sculpted (see sculpt.js, `pix`),
// then what's painted over them (the eyes, the runes, the grain of fur and
// feather), its edge drawn in, and what glows laid over that.
export function forgePaint(species, f, st = {}) {
  const D = FORGE[species];
  const t = f / FRAMES;
  const J = { t, st, b: breathOf(t, D.breath ?? 1), sway: Math.sin(t * TAU), f };
  if (D.joints) D.joints(J, t, st);
  const X = new Sculpt(D.size, D.size, { seed: D.seed || seedOf(species), t, pix: true });
  D.body(X, J, t, st);
  const P = new Paint(D.size, D.size);
  P.p = X.render({ outline: false });
  P.X = X;
  if (D.paint) D.paint(P, J, t, st);
  P.done(true);
  if (D.glow) D.glow(P, J, t, st);
  return P.p;
}

const frames = new Map();
// (Round 73) The latest painted frame of each species at each step of its
// breath, whatever state it was painted in: shown while the one wanted is
// still to paint, so a change of state (a blow wound up, its death) never
// costs more than one painting a frame. (It was three a frame: a master
// winding up or going down could stall the screen for a moment.)
const anyState = new Map();
let budgetT = -1;
let painted = 0;
const keyOf = (st) => Object.keys(st).filter((k) => k !== 'rage').sort().map((k) => k + st[k]).join(',');
// A frame (painted as first wanted, one a frame at most once there's
// something to show, the nearest painted one shown till then).
export function forgeFrame(species, f, st = {}, now = null) {
  const sk = keyOf(st);
  const k = `${species}|${sk}|${f}`;
  let v = frames.get(k);
  if (v) return v;
  if (now !== null) {
    if (now !== budgetT) {
      budgetT = now;
      painted = 0;
    }
    if (painted >= 1) {
      // Its nearest step in this state, else this step in any state.
      for (let d = 1; d < FRAMES; d++) {
        for (const g of [f - d, f + d]) {
          const w = frames.get(`${species}|${sk}|${(g + FRAMES) % FRAMES}`);
          if (w) return w;
        }
      }
      const A = anyState.get(species);
      const w = A && (A[f] || A.find(Boolean));
      if (w) return w;
    }
    painted++;
  }
  v = toCanvas(forgePaint(species, f, st));
  frames.set(k, v);
  let A = anyState.get(species);
  if (!A) anyState.set(species, (A = new Array(FRAMES).fill(null)));
  A[f] = v;
  return v;
}

// A part of it cut free (painted once, turned as it's wanted).
const PARTS = new Map();
export function forgePart(species, name, variant = '') {
  const key = `${species}|${name}|${variant}`;
  let p = PARTS.get(key);
  if (p) return p;
  const D = FORGE[species];
  const q = D.parts[name];
  p = new Part(() => {
    const X = new Sculpt(q.w, q.h, { seed: (D.seed || seedOf(species)) + seedOf(name), pix: true });
    q.body(X, variant);
    const P = new Paint(q.w, q.h);
    P.p = X.render({ outline: false });
    P.X = X;
    if (q.paint) q.paint(P, variant);
    if (q.glow) q.glow(P, variant);
    return P.p;
  }, q.px, q.py, { outline: true });
  PARTS.set(key, p);
  return p;
}
// (For the tests: a part's picture.)
export const forgePartPx = (species, name, variant = '') => forgePart(species, name, variant).paint();

// ------------------------------------------------------------ driving
// How a part of `role` is moved now (a turn, in radians, toward its front
// as it faces, and a nudge), given the master's state and its moves (A:
// see bossanim.animOf), `t` the clock, `q` the part (its own `amp`,
// `rate`, `phase`).
export function drive(role, e, A, t, q = {}) {
  const k = A && A.k ? clamp01(A.t / A.dur) : 0;
  const kind = A && A.k;
  const w = e.windup && !e.windup.dash ? clamp01(e.windup.t / Math.max(0.05, e.windup.dur)) : 0;
  const ph = (q.phase || 0) + (e.id || 0) * 0.7;
  const amp = q.amp ?? 1;
  const out = { a: 0, dx: 0, dy: 0, sy: 1 };
  const dying = e.dying !== undefined ? clamp01(e.dying / 0.6) : 0;
  const span = (a, b, c, d) => (k < a ? 0 : k < b ? ease((k - a) / (b - a)) : k < c ? 1 : k < d ? 1 - ease((k - c) / (d - c)) : 0);
  switch (role) {
    case 'weapon': {
      // At rest: a slow sway. Winding up: drawn back over the shoulder.
      out.a = Math.sin(t * 1.3 + ph) * 0.05;
      out.a -= 1.25 * ease(w) * amp;
      if (kind === 'strike') out.a += (k < 0.28 ? -1.2 + 2.3 * ease(k / 0.28) : 1.1 * (1 - ease((k - 0.28) / 0.72))) * amp;
      if (kind === 'smash') out.a += (k < 0.32 ? -2 * ease(k / 0.32) : k < 0.45 ? -2 + 3.3 * ease((k - 0.32) / 0.13) : 1.3 * (1 - ease((k - 0.45) / 0.55))) * amp;
      if (kind === 'throw') out.a += (k < 0.4 ? -1.5 * ease(k / 0.4) : -1.5 + 2.5 * span(0.4, 0.55, 0.6, 2)) * amp;
      if (kind === 'cast' || kind === 'summon') out.a -= 1.7 * span(0.15, 0.4, 0.75, 1) * amp;
      if (kind === 'beam' || kind === 'breath') out.a += 0.5 * span(0.3, 0.5, 0.8, 1) * amp;
      if (kind === 'slam') out.a += (k < 0.4 ? -1.4 * ease(k / 0.4) : k < 0.5 ? -1.4 + 2.2 * ease((k - 0.4) / 0.1) : 0.8 * (1 - ease((k - 0.5) / 0.5))) * amp;
      if (kind === 'roar') out.a -= 0.9 * span(0.15, 0.3, 0.7, 0.85) * amp + Math.sin(t * 40) * 0.05 * span(0.2, 0.3, 0.7, 0.8);
      if (kind === 'flinch') out.a += 0.25 * (1 - k);
      if (kind === 'flex') out.a -= 0.35 * Math.sin(Math.PI * k);
      out.a += 0.9 * dying;
      break;
    }
    case 'blade': {
      // A weapon in the hand, turned at the wrist on top of the arm's
      // swing: cocked back as it winds up, snapped through as it lands.
      out.a = Math.sin(t * 1.1 + ph) * 0.03;
      out.a -= 0.6 * ease(w) * amp;
      if (kind === 'strike') out.a += (k < 0.3 ? -0.6 + 1.8 * ease(k / 0.3) : 1.2 * (1 - ease((k - 0.3) / 0.7))) * amp;
      if (kind === 'smash') out.a += (k < 0.32 ? -0.9 * ease(k / 0.32) : k < 0.46 ? -0.9 + 2.3 * ease((k - 0.32) / 0.14) : 1.4 * (1 - ease((k - 0.46) / 0.54))) * amp;
      if (kind === 'slam') out.a += (k < 0.4 ? -0.8 * ease(k / 0.4) : k < 0.5 ? -0.8 + 1.8 * ease((k - 0.4) / 0.1) : 1 * (1 - ease((k - 0.5) / 0.5))) * amp;
      if (kind === 'throw') out.a += (k < 0.4 ? -0.8 * ease(k / 0.4) : -0.8 + 1.6 * span(0.4, 0.55, 0.6, 2)) * amp;
      if (kind === 'cast' || kind === 'summon') out.a -= 0.4 * span(0.15, 0.4, 0.75, 1);
      out.a += 0.5 * dying;
      break;
    }
    case 'offhand': {
      out.a = Math.sin(t * 1.3 + ph + 1) * 0.06;
      out.a += 0.5 * ease(w) * amp;
      if (kind === 'cast' || kind === 'summon') out.a -= 1.5 * span(0.1, 0.35, 0.75, 1) * amp;
      if (kind === 'beam' || kind === 'throw') out.a -= 1.2 * span(0.1, 0.4, 0.7, 1) * amp;
      if (kind === 'strike' || kind === 'smash') out.a += 0.4 * span(0, 0.2, 0.4, 1) * amp;
      if (kind === 'roar') out.a -= 0.8 * span(0.15, 0.3, 0.7, 0.85) * amp;
      out.a += 0.7 * dying;
      break;
    }
    case 'head': {
      out.a = Math.sin(t * 0.9 + ph) * 0.04;
      out.dy = Math.sin(t * 2.1 + ph) * 0.5;
      if (kind === 'roar') {
        out.a -= 0.35 * span(0.15, 0.3, 0.7, 0.85) * amp;
        out.dx += Math.sin(t * 50) * span(0.2, 0.3, 0.7, 0.8);
      }
      if (kind === 'breath') out.a += (k < 0.3 ? -0.3 * ease(k / 0.3) : -0.3 + 0.55 * span(0.3, 0.45, 0.8, 2)) * amp;
      if (kind === 'strike' || kind === 'smash') out.a += 0.2 * span(0, 0.25, 0.35, 1) * amp;
      if (kind === 'beam' || kind === 'cast') out.a -= 0.12 * span(0.1, 0.4, 0.7, 1);
      out.a += 0.08 * ease(w);
      out.a += 0.55 * dying;
      break;
    }
    case 'jaw': {
      const idle = 0.04 + Math.max(0, Math.sin(t * 1.7 + ph)) * 0.06;
      let open = idle;
      if (kind === 'roar') open = Math.max(open, 0.75 * span(0.15, 0.25, 0.75, 0.85));
      if (kind === 'breath') open = Math.max(open, 0.65 * span(0.25, 0.35, 0.82, 1));
      if (kind === 'strike' || kind === 'smash') open = Math.max(open, 0.45 * span(0, 0.2, 0.3, 0.7));
      if (kind === 'beam' || kind === 'cast' || kind === 'summon') open = Math.max(open, 0.35 * span(0.2, 0.4, 0.7, 1));
      open = Math.max(open, 0.3 * w);
      if (e.inhale) open = Math.max(open, 0.6);
      out.a = -open * amp;
      out.a -= 0.4 * dying;
      break;
    }
    case 'wing': {
      // Beating: slow and shallow at rest, deep as it works, a great sweep
      // as it roars or comes down on you.
      let rate = (q.rate ?? 1.6) * (e.moving ? 1.6 : 1);
      let depth = (q.depth ?? 0.25) * (e.moving ? 1.4 : 1);
      if (kind === 'roar' || kind === 'cast' || kind === 'summon') {
        rate *= 2.2;
        depth *= 2.2;
      }
      if (kind === 'slam' || kind === 'charge' || (e.windup && e.windup.dash)) {
        rate *= 1.8;
        depth *= 1.8;
      }
      depth += 0.4 * w;
      const s = Math.sin(t * rate * TAU * 0.5 + ph);
      out.a = s * depth * amp - (q.lift ?? 0) * w;
      out.sy = 1 - Math.max(0, s) * (q.squash ?? 0.25) * depth;
      out.a += 0.6 * dying;
      break;
    }
    case 'tail': {
      out.a = Math.sin(t * (q.rate ?? 1.4) + ph) * (q.depth ?? 0.12) * amp;
      if (kind === 'slam' || kind === 'smash') out.a += 0.55 * Math.sin(k * Math.PI) * amp;
      if (kind === 'strike' || kind === 'charge') out.a += 0.3 * Math.sin(k * Math.PI * 2) * amp;
      if (kind === 'roar') out.a += Math.sin(t * 14) * 0.18 * span(0.2, 0.3, 0.7, 0.85);
      out.a += 0.3 * ease(w) * Math.sin(t * 9);
      out.a += 0.4 * dying;
      break;
    }
    case 'sway': {
      // Something that hangs and swings (a tentacle, a lantern, a banner).
      out.a = Math.sin(t * (q.rate ?? 1.1) + ph) * (q.depth ?? 0.12) * amp;
      if (kind) out.a += Math.sin(k * Math.PI * 2 + ph) * 0.25 * amp;
      out.a += 0.15 * ease(w) * Math.sin(t * 7 + ph);
      if (e.moving) out.a += Math.sin(t * 6 + ph) * 0.08;
      out.a += 0.5 * dying;
      break;
    }
    case 'cape': {
      out.a = Math.sin(t * 0.8 + ph) * 0.05 + (e.moving ? 0.18 : 0);
      if (kind === 'roar' || kind === 'cast' || kind === 'summon') out.a += 0.25 * span(0.1, 0.3, 0.7, 1) + Math.sin(t * 12) * 0.05;
      if (kind === 'strike' || kind === 'smash' || kind === 'charge') out.a += 0.2 * Math.sin(k * Math.PI);
      out.a += 0.3 * dying;
      break;
    }
    default:
      out.a = Math.sin(t * 1.2 + ph) * 0.05;
  }
  return out;
}

// Where each part is and how it's turned this frame (worked out once a
// frame for all of them: a part hung on another, `parent`, goes where that
// one's turned it). `at` is where its hinge is: on the body's picture, or
// on its parent's.
function placeParts(R, D) {
  const { e, ox, oy } = R;
  const out = {};
  const place = (name) => {
    if (out[name]) return out[name];
    const q = D.parts[name];
    const at = typeof q.at === 'function' ? q.at(R.J, R) : q.at;
    const d = drive(q.role, e, R.A, R.t, q);
    let ang = (q.a0 || 0) + (q.sign ?? -1) * d.a + (q.extra ? q.extra(R) : 0);
    let x;
    let y;
    if (q.parent) {
      const p = place(q.parent);
      const pq = D.parts[q.parent];
      const lx = at[0] - pq.px;
      const ly = at[1] - pq.py;
      const c = Math.cos(p.ang);
      const s = Math.sin(p.ang);
      x = p.x + lx * c - ly * s + d.dx;
      y = p.y + lx * s + ly * c + d.dy;
      ang += p.ang;
    } else {
      x = ox + at[0] + d.dx;
      y = oy + at[1] + d.dy;
    }
    out[name] = { x, y, ang, sy: d.sy, q };
    return out[name];
  };
  for (const name of Object.keys(D.parts)) place(name);
  return out;
}
// Each part drawn where it hangs, turned as its role has it. `layer` 'back'
// (behind the body) or 'front'; within a layer by `z`.
export function drawParts(R, D, layer) {
  const { ctx, e } = R;
  if (!R.placed) R.placed = placeParts(R, D);
  const list = Object.entries(R.placed).filter(([, p]) => (p.q.layer || 'front') === layer).sort((a, b) => (a[1].q.z || 0) - (b[1].q.z || 0));
  for (const [name, p] of list) {
    const q = p.q;
    if (q.show && !q.show(R)) continue;
    const variant = q.variant ? q.variant(R) : '';
    const P = forgePart(e.species, name, variant);
    if (q.squash && p.sy !== 1) P.flapY(ctx, p.x, p.y, p.ang, p.sy);
    else P.draw(ctx, p.x, p.y, p.ang);
  }
}

// ------------------------------------------------------------ the kit
// Colours a bit darker or lighter (as hex).
export function tone(c, k) {
  const n = parseInt(c.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}
export { hash2 };

// ------------------------------------------------------------ fx in pose
// Draw `fn` on the world's canvas as if on the master's picture: in its
// pose (leaning, squashed, as bossanim has it), turned the way it faces,
// so a point (R.ox + x, R.oy + y) is where that pixel of its picture is
// drawn. (For what it gives off, kept fast to it, but not rimmed.)
export function inPose(R, ctx, pose, fn) {
  ctx.save();
  ctx.translate(Math.round(R.x + (pose ? pose.dx || 0 : 0)), Math.round(R.y + (pose ? pose.dy || 0 : 0)));
  if (pose) {
    if (pose.rot) ctx.rotate(pose.rot);
    if (pose.shear) ctx.transform(1, 0, pose.shear, 1, 0, 0);
    if (pose.sx !== undefined || pose.sy !== undefined) ctx.scale(pose.sx ?? 1, pose.sy ?? 1);
  }
  if (R.flip) ctx.scale(-1, 1);
  ctx.translate(-R.x, -R.y);
  fn();
  ctx.restore();
}
// Where a point on a part's own picture (lx, ly) is now, on the master's
// (as drawn in `front`/`behind`, or `inPose`).
export function partAt(R, name, lx, ly) {
  const D = R.D;
  if (!R.placed) R.placed = placeParts(R, D);
  const p = R.placed[name];
  const q = D.parts[name];
  if (!p) return { x: R.ox + lx, y: R.oy + ly, ang: 0 };
  const dx = lx - q.px;
  const dy = (ly - q.py) * (p.sy ?? 1);
  const c = Math.cos(p.ang);
  const s = Math.sin(p.ang);
  return { x: p.x + dx * c - dy * s, y: p.y + dx * s + dy * c, ang: p.ang };
}
