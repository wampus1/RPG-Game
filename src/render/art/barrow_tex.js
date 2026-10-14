// (Round 95) The barrow's own stone and earth, drawn by hand: big
// fieldstones laid dry with dark earth packed between them and moss on
// their shoulders; the mound's turf over the walls, roots through it; the
// floor of trodden earth, a stone or a root in it here and there; worn
// flags down the processional ways; the great carved stones that stand
// either side of them; the oak that lines a chieftain's chamber.
import { grid } from '../pixart.js';

// Fieldstone: cold grey-green, lit from above, earth between.
const STONE = {
  K: '#17120d', k: '#2a2118', d: '#3a3027',
  S: '#3f3d36', s: '#56544a', o: '#6c695c', L: '#858170', H: '#a29d88',
  m: '#34501f', M: '#55762c', g: '#7a9a3c',
};
// The drystone face of a wall (16 by 12), two of them, and mirrored.
const WALL_A = [
  'gMmkLHHHLkMgMkHL',
  'MLokoLLLookLHLko',
  'LooSkossoSkoooSk',
  'osSSkSSSSkkSSSSK',
  'kkkkKdkkkkKkkkkk',
  'LHLkLHHHHLokLHHL',
  'oooSkooooooSkooo',
  'SSSkkSoooSSkkSSS',
  'kkkdKkSSSkkKdkkk',
  'HHLLokkkkkLHHLok',
  'ooooSkLHLkoooSSk',
  'SSSSSkSSSkSSSSSK',
];
const WALL_B = [
  'MgkHHLMgMkLHHLkM',
  'LokLooLHLkooooko',
  'oSkooSoooSkoSSkS',
  'SSkSSSSSSkKSSkkS',
  'kkKkkkkdkkkkkKkk',
  'kLHHLkLHHHLkLHLk',
  'koooSkooooSkooSk',
  'kSSSSkSoooSkSSSk',
  'KkkkkKkSSSkKkkkK',
  'LHLkLHHLkkLHHHLk',
  'oooSkoooSkooooSk',
  'SSSSkSSSSkSSSSSK',
];
// The mound's turf over a wall, from above: grass gone dark, stones
// showing through, roots.
const TURF = { K: '#151a0e', k: '#1f2814', d: '#2a3618', m: '#34441e', M: '#445826', g: '#566c30', s: '#4c4a40', L: '#68655a', r: '#2e2216' };
// Trodden earth, from above.
const EARTH = { K: '#211910', k: '#2c2216', d: '#36291b', e: '#3e3020', E: '#473824', l: '#544330', p: '#6a6152', P: '#857c69', b: '#c8bea4', r: '#2a1e12' };
const EARTH_A = [
  'eeEeeddeeEeeedee',
  'eEeedeeeEeeedeEe',
  'edeeeEeedeeEeeee',
  'eeeEedeeeeedeeEe',
  'eEeeeeePpeeeEeed',
  'deeedeelpkdeeeee',
  'eeEeeeekkeeeeEee',
  'eeeeEeeeeedeeeee',
  'eEdeeeeEeeeeEeee',
  'eeeeedeeeeEeeede',
  'deEeeeeeeeeeeeEe',
  'eeeeEeedeeEeeeee',
  'eEeeeeeeeeeeedee',
  'eeedeEeeEeedeeEe',
  'edeeeeeeeeeeEeee',
  'eeEeedeEeeeeeeed',
];
const EARTH_B = [
  'eeeEeedeeeEeeeee',
  'eEeeeeeeeeeedeEe',
  'eeedeEeeeEeeeeee',
  'deeeeeerreeeEeee',
  'eeEeeerreeeeeede',
  'eeeedrreeeEeeeee',
  'eEeeereeeeeeeEee',
  'eeeeeeeeEeeeeeee',
  'eeeEeeeeeeedeeee',
  'edeeeeEeeeeeeeEe',
  'eeeeeeeeeePpeeee',
  'eEeeedeeeelPkeEe',
  'eeeeeeeEeekkeeee',
  'eeEeeeeeeeeeeede',
  'edeeeEeedeeEeeee',
  'eeeeeeeeeeeeeEee',
];
const EARTH_C = [
  'eeEeeeeeeeEeeeee',
  'eeeedeeEeeeeeeEe',
  'eEeeeeeeeeedeeee',
  'eeeeeEeebbeeeEee',
  'edeeeeebkbbeeeee',
  'eeeEeeeekkeeeede',
  'eeeeeeeeeeeEeeee',
  'eEeedeeeEeeeeeee',
  'eeeeeeeeeeeeeEee',
  'eeeEeeeeeedeeeee',
  'deeeeeEeeeeeeeEe',
  'eeeeeeeeeEeeeeee',
  'eEeeeeeeeeeeEeed',
  'eeeedeEeeeeeeeee',
  'eeeeeeeeedeEeeee',
  'eEeeeeeeeeeeeeEe',
];
// (Round 114) The same trodden earth with nothing in it, most of the floor.
const plainOf = (rows) => rows.map((r) => r.replace(/[PplkbrK]/g, 'e'));
const EARTH_PLAIN = plainOf(EARTH_A);
const EARTH_PLAIN_B = plainOf(EARTH_B);
// Worn flags, from above: big slabs, the cracks between them dark, their
// middles worn smooth and paler.
const FLAG = { K: '#171511', k: '#221f1a', S: '#2f2c26', s: '#3a372f', o: '#444037', O: '#4c483e', L: '#565145', m: '#2f3d1d' };
const FLAG_A = [
  'kssooooskSoooosk',
  'soOOOOOosoOOOOos',
  'soOLLLOosoOLLOos',
  'soOLLLOOsoOLLOos',
  'soOOOOOosoOOOOos',
  'ssooooossSoooosk',
  'kkkkkkkKkkkkkkkk',
  'soooskooooooosmk',
  'soOOskoOOOOOOosk',
  'soOOskoOLLLOOosk',
  'soOOskoOLLOOOosk',
  'soOOskoOOOOOOosk',
  'soOOskoOOOOOOosk',
  'soOosmoooooooosk',
  'ssssskssssssssSk',
  'kkkKkkkkkkkkKkkk',
];
// A flag's edge as a step (the front of a raised floor of them).
const FLAG_FRONT = [
  'LLOOOOOOOLOOOOOL',
  'OoooooooooooooOo',
  'oooosoooooooooso',
  'sooooooosooooooo',
  'kkkkkkkKkkkkkkkk',
  'OOOOOLkOOOOOOOLO',
  'oooooskoooooooso',
  'sooooskooooosooo',
  'oosooskoooooooos',
  'ssssssksssssssss',
  'SSSSSSkSSSSSSSSS',
  'kkkkkkkkkkkkkkkk',
];
// The great standing stone, its face carved in spirals worn shallow.
const ORTHO = { K: '#16140f', k: '#26241e', S: '#3a3a33', s: '#4f4f46', o: '#5e5e54', 0: '#5e5e54', L: '#7c7b6e', H: '#8f8e7a', c: '#26261f', m: '#3b5422' };
const ORTHO_FACE = [
  'kLHHHHHHHHHHHHLk',
  'kHoooooooooooooK',
  'koccccooooccccoK',
  'kcoHHcoooocHHocK',
  'kcocoLcoocLococK',
  'kcoccoLccLoccocK',
  'kocoooLooLooocoK',
  'koocccooooccco0K',
  'kooooooooooooooK',
  'kSooSoooSoooSooK',
  'kSSmSSSSSSSmSSSK',
  'KKKKKKKKKKKKKKKK',
];
// The sealing stone: a slab carved with all four sigils, their grooves
// holding a faint blue light.
const SEAL_FACE = [
  'kLHHHHHHHHHHHHLk',
  'kHoccooooooccooK',
  'kocrcooooocrrcoK',
  'kocccooooooccooK',
  'koooooccccoooooK',
  'koooocrrrrcooooK',
  'koooooccccoooooK',
  'koccoooooooocccK',
  'kocrrcooooocrcoK',
  'koccooooooooccoK',
  'kSSSSSSSSSSSSSSK',
  'KKKKKKKKKKKKKKKK',
];
// Oak: the posts and planks that line a chieftain's chamber.
const OAK = { K: '#140c06', k: '#24160b', d: '#3a2412', w: '#4f331a', W: '#644224', L: '#7c5530', n: '#2e1c0e' };
const OAK_FACE = [
  'LLLLLLLLLLLLLLLL',
  'WWWWWWWWWWWWWWWW',
  'kkkkkkkkkkkkkkkk',
  'LWkwWWwwnWWkLWWk',
  'WwkwwWwwwwwkWwwk',
  'WwkwnwwWwwwkWwnk',
  'WwkwwwwwwnwkWwwk',
  'WwkWwwwwwwwkwwwk',
  'WnkwwWwnwwwkWwwk',
  'WwkwwwwwwwWkWwwk',
  'wwkwwwwwWwwkwnwk',
  'ddkddddddddkdddK',
];

