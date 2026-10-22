// (Round 135) What someone remembers, and what they think of the people
// they know.
//
// A handful of memories each (eight at most): what happened, when, how much
// it mattered to them (`s`, 0..1), whether it was good or bad for them (`v`,
// -1..1), and who it was about (`w`): the one playing ('p:<who>'), one of
// their own town ('n:<idx>'), or someone named from elsewhere. Small things
// are forgotten in a few weeks; the death of a child or a wedding day,
// never quite. A full head lets the least of them go.
//
// What's heard from someone else (gossip) is remembered too, as hearsay
// (`h`): weaker, and passed on less.
//
// What they think of the folk they know (`op`): a dozen of them at most,
// those they feel most strongly about, -1 (can't stand them) to 1 (would do
// anything for them). (What the townsfolk think of the one playing is kept
// as it always was: see Sim.repEntry.)
const MAX_MEM = 8;
const MAX_OP = 12;

// How much a memory still matters `day` days on.
export function weight(m, day) {
  const age = Math.max(0, day - m.d);
  const half = m.s >= 0.8 ? 120 : m.s >= 0.5 ? 40 : 15;
  return m.s * Math.pow(0.5, age / half) * (m.h ? 0.6 : 1);
}

// Remember something: { k: kind, v, s, w?, n?: a name, x?: anything else
// to say of it, d?: the day it happened, if not today }. The same thing
// remembered again (same kind, same who, same day) is the one memory, the
// stronger.
export function remember(rec, m, day) {
  const list = (rec.mem ||= []);
  const at = m.d ?? day;
  const same = list.find((q) => q.k === m.k && q.w === m.w && q.d === at && q.n === m.n);
  if (same) {
    same.s = Math.min(1, Math.max(same.s, m.s));
    return same;
  }
  const e = { k: m.k, d: at, s: Math.round(m.s * 100) / 100, v: Math.round(m.v * 100) / 100 };
  if (m.w) e.w = m.w;
  if (m.n) e.n = m.n;
  if (m.x) e.x = m.x;
  if (m.h) e.h = 1;
  if (m.o) e.o = m.o;
  list.push(e);
  if (list.length > MAX_MEM) {
    let lo = 0;
    for (let i = 1; i < list.length; i++) if (weight(list[i], day) < weight(list[lo], day)) lo = i;
    list.splice(lo, 1);
  }
  return e;
}

// The memories that still matter, most first (and, given `fn`, only those).
export function recall(rec, day, fn = null, min = 0.08) {
  const list = rec && rec.mem;
  if (!list || !list.length) return [];
  const out = [];
  for (const m of list) {
    if (fn && !fn(m)) continue;
    const w = weight(m, day);
    if (w >= min) out.push([w, m]);
  }
  out.sort((a, b) => b[0] - a[0]);
  return out.map((q) => q[1]);
}

// The one memory most on their mind (optionally of a kind, or about someone).
export function uppermost(rec, day, fn = null) {
  return recall(rec, day, fn)[0] || null;
}

// Forget what no longer matters at all (once a day or so).
export function prune(rec, day) {
  if (!rec.mem) return;
  rec.mem = rec.mem.filter((m) => weight(m, day) >= 0.04);
  if (!rec.mem.length) rec.mem = undefined;
}

// ------------------------------------------------------------ opinions
// What they think of `who` (a key: 'n:<idx>' and so on): -1..1, 0 if
// nothing in particular.
export function opinionOf(rec, who) {
  return (rec && rec.op && rec.op[who]) || 0;
}

// Think better (or worse) of `who`, by `d`. Only the strongest dozen kept.
export function warm(rec, who, d) {
  const op = (rec.op ||= {});
  const v = Math.max(-1, Math.min(1, (op[who] || 0) + d));
  if (Math.abs(v) < 0.03) delete op[who];
  else op[who] = Math.round(v * 100) / 100;
  const keys = Object.keys(op);
  if (keys.length > MAX_OP) {
    keys.sort((a, b) => Math.abs(op[a]) - Math.abs(op[b]));
    for (const k of keys.slice(0, keys.length - MAX_OP)) delete op[k];
  }
  if (!Object.keys(op).length) rec.op = undefined;
  return v;
}

// Opinions settle over time, a little each day, toward nothing.
export function mellow(rec) {
  const op = rec.op;
  if (!op) return;
  for (const k of Object.keys(op)) {
    const v = op[k] * 0.985;
    if (Math.abs(v) < 0.03) delete op[k];
    else op[k] = Math.round(v * 1000) / 1000;
  }
  if (!Object.keys(op).length) rec.op = undefined;
}

// ------------------------------------------------------------ gossip
// `a` tells `b` the thing on their mind most worth telling (not hearsay
// they've already passed on, nor anything `b` already knows), if any.
// Returns what was told (b's new memory of it), or null.
export function gossip(a, b, day, tellable = null) {
  const told = recall(a, day, (m) => !m.h && (!tellable || tellable(m)) && Math.abs(m.v) >= 0.3, 0.15);
  for (const m of told) {
    const o = m.o || `${m.k}:${m.w || ''}:${m.n || ''}:${m.d}`;
    if ((b.mem || []).some((q) => (q.o || `${q.k}:${q.w || ''}:${q.n || ''}:${q.d}`) === o)) continue;
    return remember(b, { k: m.k, v: m.v * 0.5, s: m.s * 0.55, w: m.w, n: m.n, x: m.x, h: 1, o, d: m.d }, day);
  }
  return null;
}

// What's kept in a save of someone's memories: as they are, but nothing
// that's faded away.
export function packMemories(list, day) {
  if (!list || !list.length) return undefined;
  const out = list.filter((m) => weight(m, day) >= 0.04);
  return out.length ? out : undefined;
}
