// (Round 95) The masters drawn by hand, pixel by pixel (see render/art/),
// put in place of their forged pictures (forge.js): each its body (`pix`),
// and the parts of it that move of themselves, each a picture of its own
// turned about its hinge as its `role` has it, as before. What it gives
// off (its `fx`) and how it walks on its own legs, if it does, are kept.
// Each part above the body's breath-line rises and falls with it.
import { FORGE, breathOf } from './forge.js';
import { BARROW_BOSS_ART } from './art/barrow_bosses.js';

export function installPix(art) {
  for (const [k, A] of Object.entries(art)) {
    const D = FORGE[k];
    if (!D) continue;
    D.size = A.size;
    D.ax = A.ax ?? A.size / 2;
    D.ay = A.ay ?? A.size - 2;
    D.pix = { body: A.body, breathY: A.breathY, walk: A.walk || null, idle: A.idle || null, states: A.states || null };
    D.walk = !!A.walk;
    D.joints = null;
    const parts = {};
    for (const [n, q] of Object.entries(A.parts || {})) {
      const [x, y] = q.at;
      // (One hung on another part is placed on that part's picture.)
      const lift = !q.parent && y < A.breathY;
      const p = { ...q, at: q.parent ? q.at : (J) => [x, y - (lift ? Math.round(J.b ?? breathOf(J.t || 0, D.breath ?? 1)) : 0)] };
      // (A part with another picture for a state of the master's: its
      // wings' eyes open, say.)
      if (q.pixVariants) p.variant = (R) => Object.keys(q.pixVariants).find((k) => R.st[k]) || '';
      parts[n] = p;
    }
    D.parts = parts;
  }
}

installPix(BARROW_BOSS_ART);
