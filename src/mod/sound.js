// Sounds in mods (round 66): clips brought in from outside (a .wav, .mp3
// or .ogg) or made in the Workshop's Sound tab, kept small, and the work
// done on them there: cut, joined, made louder or quieter, slower, faster,
// higher, echoing, rung through a room, muffled, crushed. Nothing here
// needs a browser: a clip's samples are plain numbers (a Float32Array,
// -1..1, one channel), so the tests can work them too.
//
// A sound, as a mod keeps it:
//   { name, rate (samples a second), n (how many), data (the samples,
//     four bits each: IMA ADPCM, packed in blocks, then base64), vol (how
//     loud the game plays it, 0-2), root (the note it is, played as an
//     instrument in a song: 60 is middle C), loop (round again when it's
//     the music) }
import { toBase64, fromBase64 } from './format.js';

// The rates a clip can be kept at (lower: smaller, duller), and how long
// one can be.
export const SOUND_RATES = [11025, 16000, 22050, 32000];
export const RATE_NAMES = { 11025: 'Tiny (11 kHz)', 16000: 'Small (16 kHz)', 22050: 'Good (22 kHz)', 32000: 'Clear (32 kHz)' };
export const SOUND_MAX_SECS = 180;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const s16 = (v) => (v > 32767 ? 32767 : v < -32768 ? -32768 : v | 0);

// ------------------------------------------------------------ keeping it
// IMA ADPCM: each sample a 4-bit step from the last, the steps growing and
// shrinking with the sound. Blocks of 2048 samples, each opening with where
// it starts (its first sample and step), so one damaged block is all
// that's lost.
const STEPS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
const IDX = [-1, -1, -1, -1, 2, 4, 6, 8];
const BLOCK = 2048;
const BLOCK_BYTES = 4 + BLOCK / 2;

export function encodeAdpcm(x) {
  const n = x.length;
  const blocks = Math.ceil(n / BLOCK);
  const out = new Uint8Array(blocks * BLOCK_BYTES);
  let o = 0;
  let idx = 0;
  for (let b = 0; b < blocks; b++) {
    const s0 = b * BLOCK;
    let pred = s16(Math.round(x[s0] * 32767));
    out[o++] = pred & 255;
    out[o++] = (pred >> 8) & 255;
    out[o++] = idx;
    out[o++] = 0;
    for (let i = 0; i < BLOCK; i += 2) {
      let byte = 0;
      for (let k = 0; k < 2; k++) {
        const j = s0 + i + k;
        const s = j < n ? s16(Math.round(x[j] * 32767)) : pred;
        const step = STEPS[idx];
        let diff = s - pred;
        let code = 0;
        if (diff < 0) {
          code = 8;
          diff = -diff;
        }
        let delta = step >> 3;
        if (diff >= step) {
          code |= 4;
          diff -= step;
          delta += step;
        }
        if (diff >= step >> 1) {
          code |= 2;
          diff -= step >> 1;
          delta += step >> 1;
        }
        if (diff >= step >> 2) {
          code |= 1;
          delta += step >> 2;
        }
        pred = s16(code & 8 ? pred - delta : pred + delta);
        idx = clamp(idx + IDX[code & 7], 0, 88);
        byte |= code << (k * 4);
      }
      out[o++] = byte;
    }
  }
  return out;
}

export function decodeAdpcm(bytes, n) {
  const x = new Float32Array(Math.max(0, n | 0));
  let j = 0;
  for (let o = 0; o + 4 <= bytes.length && j < x.length; o += BLOCK_BYTES) {
    let pred = ((bytes[o] | (bytes[o + 1] << 8)) << 16) >> 16;
    let idx = Math.min(88, bytes[o + 2]);
    for (let i = 0; i < BLOCK / 2 && j < x.length; i++) {
      const byte = bytes[o + 4 + i] ?? 0;
      for (let k = 0; k < 2 && j < x.length; k++) {
        const code = (byte >> (k * 4)) & 15;
        const step = STEPS[idx];
        let delta = step >> 3;
        if (code & 4) delta += step;
        if (code & 2) delta += step >> 1;
        if (code & 1) delta += step >> 2;
        pred = s16(code & 8 ? pred - delta : pred + delta);
        idx = clamp(idx + IDX[code & 7], 0, 88);
        x[j++] = pred / 32768;
      }
    }
  }
  return x;
}

