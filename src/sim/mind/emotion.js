// (Round 135) How someone feels.
//
// Seven feelings, each from nothing to as much as a person can hold:
//   joy, grief, fear, anger, shame, pride, and love (warmth for someone,
//   longing for them);
// and, underneath, strain (a slow weight of worry, hunger, overwork and
// hard news, that makes everything else harder).
//
// What happens is weighed by who it happens to (see mind.js: appraisal): a
// raid frightens the timid and angers the brave, a death grieves its own
// and barely touches strangers, a kind word lifts the lonely more than the
// popular. Feelings fade, each at its own pace (joy in a day or so, grief
// over a week), and as they come and go they move the long mood (`mood`, as
// it's always been) a little.
//
// What's kept on a record (`emo`): only what's felt, when it was last
// looked at (`t`), and nothing at all for someone at peace. Fading is
// worked out when they're next looked at, not every hour for everyone.
import { clamp } from '../../util/rng.js';

export const FEELINGS = ['joy', 'grief', 'fear', 'anger', 'shame', 'pride', 'love', 'strain'];
const KEY = { joy: 'j', grief: 'g', fear: 'f', anger: 'a', shame: 's', pride: 'p', love: 'l', strain: 'x' };
const NAME = Object.fromEntries(Object.entries(KEY).map(([k, v]) => [v, k]));
// How long each takes to fade by half (game minutes).
const HALF = { j: 1200, g: 6 * 1440, f: 1.5 * 1440, a: 2 * 1440, s: 3 * 1440, p: 3 * 1440, l: 4 * 1440, x: 4 * 1440 };
// How each sits with the long mood (and which way).
const VAL = { j: 1, g: -1.1, f: -0.7, a: -0.6, s: -0.7, p: 0.6, l: 0.4, x: -0.5 };

// The feelings as they are at `now` (faded since last looked at; written
// back). Null for someone who feels nothing in particular.
export function feelings(rec, now) {
  const e = rec && rec.emo;
  if (!e) return null;
  const dt = now - (e.t ?? now);
  if (dt > 0) {
    let any = false;
    for (const k in HALF) {
      const v = e[k];
      if (!v) continue;
      const nv = v * Math.pow(0.5, dt / HALF[k]);
      if (nv < 0.02) delete e[k];
      else {
        e[k] = nv;
        any = true;
      }
    }
    e.t = now;
    if (!any) {
      rec.emo = null;
      return null;
    }
  }
  return e;
}

// How strongly they feel `kind` just now (0..1).
export function feel(rec, kind, now) {
  const e = feelings(rec, now);
  return e ? e[KEY[kind]] || 0 : 0;
}

// Something felt: `amt` more of `kind` (0..1, added the way feelings pile
// up: the fuller, the less more does), or less (`amt` < 0: soothed). The
// long mood shifts a little with it.
export function stir(rec, kind, amt, now) {
  if (!rec || !amt) return 0;
  const k = KEY[kind];
  if (!k) return 0;
  feelings(rec, now);
  const e = (rec.emo ||= { t: now });
  e.t = now;
  const v = e[k] || 0;
  const nv = amt > 0 ? v + amt * (1 - v) : v * (1 + Math.max(-1, amt));
  if (nv < 0.02) delete e[k];
  else e[k] = Math.min(1, nv);
  rec.mood = clamp((rec.mood ?? 0.5) + (nv - v) * VAL[k] * 0.18, 0, 1);
  return e[k] || 0;
}

// The strongest feeling just now, if it's strong enough to show: { kind, v }.
export function dominant(rec, now, min = 0.25) {
  const e = feelings(rec, now);
  if (!e) return null;
  let best = null;
  for (const k in VAL) {
    if (k === 'x') continue;
    const v = e[k] || 0;
    if (v >= min && (!best || v > best.v)) best = { kind: NAME[k], v };
  }
  return best;
}

// All told, how they feel: from -1 (wretched) to 1 (happy).
export function valence(rec, now) {
  const e = feelings(rec, now);
  if (!e) return 0;
  let s = 0;
  for (const k in VAL) s += (e[k] || 0) * VAL[k];
  return clamp(s, -1, 1);
}

// How their work goes for how they feel: grief and strain slow the hands,
// gladness and pride quicken them (0.5..1.15).
export function workMul(rec, now) {
  const e = feelings(rec, now);
  if (!e) return 1;
  return clamp(1 + (e.j || 0) * 0.1 + (e.p || 0) * 0.06 - (e.g || 0) * 0.35 - (e.f || 0) * 0.15 - (e.a || 0) * 0.08 - (e.x || 0) * 0.2, 0.5, 1.15);
}

// How well they take things in just now (learning goes slower for a mind
// elsewhere): 0.5..1.1.
export function focus(rec, now) {
  const e = feelings(rec, now);
  if (!e) return 1;
  return clamp(1 + (e.j || 0) * 0.1 - (e.g || 0) * 0.4 - (e.f || 0) * 0.2 - (e.x || 0) * 0.25, 0.5, 1.1);
}

// The feelings as they're written into a save: rounded, nothing faded to
// nothing.
export function packFeelings(e) {
  if (!e) return undefined;
  const out = { t: Math.round(e.t || 0) };
  let any = false;
  for (const k in HALF) {
    const v = e[k];
    if (v >= 0.02) {
      out[k] = Math.round(v * 100) / 100;
      any = true;
    }
  }
  return any ? out : undefined;
}

// A feeling's word, as someone might say how they are.
export const FEEL_WORDS = {
  joy: ['glad', 'happy', 'in good spirits', 'cheerful'],
  grief: ['grieving', 'heartsore', 'sorrowful', 'low'],
  fear: ['frightened', 'uneasy', 'on edge', 'scared'],
  anger: ['angry', 'furious', 'sore', 'bitter'],
  shame: ['ashamed', 'embarrassed', 'mortified'],
  pride: ['proud', 'pleased with myself', 'chuffed'],
  love: ['fond', 'smitten', 'warm-hearted'],
};

// The colour a feeling's words take on (see ui/textfx.js).
export const FEEL_COLOR = {
  joy: '#ffe890',
  grief: '#9ab0d8',
  fear: '#d8c8ff',
  anger: '#ff7a60',
  shame: '#d8a0b0',
  pride: '#ffd070',
  love: '#ff9ac0',
};
