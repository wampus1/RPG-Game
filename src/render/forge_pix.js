// (Round 95) The masters drawn by hand, pixel by pixel (see render/art/),
// put in place of their forged pictures (forge.js): each its body (`pix`),
// and the parts of it that move of themselves, each a picture of its own
// turned about its hinge as its `role` has it, as before. What it gives
// off (its `fx`) and how it walks on its own legs, if it does, are kept.
// Each part above the body's breath-line rises and falls with it.
import { FORGE, breathOf } from './forge.js';
import { BARROW_BOSS_ART } from './art/barrow_bosses.js';
import { MINE_BOSS_ART } from './art/mine_bosses.js';
import { CRYPT_BOSS_ART } from './art/crypt_bosses.js';
import { HOLD_BOSS_ART } from './art/hold_bosses.js';
import { KAV_BOSS_ART } from './art/kav_bosses.js';
import { GROVE_BOSS_ART } from './art/grove_bosses.js';
import { FORGE_BOSS_ART } from './art/forge_bosses.js';
import { GROTTO_BOSS_ART } from './art/grotto_bosses.js';
import { CATA_BOSS_ART } from './art/cata_bosses.js';
import { VAULT_BOSS_ART } from './art/vault_bosses.js';
import { GUT_BOSS_ART } from './art/gut_bosses.js';
import { SALT_BOSS_ART } from './art/salt_bosses.js';

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
    const was = D.parts || {};
    for (const [n, q] of Object.entries(A.parts || {})) {
      const [x, y] = q.at;
      // (One hung on another part is placed on that part's picture.)
      const lift = !q.parent && y < A.breathY;
      const p = { ...q, at: q.parent ? q.at : (J) => [x, y - (lift ? Math.round(J.b ?? breathOf(J.t || 0, D.breath ?? 1)) : 0)] };
      // (A part with another picture for a state of the master's: its
      // wings' eyes open, say.)
      // (Or by the forged part's own choosing, when it had one: an oak's
      // crown by its season, say.)
      if (q.pixVariants) p.variant = (was[n] && was[n].variant) || ((R) => Object.keys(q.pixVariants).find((k) => R.st[k]) || '');
      // (When it's shown, as the forged part it stands for was: a neck
      // under the water while its master is down there, say.)
      if (!p.show && was[n] && was[n].show) p.show = was[n].show;
      // (Where it goes kept as the forged part had it, when that moves of
      // itself: a pane of glass orbiting its master, say.)
      if (q.keepAt && was[n]) {
        p.at = was[n].at;
        if (was[n].extra) p.extra = was[n].extra;
      }
      parts[n] = p;
    }
    D.parts = parts;
    // (What the forged one drew over itself that's painted in now: a
    // stag's moss on its antlers, say.)
    for (const k of A.drop || []) delete D[k];
  }
}

installPix(BARROW_BOSS_ART);
installPix(MINE_BOSS_ART);
installPix(CRYPT_BOSS_ART);
installPix(HOLD_BOSS_ART);
installPix(KAV_BOSS_ART);
installPix(GROVE_BOSS_ART);
installPix(FORGE_BOSS_ART);
installPix(GROTTO_BOSS_ART);
installPix(CATA_BOSS_ART);
installPix(VAULT_BOSS_ART);
installPix(GUT_BOSS_ART);
installPix(SALT_BOSS_ART);