// Samples, as a mod keeps them: { rate, n, data }.
export function packClip(x, rate) {
  return { rate: Math.round(rate), n: x.length, data: toBase64(encodeAdpcm(x)) };
}

// A sound's samples (the last few unpacked kept, as the same text comes
// back again and again).
const unpacked = [];
export function clipSamples(s) {
  if (!s || typeof s.data !== 'string' || !(s.n > 0)) return new Float32Array(0);
  const hit = unpacked.find((q) => q.data === s.data && q.n === s.n);
  if (hit) return hit.x;
  const x = decodeAdpcm(fromBase64(s.data), Math.min(s.n, Math.round((s.rate || 22050) * SOUND_MAX_SECS * 1.05)));
  unpacked.unshift({ data: s.data, n: s.n, x });
  if (unpacked.length > 6) unpacked.pop();
  return x;
}

// A new sound for a mod (silent unless given samples).
export function newSound(o = {}) {
  const rate = SOUND_RATES.includes(o.rate) ? o.rate : 22050;
  const x = o.samples || new Float32Array(0);
  return { name: o.name || 'Sound', ...packClip(x, rate), vol: 1, root: 60, loop: false };
}

// A sound as the sound card plays it (made once for each version of it).
const buffers = new WeakMap();
export function clipBuffer(ctx, s) {
  if (!ctx || !s || !(s.n > 0)) return null;
  let m = buffers.get(ctx);
  if (!m) buffers.set(ctx, (m = new Map()));
  const hit = m.get(s.data);
  if (hit) return hit;
  const x = clipSamples(s);
  if (!x.length) return null;
  let buf;
  try {
    buf = ctx.createBuffer(1, x.length, s.rate);
  } catch {
    return null;
  }
  buf.getChannelData(0).set(x);
  m.set(s.data, buf);
  // (Only the last few kept.)
  if (m.size > 48) m.delete(m.keys().next().value);
  return buf;
}

export const clipSecs = (s) => (s && s.rate ? (s.n || 0) / s.rate : 0);
// How big a sound is in a mod (bytes, about).
export const clipBytes = (s) => (s && typeof s.data === 'string' ? s.data.length : 0);

// A sound read from somewhere: what's wrong with it put right (or null).
export function cleanSound(s) {
  if (!s || typeof s !== 'object') return null;
  if (!SOUND_RATES.includes(s.rate)) s.rate = 22050;
  if (typeof s.data !== 'string') s.data = '';
  s.n = Math.max(0, Math.min(Math.round(+s.n || 0), Math.floor((s.data.length * 3) / 4) * 2, s.rate * SOUND_MAX_SECS));
  s.vol = typeof s.vol === 'number' && Number.isFinite(s.vol) ? clamp(s.vol, 0, 2) : 1;
  s.root = clamp(Math.round(+s.root || 60), 24, 96);
  s.loop = !!s.loop;
  return s;
}

// ------------------------------------------------------------ files
// A .wav of samples (16-bit; one channel, or two if `right` is given).
export function encodeWav(x, rate, right = null) {
  const ch = right ? 2 : 1;
  const n = x.length;
  const buf = new ArrayBuffer(44 + n * 2 * ch);
  const v = new DataView(buf);
  const str = (o, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2 * ch, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2 * ch, true);
  v.setUint16(32, 2 * ch, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2 * ch, true);
  const q = (s) => s16(Math.round(clamp(s, -1, 1) * 32767));
  for (let i = 0; i < n; i++) {
    if (right) {
      v.setInt16(44 + i * 4, q(x[i]), true);
      v.setInt16(46 + i * 4, q(right[i] ?? 0), true);
    } else v.setInt16(44 + i * 2, q(x[i]), true);
  }
  return new Uint8Array(buf);
}

