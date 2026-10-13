// (Round 103) The Imperial Catacomb's own, where each goes (the drawings are
// in art/catacomb_art.js): its wall of tufa laid in a net under a travertine
// cornice (three of it, the last keeping its red plaster, and the first
// turned the other way); the shelf-graves of the galleries, sealed (two
// kinds) or broken open, one with something in it; a columbarium; the
// frescoes; the ossuary's skulls; an inscription; the family's tree; the
// relief of the Triumph; an arcosolium; the family tomb's door; the faces
// of the portico and the tribunal, and of a floor where it's sunk (the bone
// pit); opus sectile, mosaic, travertine flags, tufa, bones, porphyry; and
// what's set about in it.
import { grid, frameOf, frameRows } from '../pixart.js';
import * as A from './catacomb_art.js';

const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));
const WALL = A.WALL;
const FLOOR = A.FLOOR;
const WALLS = [A.WALL_A, A.WALL_B, A.WALL_C];
const wall = (v) => (v === 3 ? flipX(WALLS[0]) : WALLS[v % 3]);
const FACES = {
  cc_loculi: (v) => (v % 2 ? A.LOCULI_B : A.LOCULI), cc_loculi_open: () => A.LOCULI_OPEN, cc_handhole: () => A.HANDHOLE,
  cc_columbarium: () => A.COLUMBARIUM, cc_fresco: () => A.FRESCO, cc_dove: () => A.DOVE, cc_skulls: (v) => (v % 2 ? flipX(A.SKULLS) : A.SKULLS),
  cc_inscription: () => A.INSCRIPTION, cc_stemma: () => A.STEMMA, cc_relief: () => A.RELIEF, cc_arcosolium: () => A.ARCOSOLIUM, cc_tombdoor: () => A.TOMBDOOR,
};
const FLOORS = new Set(['cc_sectile', 'cc_mosaic', 'cc_mosaicnet', 'cc_flags', 'cc_tufafloor', 'cc_bonefloor', 'cc_porphyry']);
const turned = (rows, v) => (v % 2 ? flipX(rows) : rows);

// The tops (16 by 16), or null if it isn't one of ours.
export function catacombTop(name, v) {
  if (name === 'cc_tufa' || FACES[name]) return grid({ pal: WALL, rows: turned(A.TOPS[(v >> 1) % 3], v) });
  switch (name) {
    case 'cc_sectile':
      return grid({ pal: FLOOR, rows: A.SECTILE[(v >> 1) % 2] });
    case 'cc_mosaic':
      return grid({ pal: FLOOR, rows: A.MOSAIC[0] });
    case 'cc_mosaicnet':
      return grid({ pal: FLOOR, rows: A.MOSAIC[1] });
    case 'cc_flags':
    case 'cc_portico':
      return grid({ pal: FLOOR, rows: turned(A.FLAGS[(v >> 1) % 3], v) });
    case 'cc_tufafloor':
      return grid({ pal: FLOOR, rows: turned(A.TUFA[(v >> 1) % 2], v) });
    case 'cc_bonefloor':
      return grid({ pal: FLOOR, rows: turned(A.BONES[(v >> 1) % 2], v) });
    case 'cc_porphyry':
    case 'cc_tribunal':
      return grid({ pal: FLOOR, rows: turned(A.PORPHYRY[0], v) });
    default:
      return null;
  }
}
// The fronts (16 by 12).
export function catacombFront(name, v) {
  if (name === 'cc_tufa') return grid({ pal: WALL, rows: wall(v) });
  if (FACES[name]) return grid({ pal: WALL, rows: FACES[name](v) });
  if (name === 'cc_portico') return grid({ pal: WALL, rows: A.PORTICO });
  if (name === 'cc_tribunal') return grid({ pal: WALL, rows: A.TRIBUNAL });
  // (A floor seen from the side, where it's sunk: the bone pit's lining.)
  if (FLOORS.has(name)) return grid({ pal: WALL, rows: turned(A.PITFACE, v) });
  return null;
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
const P = A.CATACOMB_PROPS;
const plain = (def) => {
  const f1 = one(def);
  return (rot, st, f) => f1(f);
};
const either = (def) => {
  const a = one(def);
  const b = flipped(def);
  return (rot, st, f) => (rot % 2 ? b(f) : a(f));
};
// (A lamp by its state: lit, its flame flickering; or snuffed, cold.)
const byState = (on, off) => {
  const a = one(on);
  const b = one(off);
  return (rot, st, f) => (st ? a(f) : b(f));
};
// (One of several by its rot: an urn's kind.)
const byRot = (defs) => {
  const fs = defs.map(one);
  return (rot, st, f) => fs[rot % fs.length](f);
};
// (A bust: whose it is by its rot; its fillet shining once touched in turn.)
const BUSTS = [0, 1, 2, 3].map((k) => [one(P[`cc_bust_${k}`]), one(P[`cc_bust_${k}_lit`])]);
export const CATACOMB_SPRITES = {
  cc_lamp: byState(P.cc_lamp, P.cc_lamp_off),
  cc_lucerna: byState(P.cc_lucerna, P.cc_lucerna_off),
  cc_urn: byRot([P.cc_urn_0, P.cc_urn_1, P.cc_urn_2]),
  cc_sarcophagus: plain(P.cc_sarcophagus),
  cc_bust: (rot, st, f) => BUSTS[rot % 4][st ? 1 : 0](f),
  cc_statue: either(P.cc_statue),
  cc_eagle: plain(P.cc_eagle),
  cc_column: plain(P.cc_column),
  cc_tropaeum: either(P.cc_tropaeum),
  cc_altar: plain(P.cc_altar),
  cc_bones: either(P.cc_bones),
  cc_skullpile: plain(P.cc_skullpile),
  cc_amphora: either(P.cc_amphora),
  cc_tools: either(P.cc_tools),
  cc_slab: either(P.cc_slab),
  cc_rubble: either(P.cc_rubble),
  cc_ladder: plain(P.cc_ladder),
  cc_banner: plain(P.cc_banner),
};
export const CATACOMB_ANIM = {
  cc_lamp: 3, cc_lucerna: 3, cc_eagle: 2, cc_banner: 2,
};