// The mound over the walls, from above: dark peat and old turf, never the
// same twice: a few tufts of dead grass, a stone showing, a root, laid as
// little hand-drawn clusters over a low, close-grained ground.
const TUFT = [['.g.', 'gMg', 'mMm'], ['g.g', 'MgM', '.m.'], ['.M', 'Mg', 'm.']];
const PEB = [['LL', 'sL', 'Ks'], ['.L.', 'LsL', 'KsK']];
export function mound(v, rand) {
  const p = grid({ pal: TURF, rows: Array.from({ length: 16 }, () => 'k'.repeat(16)) });
  const G = { k: '#1c2112', d: '#232a15', m: '#2b3519', M: '#3a4721', g: '#4d5c2a', s: '#3f3d34', L: '#575449', K: '#141710', r: '#2a1f14' };
  const put = (x, y, ch) => {
    if (G[ch]) p.set(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, G[ch]);
  };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, rand() < 0.38 ? 'd' : rand() < 0.12 ? 'm' : 'k');
  const stamp = (art, x, y) => art.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && put(x + i, y + j, ch)));
  for (let i = 0; i < 2 + (v % 2); i++) stamp(TUFT[Math.floor(rand() * TUFT.length)], Math.floor(rand() * 16), Math.floor(rand() * 16));
  if (rand() < 0.5) stamp(PEB[Math.floor(rand() * PEB.length)], Math.floor(rand() * 14), Math.floor(rand() * 14));
  if (rand() < 0.6) {
    let x = rand() * 16;
    let y = rand() * 16;
    for (let i = 0; i < 6; i++) {
      put(Math.floor(x), Math.floor(y), 'r');
      x += rand() * 2 - 0.5;
      y += rand() < 0.5 ? 1 : 0;
    }
  }
  return p;
}