// A .wav's samples (its channels mixed to one): { rate, x }, or null if it
// isn't one this can read (8, 16, 24 or 32-bit, or 32-bit floats).
export function decodeWav(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 12) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let o = 12;
  let fmt = null;
  while (o + 8 <= b.length) {
    const id = tag(o);
    const len = v.getUint32(o + 4, true);
    const at = o + 8;
    if (id === 'fmt ') {
      fmt = { kind: v.getUint16(at, true), ch: v.getUint16(at + 2, true), rate: v.getUint32(at + 4, true), bits: v.getUint16(at + 14, true) };
      // (The extended kind says what it is further in.)
      if (fmt.kind === 0xfffe && len >= 26) fmt.kind = v.getUint16(at + 24, true);
    } else if (id === 'data' && fmt) {
      const { ch, bits } = fmt;
      const float = fmt.kind === 3;
      const bps = bits / 8;
      if (![1, 2, 3, 4].includes(bps) || ch < 1) return null;
      const frames = Math.floor(Math.min(len, b.length - at) / (bps * ch));
      const x = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < ch; c++) {
          const p = at + (i * ch + c) * bps;
          let s;
          if (bps === 1) s = (b[p] - 128) / 128;
          else if (bps === 2) s = v.getInt16(p, true) / 32768;
          else if (bps === 3) s = (((b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) << 8) >> 8) / 8388608;
          else s = float ? v.getFloat32(p, true) : v.getInt32(p, true) / 2147483648;
          sum += s;
        }
        x[i] = sum / ch;
      }
      return { rate: fmt.rate, x };
    }
    o = at + len + (len & 1);
  }
  return null;
}

// ------------------------------------------------------------ what's done to it
// (Each takes samples and gives back new ones: what it's given is left as
// it was, so Undo has it.)

// A piece of it [a, b).
export const slice = (x, a, b) => x.slice(clamp(a | 0, 0, x.length), clamp(b | 0, 0, x.length));
// Without [a, b).
export function cut(x, a, b) {
  a = clamp(a | 0, 0, x.length);
  b = clamp(b | 0, a, x.length);
  const out = new Float32Array(x.length - (b - a));
  out.set(x.subarray(0, a), 0);
  out.set(x.subarray(b), a);
  return out;
}
// `y` put in at `at`.
export function insert(x, at, y) {
  at = clamp(at | 0, 0, x.length);
  const out = new Float32Array(x.length + y.length);
  out.set(x.subarray(0, at), 0);
  out.set(y, at);
  out.set(x.subarray(at), at + y.length);
  return out;
}
// `y` laid over it from `at` (as loud as `gain`), made longer if it runs on.
export function mixIn(x, y, at = 0, g = 1) {
  at = Math.max(0, at | 0);
  const out = new Float32Array(Math.max(x.length, at + y.length));
  out.set(x, 0);
  for (let i = 0; i < y.length; i++) out[at + i] += y[i] * g;
  return out;
}
// [a, b) changed by `fn` (samples in, samples out, as long or not): the
// rest as it was. (`a`..`b` the whole of it when not given.)
export function onRange(x, a, b, fn) {
  a = clamp(a ?? 0, 0, x.length) | 0;
  b = clamp(b ?? x.length, a, x.length) | 0;
  if (a === 0 && b === x.length) return fn(x.slice());
  const mid = fn(x.slice(a, b));
  const out = new Float32Array(a + mid.length + (x.length - b));
  out.set(x.subarray(0, a), 0);
  out.set(mid, a);
  out.set(x.subarray(b), a + mid.length);
  return out;
}

export const silence = (n) => new Float32Array(Math.max(0, n | 0));

export function gain(x, g) {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * g;
  return out;
}

