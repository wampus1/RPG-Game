// (Round 62) How much what's on someone (a mod's effects, and the plain
// conditions they give: see hooks.js) changes one of their stats, in
// percent: 'speed', 'damage', 'armor'. (Nothing imported: the game's own
// modules ask it without pulling the mods in.)
export function modStat(e, k) {
  const list = e && e.modFx;
  if (!list || !list.length) return 0;
  let n = 0;
  for (const q of list) {
    const d = q.rec ? q.rec.f : q.def;
    const v = d && d[k];
    if (typeof v === 'number') n += v;
  }
  return n;
}
