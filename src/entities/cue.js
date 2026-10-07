// (Round 71) A master's moves, told to whoever's drawing it (see
// render/bossanim.js, which poses it for each): which move it is (`animK`),
// a count of them (`animN`, so the same one twice running is seen as twice)
// and where it's aimed (`animTo`). Plain fields on it, so every screen in a
// shared world sees the same.
const BREATHS = new Set(['cold', 'fire', 'acid', 'poison', 'gas', 'smoke', 'steam', 'fog', 'mist', 'spores', 'ink', 'wind', 'sorrow', 'oil', 'powder', 'leaves', 'dust']);
const GROUND = new Set(['slam', 'rocks', 'burst', 'erupt', 'spike', 'spikes', 'shards', 'blast', 'wave', 'stone', 'reef', 'tide', 'undertow']);
const isMaster = (c) => !!(c && c.S && c.S.boss && !c.dead);
const far = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

export function cue(c, kind, at = null) {
  if (!isMaster(c)) return;
  const now = c.fightClock || 0;
  // (The same move again in the same breath, a rain of them, a ring after
  // a ring: one move.)
  if (c.animK === kind && now - (c.animAt ?? -9) < 0.45) return;
  c.animK = kind;
  c.animN = (c.animN || 0) + 1;
  c.animAt = now;
  c.animTo = at ? { x: Math.round(at.x * 10) / 10, z: Math.round(at.z * 10) / 10 } : null;
}

// A hazard of its: what it did, as it'd be drawn doing it.
export function cueHazard(c, h) {
  if (!isMaster(c) || h.trap) return;
  const T = h.tiles || [];
  if (!T.length) return;
  let sx = 0;
  let sz = 0;
  for (const q of T) {
    sx += q.x;
    sz += q.z;
  }
  const mid = h.center || { x: sx / T.length, z: sz / T.length };
  const reach = (c.foot || 0) + 1;
  if (h.kind === 'beam' || h.kind === 'laser' || h.kind === 'lane') return cue(c, 'beam', h.to || mid);
  const nearIt = far(mid, c) <= reach + 0.6;
  if (nearIt && (GROUND.has(h.kind) || T.length >= 9)) return cue(c, 'slam');
  const touching = T.some((q) => far(q, c) <= reach);
  if (touching && BREATHS.has(h.kind)) return cue(c, 'breath', mid);
  return cue(c, 'cast', mid);
}