export function peak(x) {
  let p = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > p) p = a;
  }
  return p;
}

// As loud as it can be without cracking (its loudest at `to`).
export function normalize(x, to = 0.95) {
  const p = peak(x);
  return p > 1e-6 ? gain(x, to / p) : x.slice();
}

export function reverse(x) {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[x.length - 1 - i];
  return out;
}

// Faded in over its first `a` samples and out over its last `b`.
export function fade(x, a = 0, b = 0) {
  const out = x.slice();
  const n = out.length;
  a = Math.min(a | 0, n);
  b = Math.min(b | 0, n);
  for (let i = 0; i < a; i++) out[i] *= Math.sin(((i / a) * Math.PI) / 2) ** 2;
  for (let i = 0; i < b; i++) out[n - 1 - i] *= Math.sin(((i / b) * Math.PI) / 2) ** 2;
  return out;
}

// Quiet at either end cut off (anything under `thr`), with a moment kept.
export function trimSilence(x, thr = 0.008, keep = 64) {
  let a = 0;
  let b = x.length;
  while (a < b && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b - 1]) < thr) b--;
  return x.slice(Math.max(0, a - keep), Math.min(x.length, b + keep));
}

// A filter (the old cookbook's): 'lowpass' (muffled), 'highpass' (thin),
// 'bandpass' (a telephone's), at `f` Hz.
export function filter(x, rate, type, f, q = 0.707) {
  const w = (2 * Math.PI * clamp(f, 10, rate * 0.49)) / rate;
  const cs = Math.cos(w);
  const al = Math.sin(w) / (2 * Math.max(0.05, q));
  let b0;
  let b1;
  let b2;
  if (type === 'highpass') {
    b0 = (1 + cs) / 2;
    b1 = -(1 + cs);
    b2 = b0;
  } else if (type === 'bandpass') {
    b0 = al;
    b1 = 0;
    b2 = -al;
  } else {
    b0 = (1 - cs) / 2;
    b1 = 1 - cs;
    b2 = b0;
  }
  const a0 = 1 + al;
  const a1 = -2 * cs;
  const a2 = 1 - al;
  const out = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

// One sample between two (a smooth curve through the four round it).
function at4(x, p) {
  const i = Math.floor(p);
  const t = p - i;
  const n = x.length;
  const y0 = x[clamp(i - 1, 0, n - 1)];
  const y1 = x[clamp(i, 0, n - 1)];
  const y2 = x[clamp(i + 1, 0, n - 1)];
  const y3 = x[clamp(i + 2, 0, n - 1)];
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * t + c2) * t + c1) * t + y1;
}

// Played `k` times as fast (higher and shorter, as a tape would), or slower
// (lower and longer). (Faster, its highs are taken off first, so they
// don't fold back down as whistles.)
export function speed(x, k, rate = 22050) {
  k = clamp(k, 0.1, 10);
  const src = k > 1.02 ? filter(filter(x, rate, 'lowpass', (rate / 2 / k) * 0.9), rate, 'lowpass', (rate / 2 / k) * 0.9) : x;
  const n = Math.max(1, Math.round(x.length / k));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = at4(src, i * k);
  return out;
}

// From one rate to another (the same sound, kept at a new rate).
export const convertRate = (x, from, to) => (from === to ? x.slice() : speed(x, from / to, from));

