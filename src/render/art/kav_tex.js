// (Round 99) The Kavorent's own, where each goes (the drawings are in
// art/kav_art.js): its alloy wall (four faces: plain, glyphs, a vent, and
// failed), the cradle's names-wall, a viewport, a seam of light; polished
// plates, the hall's inlay, a grate, the dais and its steps, a bed of
// cables, the lift's pad, fallen alloy; and what's set about in it. All of
// it painted around cyan, for the renderer to turn to each floor's light.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './kav_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const PAL = A.ALLOY;
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_A, A.WALL_C];

// The tops (16 by 16), or null if it isn't one of ours.
export function kavTop(name, v) {
  switch (name) {
    case 'kav_wall':
    case 'kav_pillar':
    case 'kav_failed':
    case 'kav_mural':
    case 'kav_viewport':
      return grid({ pal: PAL, rows: A.TOPS[v % 2] });
    case 'kav_floor':
      return grid({ pal: PAL, rows: A.FLOORS[v % 4] });
    case 'kav_node_floor':
      return grid({ pal: PAL, rows: A.NODE });
    case 'kav_inlay':
      return grid({ pal: PAL, rows: A.INLAYS[v % 2] });
    case 'kav_grate':
      return grid({ pal: PAL, rows: v % 2 ? flipX(A.GRATES[1]) : A.GRATES[0] });
    case 'kav_dais':
      return grid({ pal: PAL, rows: A.DAIS[v % 4 === 3 ? 1 : 0] });
    case 'kav_cables':
      return grid({ pal: PAL, rows: v % 2 ? flipX(A.CABLES[(v >> 1) % 2]) : A.CABLES[(v >> 1) % 2] });
    case 'kav_lift':
      return grid({ pal: PAL, rows: A.LIFT });
    case 'kav_debris':
      return grid({ pal: PAL, rows: v % 2 ? flipX(A.DEBRIS[(v >> 1) % 2]) : A.DEBRIS[(v >> 1) % 2] });
    case 'kav_glow':
      return grid({ pal: PAL, rows: A.GLOW_TOP });
    default:
      return null;
  }
}

// The fronts (16 by 12).
export function kavFront(name, v) {
  switch (name) {
    case 'kav_wall':
    case 'kav_pillar':
      return grid({ pal: PAL, rows: WALLS[v % 4] });
    case 'kav_failed':
      return grid({ pal: PAL, rows: v % 2 ? flipX(A.WALL_D) : A.WALL_D });
    case 'kav_mural':
      return grid({ pal: PAL, rows: A.MURAL });
    case 'kav_viewport':
      return grid({ pal: PAL, rows: A.VIEWPORT });
    case 'kav_glow':
      return grid({ pal: PAL, rows: A.GLOW_FACE });
    case 'kav_dais':
      return grid({ pal: PAL, rows: A.DAIS_FACE });
    case 'kav_cables':
      return grid({ pal: PAL, rows: A.CABLES_FACE });
    case 'kav_floor':
    case 'kav_lift':
    case 'kav_debris':
    case 'kav_node_floor':
      return grid({ pal: PAL, rows: A.FLOORS[0].slice(0, 12) });
    case 'kav_inlay':
      return grid({ pal: PAL, rows: A.INLAYS[0].slice(0, 12) });
    case 'kav_grate':
      return grid({ pal: PAL, rows: A.GRATES[0].slice(0, 12) });
    default:
      return null;
  }
}

// ------------------------------------------------------------ the props
const one = (def) => {
  const cache = new Map();
  return (f = 0) => {
    const n = def.frames ? def.frames.length : 1;
    const k = f % n;
    let p = cache.get(k);
    if (!p) cache.set(k, (p = frameOf(def, k)));
    return p.copy();
  };
};
const flipped = (def) => {
  const cache = new Map();
  return (f = 0) => {
    const n = def.frames ? def.frames.length : 1;
    const k = f % n;
    let p = cache.get(k);
    if (!p) cache.set(k, (p = grid({ pal: def.pal, rows: flipX(frameRows(def, k)) })));
    return p.copy();
  };
};
const P = A.KAV_PROPS;
const plain = (def) => {
  const f1 = one(def);
  return (rot, st, f) => f1(f);
};
// (By its state: a console solved, a cache opened, a node woken, a lens
// raised.)
const byState = (off, on) => {
  const a = one(off);
  const b = one(on);
  return (rot, st, f) => (st ? b(f) : a(f));
};
const GLYPHS = [0, 1, 2, 3].map((i) => [one(P[`kav_glyph_${i}`]), one(P[`kav_glyph_${i}_on`])]);
const HUSK = [one(P.kav_husk), flipped(P.kav_husk)];
export const KAV_SPRITES = {
  kav_pod: plain(P.kav_pod),
  kav_pod_open: plain(P.kav_pod_open),
  kav_pod_broken: plain(P.kav_pod_broken),
  kav_cradle: plain(P.kav_cradle),
  kav_orrery: plain(P.kav_orrery),
  kav_rail: plain(P.kav_rail),
  kav_tank: plain(P.kav_tank),
  kav_lens: byState(P.kav_lens, P.kav_lens_raised),
  kav_crate: plain(P.kav_crate),
  kav_shards: plain(P.kav_shards),
  kav_well: plain(P.kav_well),
  // (A glyph pillar's glyph is its turn: rot, 0 to 3; set right, it's lit.)
  kav_glyph: (rot, st, f) => GLYPHS[rot % 4][st ? 1 : 0](f),
  kav_statue: plain(P.kav_statue),
  kav_monolith: plain(P.kav_monolith),
  kav_holo: plain(P.kav_holo),
  kav_console: byState(P.kav_console, P.kav_console_on),
  kav_cache: byState(P.kav_cache, P.kav_cache_open),
  kav_lamp: plain(P.kav_lamp),
  kav_pylon: plain(P.kav_pylon),
  kav_basin: plain(P.kav_basin),
  kav_conduit: plain(P.kav_conduit),
  kav_husk: (rot, st, f) => HUSK[rot % 2](f),
  kav_vent: plain(P.kav_vent),
  kav_node: byState(P.kav_node, P.kav_node_on),
};
export const KAV_ANIM = {
  kav_pod: 2, kav_cradle: 2, kav_orrery: 4, kav_tank: 3, kav_lens: 4, kav_well: 4, kav_glyph: 2,
  kav_statue: 2, kav_monolith: 4, kav_holo: 4, kav_console: 4, kav_lamp: 4, kav_pylon: 2, kav_basin: 4,
  kav_conduit: 4, kav_husk: 4, kav_vent: 2, kav_node: 2,
};