const T_A = { pal: STONE, rows: WALL_A };
const T_B = { pal: STONE, rows: WALL_B };
const flipX = (rows) => rows.map((r) => [...r].reverse().join(''));

// The tops (16 by 16), or null if it isn't one of ours.
export function barrowTop(name, v, rand = Math.random) {
  switch (name) {
    case 'barrow_stone':
      return mound(v, rand);
    case 'barrow_earth': {
      // (Round 114: the plain earth most often; a pebble now and then; a
      // bone least: see Renderer.variantAt.)
      const rows = [EARTH_PLAIN, flipX(EARTH_PLAIN_B), EARTH_A, EARTH_C][v % 4];
      return grid({ pal: EARTH, rows });
    }
    case 'barrow_flags':
      return grid({ pal: FLAG, rows: v % 2 ? flipX(FLAG_A) : v === 2 ? [...FLAG_A].reverse() : FLAG_A });
    case 'barrow_ortho':
    case 'barrow_oak':
    case 'spiral_seal':
      return mound(v + 2, rand);
    default:
      return null;
  }
}

// The fronts (16 by 12).
export function barrowFront(name, v) {
  switch (name) {
    case 'barrow_stone':
      return grid([T_A, T_B, { ...T_A, rows: flipX(WALL_A) }, { ...T_B, rows: flipX(WALL_B) }][v % 4]);
    case 'barrow_earth':
      return grid({ pal: EARTH, rows: EARTH_PLAIN.slice(0, 12) });
    case 'barrow_flags':
      return grid({ pal: FLAG, rows: v % 2 ? flipX(FLAG_FRONT) : FLAG_FRONT });
    case 'barrow_ortho':
      return grid({ pal: ORTHO, rows: v % 2 ? flipX(ORTHO_FACE) : ORTHO_FACE });
    case 'spiral_seal':
      return grid({ pal: { ...ORTHO, r: '#5a9ac8' }, rows: SEAL_FACE });
    case 'barrow_oak':
      return grid({ pal: OAK, rows: v % 2 ? flipX(OAK_FACE) : OAK_FACE });
    default:
      return null;
  }
}