// Longer or shorter by `k` (2: twice as long) and still at the same pitch:
// short overlapping slices, each laid where it best follows the last.
export function stretch(x, k, rate = 22050) {
  k = clamp(k, 0.25, 4);
  if (Math.abs(k - 1) < 0.005 || x.length < 64) return x.slice();
  const N = Math.max(64, Math.round(rate * 0.046) & ~1);
  const Hs = N / 2;
  const Ha = Hs / k;
  const tol = Math.round(rate * 0.01);
  const outLen = Math.round(x.length * k);
  const out = new Float32Array(outLen + N);
  const norm = new Float32Array(outLen + N);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  let prev = 0;
  for (let s = 0, m = 0; s < outLen; s += Hs, m++) {
    const nominal = Math.round(m * Ha);
    let best = Math.min(nominal, Math.max(0, x.length - N));
    if (m > 0) {
      const nat = prev + Hs;
      let bestC = -Infinity;
      for (let d = -tol; d <= tol; d++) {
        const p = nominal + d;
        if (p < 0 || p + N > x.length || nat + Hs > x.length) continue;
        let c = 0;
        for (let i = 0; i < Hs; i += 4) c += x[p + i] * x[nat + i];
        if (c > bestC) {
          bestC = c;
          best = p;
        }
      }
    }
    for (let i = 0; i < N; i++) {
      const j = best + i;
      out[s + i] += (j < x.length ? x[j] : 0) * win[i];
      norm[s + i] += win[i];
    }
    prev = best;
  }
  const res = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) res[i] = norm[i] > 0.05 ? out[i] / norm[i] : out[i];
  return res;
}

// Higher or lower by `semis` half-steps, as long as it was.
export function pitch(x, semis, rate = 22050) {
  const k = 2 ** (clamp(semis, -24, 24) / 12);
  if (Math.abs(k - 1) < 0.001) return x.slice();
  const y = speed(stretch(x, k, rate), k, rate);
  const out = new Float32Array(x.length);
  out.set(y.subarray(0, Math.min(y.length, x.length)));
  return out;
}

// Echoes, every `time` seconds, each `feedback` of the last; the echoes as
// loud as `mix` against what's echoed. Longer by its tail.
export function echo(x, rate, { time = 0.25, feedback = 0.45, mix = 0.5 } = {}) {
  const d = Math.max(1, Math.round(clamp(time, 0.01, 2) * rate));
  const fb = clamp(feedback, 0, 0.95);
  const tail = fb > 0.001 ? Math.min(rate * 8, Math.ceil((d * Math.log(0.001)) / Math.log(fb))) : d;
  const n = x.length + tail;
  const line = new Float32Array(n);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const dry = i < x.length ? x[i] : 0;
    const back = i >= d ? line[i - d] : 0;
    line[i] = dry + back * fb;
    out[i] = dry + back * mix;
  }
  return normalizeIfLoud(out);
}

// A room's ring (the old reverb's combs and all-passes): `size` 0..1 (a
// cupboard to a cathedral), `damp` 0..1 (bright stone to soft cloth), `mix`
// how much of the room against the sound. Longer by its tail.
export function reverb(x, rate, { size = 0.6, damp = 0.4, mix = 0.35 } = {}) {
  const k = rate / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.max(8, Math.round(d * k * (0.6 + size * 0.6))));
  const alls = [556, 441, 341, 225].map((d) => Math.max(4, Math.round(d * k)));
  const fb = 0.7 + clamp(size, 0, 1) * 0.28;
  const dm = clamp(damp, 0, 1) * 0.5;
  const tail = Math.round(rate * (0.6 + size * 4));
  const n = x.length + tail;
  const out = new Float32Array(n);
  const cb = combs.map((d) => ({ buf: new Float32Array(d), i: 0, lp: 0 }));
  const ab = alls.map((d) => ({ buf: new Float32Array(d), i: 0 }));
  const wet = clamp(mix, 0, 1);
  for (let j = 0; j < n; j++) {
    const dry = j < x.length ? x[j] : 0;
    const inp = dry * 0.015;
    let s = 0;
    for (const c of cb) {
      const y = c.buf[c.i];
      c.lp = y * (1 - dm) + c.lp * dm;
      c.buf[c.i] = inp + c.lp * fb;
      c.i = (c.i + 1) % c.buf.length;
      s += y;
    }
    for (const a of ab) {
      const y = a.buf[a.i];
      a.buf[a.i] = s + y * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      s = y - s;
    }
    out[j] = dry * (1 - wet * 0.5) + s * wet * 3;
  }
  return normalizeIfLoud(out);
}

// Driven into a crunch (`amount` 0..1).
export function distort(x, amount = 0.5) {
  const d = 1 + clamp(amount, 0, 1) * 30;
  const k = Math.tanh(d);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Math.tanh(x[i] * d) / k;
  return out;
}

// Crushed, as the oldest machines played it: fewer steps of loudness
// (`bits`), and each sample held for `hold`.
export function crush(x, bits = 6, hold = 2) {
  const q = 2 ** (clamp(Math.round(bits), 1, 16) - 1);
  const hd = clamp(Math.round(hold), 1, 64);
  const out = new Float32Array(x.length);
  let v = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % hd === 0) v = Math.round(x[i] * q) / q;
    out[i] = v;
  }
  return out;
}

// Its loudness wavering (`hz` a second, `depth` 0..1).
export function tremolo(x, rate, hz = 6, depth = 0.6) {
  const out = new Float32Array(x.length);
  const dp = clamp(depth, 0, 1);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * (1 - dp / 2 + (dp / 2) * Math.sin((2 * Math.PI * hz * i) / rate));
  return out;
}

// Its pitch wavering (a warped record): `hz` a second, `depth` in cents
// (a read-head swinging back and forth over it).
export function vibrato(x, rate, hz = 5, depth = 30) {
  const f = Math.max(0.1, hz);
  const A = ((2 ** (clamp(depth, 0, 200) / 1200) - 1) * rate) / (2 * Math.PI * f);
  const base = A + 2;
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const p = i - (base + A * Math.sin((2 * Math.PI * f * i) / rate));
    out[i] = p < 0 ? 0 : at4(x, p);
  }
  return out;
}

// Thickened: two copies a few milliseconds behind, wavering, mixed in.
export function chorus(x, rate, mix = 0.5) {
  const out = x.slice();
  for (const [ms, hz, sw] of [[17, 0.6, 2.2], [24, 0.45, 2.8]]) {
    const base = (rate * ms) / 1000;
    const depth = (rate * sw) / 1000;
    for (let i = 0; i < x.length; i++) {
      const p = i - (base + depth * Math.sin((2 * Math.PI * hz * i) / rate));
      if (p >= 0) out[i] += at4(x, p) * mix * 0.7;
    }
  }
  return normalizeIfLoud(out);
}

function normalizeIfLoud(x) {
  const p = peak(x);
  return p > 1 ? gain(x, 0.98 / p) : x;
}

// What a tone generator makes: `kind` 'sine' | 'square' | 'saw' | 'noise',
// at `f` Hz for `secs`, sliding to `f2` (and faded at its ends).
export function tone(rate, kind, f, secs, f2 = f, vol = 0.5) {
  const n = Math.max(1, Math.round(clamp(secs, 0.01, 30) * rate));
  const out = new Float32Array(n);
  let ph = 0;
  let seed = 12345;
  for (let i = 0; i < n; i++) {
    const fr = f + (f2 - f) * (i / n);
    ph = (ph + fr / rate) % 1;
    let v;
    if (kind === 'square') v = ph < 0.5 ? 1 : -1;
    else if (kind === 'saw') v = ph * 2 - 1;
    else if (kind === 'noise') {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      v = seed / 0x3fffffff - 1;
    } else v = Math.sin(ph * 2 * Math.PI);
    out[i] = v * vol;
  }
  return fade(out, Math.min(n / 4, rate * 0.005), Math.min(n / 4, rate * 0.02));
}