// ------------------------------------------------------------ the props
import { frameOf } from '../pixart.js';
import * as PR from './barrow_props.js';

const one = (def) => {
  const cache = new Map();
  return (rot, st, f = 0) => {
    const n = def.frames ? def.frames.length : 1;
    const k = f % n;
    let p = cache.get(k);
    if (!p) cache.set(k, (p = frameOf(def, k)));
    return p.copy();
  };
};
// The sigil a spiral stone shows (its turn): the spiral it was cut with,
// the sun-wheel, the serpent, the eye (rows 9 to 15 of it, carved).
const GLYPHS = [
  null,
  ['oocccoo', 'ocococo', 'coocooc', 'ccccccc', 'coocooc', 'ocococo', 'oocccoo'],
  ['ooccccc', 'occoooo', 'occoooo', 'oocccco', 'oooooco', 'oooooco', 'cccccoo'],
  ['ooooooo', 'oocccoo', 'ocoooco', 'cocccoc', 'ocoooco', 'oocccoo', 'ooooooo'],
];
const sigilOf = (k) => {
  if (!GLYPHS[k]) return PR.SPIRAL_STONE;
  const rows = [...PR.SPIRAL_STONE.rows];
  GLYPHS[k].forEach((g, j) => {
    const r = rows[9 + j];
    rows[9 + j] = r.slice(0, 5) + g + r.slice(12);
  });
  return { ...PR.SPIRAL_STONE, rows };
};
const SIGIL_STONES = [0, 1, 2, 3].map((k) => one(sigilOf(k)));
export const BARROW_SPRITES = {
  spiral_stone: SIGIL_STONES[0],
  spiral_stone_sun: SIGIL_STONES[1],
  spiral_stone_serpent: SIGIL_STONES[2],
  spiral_stone_eye: SIGIL_STONES[3],
  rune_slab: one(PR.RUNE_SLAB),
  bier: (rot, st, f) => (rot % 2 ? one(PR.BIER_END) : one(PR.BIER_SIDE))(rot, st, f),
  mead_bench: one(PR.BENCH_SIDE),
  feast_board: one(PR.FEAST_BOARD),
  cold_hearth: one(PR.COLD_HEARTH),
  shield_rack: one(PR.SHIELD_RACK),
  grave_spears: one(PR.GRAVE_SPEARS),
  offering_bowl: (rot, st, f) => (st ? one(PR.OFFERING_BOWL_EMPTY) : one(PR.OFFERING_BOWL))(rot, st, f),
  corpse_lantern: one(PR.CORPSE_LANTERN),
  ship_prow: one(PR.SHIP_PROW),
  grave_goods: one(PR.GRAVE_GOODS),
  cairn: one(PR.CAIRN),
};
export const BARROW_ANIM = { cold_hearth: 3, corpse_lantern: 4 };

// A rune cut in the floor that catches at the living who step on it,
// faint until you're close (see game/deeps.js).
const SNARE = [
  '................',
  '.....c.cc.c.....',
  '...cc......cc...',
  '..c..........c..',
  '..c....rr....c..',
  '.c....r..r....c.',
  '......r..r......',
  '.c...rrrrrr...c.',
  '.c......r.....c.',
  '......r.r.r.....',
  '.c...r..r..r..c.',
  '..c.....r....c..',
  '..c..........c..',
  '...cc......cc...',
  '.....c.cc.c.....',
  '................',
];
export function barrowFlat(name, v) {
  if (name !== 'snare_rune') return null;
  return grid({ pal: { c: ['#23334a', 150], r: ['#5a9ac8', 190] }, rows: v % 2 ? flipX(SNARE) : SNARE });
}