// Its loudest and quietest in each of `cols` stretches of [a, b) (to draw
// it): [min, max, min, max...].
export function peaks(x, a, b, cols) {
  const out = new Float32Array(cols * 2);
  const span = Math.max(1e-9, (b - a) / cols);
  for (let c = 0; c < cols; c++) {
    const s = Math.floor(a + c * span);
    const e = Math.max(s + 1, Math.floor(a + (c + 1) * span));
    let lo = 0;
    let hi = 0;
    const step = Math.max(1, Math.floor((e - s) / 256));
    for (let i = Math.max(0, s); i < Math.min(x.length, e); i += step) {
      const v = x[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    out[c * 2] = lo;
    out[c * 2 + 1] = hi;
  }
  return out;
}

// The effects the Sound tab offers, by name: [label, what it asks
// (number settings: [key, label, min, max, step, default]), fn(x, rate, o)].
export const EFFECTS = {
  gain: ['Volume', [['db', 'Louder by (dB)', -24, 24, 0.5, 3]], (x, r, o) => gain(x, 10 ** (o.db / 20))],
  normalize: ['Make it as loud as it can be', [], (x) => normalize(x)],
  fadein: ['Fade in', [], (x) => fade(x, x.length, 0)],
  fadeout: ['Fade out', [], (x) => fade(x, 0, x.length)],
  reverse: ['Backwards', [], (x) => reverse(x)],
  speed: ['Speed (and pitch, like a tape)', [['k', 'Times as fast', 0.25, 4, 0.05, 1.25]], (x, r, o) => speed(x, o.k, r)],
  stretch: ['Speed (keeping the pitch)', [['k', 'Times as fast', 0.25, 4, 0.05, 1.25]], (x, r, o) => stretch(x, 1 / o.k, r)],
  pitch: ['Pitch (keeping the length)', [['semis', 'Half-steps up', -24, 24, 1, 5]], (x, r, o) => pitch(x, o.semis, r)],
  echo: ['Echo', [['time', 'Every (seconds)', 0.03, 1.5, 0.01, 0.25], ['feedback', 'Each as loud (0-0.95)', 0, 0.95, 0.05, 0.45], ['mix', 'Echoes against it', 0, 1, 0.05, 0.5]], (x, r, o) => echo(x, r, o)],
  reverb: ['Room (reverb)', [['size', 'Size (0-1)', 0, 1, 0.05, 0.6], ['damp', 'Softness (0-1)', 0, 1, 0.05, 0.4], ['mix', 'Room against it', 0, 1, 0.05, 0.35]], (x, r, o) => reverb(x, r, o)],
  lowpass: ['Muffle (low-pass)', [['f', 'Above (Hz)', 80, 10000, 10, 1200]], (x, r, o) => filter(x, r, 'lowpass', o.f)],
  highpass: ['Thin out (high-pass)', [['f', 'Below (Hz)', 20, 6000, 10, 400]], (x, r, o) => filter(x, r, 'highpass', o.f)],
  phone: ['Telephone', [['f', 'Around (Hz)', 300, 4000, 10, 1400]], (x, r, o) => normalize(filter(filter(x, r, 'bandpass', o.f, 0.9), r, 'bandpass', o.f, 0.9), peak(x) || 0.9)],
  distort: ['Distortion', [['amount', 'How much (0-1)', 0, 1, 0.05, 0.4]], (x, r, o) => distort(x, o.amount)],
  crush: ['Bit crush', [['bits', 'Bits', 1, 16, 1, 6], ['hold', 'Hold (samples)', 1, 32, 1, 3]], (x, r, o) => crush(x, o.bits, o.hold)],
  tremolo: ['Tremolo', [['hz', 'Times a second', 0.5, 30, 0.5, 6], ['depth', 'Depth (0-1)', 0, 1, 0.05, 0.6]], (x, r, o) => tremolo(x, r, o.hz, o.depth)],
  vibrato: ['Vibrato (wavering pitch)', [['hz', 'Times a second', 0.5, 15, 0.5, 5], ['depth', 'Depth (cents)', 0, 200, 5, 40]], (x, r, o) => vibrato(x, r, o.hz, o.depth)],
  chorus: ['Chorus', [['mix', 'How much (0-1)', 0, 1, 0.05, 0.5]], (x, r, o) => chorus(x, r, o.mix)],
  trim: ['Trim the quiet ends', [], (x) => trimSilence(x)],
};
