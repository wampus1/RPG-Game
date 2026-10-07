// The great ships (round 68), cube by cube: a sloop, a brigantine, a
// galleon and a frigate, each built the same way out of the same blocks as
// the world (see blocks.js: hull planking, deck planking, the rail, the
// gunports, the stern's windows and gilding, copper under the waterline).
// A ship is a box of cells, `W` across (x, port to starboard), `H` up (y,
// the keel at 0) and `L` long (z, the stern at 0, the bow at L - 1): her
// hull is shaped frame by frame, fuller amidships, fining to a stem at the
// bow and a square transom at the stern, narrowing to the keel below the
// waterline. Inside are her decks (the hold at the bottom, a gun deck or a
// 'tween deck, the main deck over them), stairs between them, and what
// each holds; over the main deck, a raised quarterdeck aft and a
// forecastle forward (the galleon's tall enough to have cabins under them,
// and a poop deck over all), a rail round every deck, her guns, her wheel
// and her masts. The same cells are her outside (drawn turned to any
// heading: see render/shipvox.js) and her inside (laid out as a place
// apart: see game/shiphold.js), so a plank knocked out of one is gone from
// the other.
//   What's not cells is said here too: where each mast stands and how
// it's rigged, where the guns are, where the wheel and the hatches are.
import { B, BLOCKS, META_STATE } from './blocks.js';

// Each kind: her size, her waterline (`wl`: the cells at and below it are
// under water when she floats light), her decks (floor layers), how she
// sails (top speed in paces a second at her best: a raft makes 5; how fast
// she turns; how slowly she gathers way), how many she needs to work her,
// and her guns.
export const SHIP_TYPES = {
  sloop: {
    name: 'Sloop', L: 16, W: 7, wl: 2, deck: 4, floors: [1],
    quarter: { z1: 2, y: 5 }, fore: null, poop: null,
    masts: [{ z: 0.58, h: 14, rig: 'sloop' }],
    bowsprit: 5, deckGuns: [5, 9], gunDeck: null,
    speed: 14, turn: 0.95, accel: 0.55, crew: 3, hold: 2, cost: 1400,
    blurb: 'Small, quick to turn, handy with a crew of three. One mast, a gaff mainsail and a jib.',
  },
  brigantine: {
    name: 'Brigantine', L: 23, W: 9, wl: 3, deck: 7, floors: [1, 4],
    quarter: { z1: 4, y: 8 }, fore: { z0: 19, y: 8 }, poop: null,
    masts: [{ z: 0.66, h: 17, rig: 'square3' }, { z: 0.36, h: 18, rig: 'gaff' }],
    bowsprit: 7, deckGuns: [7, 10, 13, 16], gunDeck: null,
    speed: 20, turn: 0.7, accel: 0.42, crew: 6, hold: 4, cost: 3600,
    blurb: 'Two masts: square sails forward, a great gaff sail aft. Fast and weatherly; eight guns on her deck.',
  },
  galleon: {
    name: 'Galleon', L: 32, W: 11, wl: 4, deck: 7, floors: [1, 4],
    quarter: { z1: 9, y: 10 }, fore: { z0: 26, y: 10 }, poop: { z1: 4, y: 13 },
    masts: [{ z: 0.72, h: 18, rig: 'square2' }, { z: 0.5, h: 21, rig: 'square3' }, { z: 0.2, h: 15, rig: 'lateen' }],
    bowsprit: 8, deckGuns: [12, 15, 18, 21], gunDeck: [7, 10, 13, 16, 19, 22],
    speed: 16, turn: 0.4, accel: 0.26, crew: 12, hold: 8, cost: 7200,
    blurb: 'A towering castle of a ship: cabins under her castles, a deep hold for cargo, a gun deck and guns on her main deck. Slow to turn, slow to stop.',
  },
  frigate: {
    name: 'Frigate', L: 30, W: 9, wl: 3, deck: 7, floors: [1, 4],
    quarter: { z1: 6, y: 8 }, fore: { z0: 26, y: 8 }, poop: null,
    masts: [{ z: 0.72, h: 20, rig: 'square3' }, { z: 0.48, h: 23, rig: 'square3' }, { z: 0.22, h: 18, rig: 'mizzen' }],
    bowsprit: 9, deckGuns: [10, 18], gunDeck: [6, 9, 12, 15, 18, 21, 24],
    speed: 30, turn: 0.6, accel: 0.36, crew: 10, hold: 4, cost: 9000,
    blurb: 'Built to fly: long and lean, three masts of square sail, fourteen guns on her gun deck. The fastest thing on the sea, handled well.',
  },
};
export const SHIP_KINDS = Object.keys(SHIP_TYPES);

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// How far out from her centreline she reaches at frame z, layer y (in
// cells: a cell is hers while its middle is within this).
function halfBeam(T, z, y) {
  const L = T.L;
  const t = z / (L - 1);
  let plan;
  if (t < 0.14) plan = 0.78 + 0.22 * Math.sin((t / 0.14) * Math.PI / 2);
  else if (t <= 0.6) plan = 1;
  else plan = Math.pow(Math.max(0, 1 - Math.pow((t - 0.6) / 0.4, 1.7)), 0.62);
  // (Below the waterline, narrowing to the keel; above, a little
  // tumblehome.)
  let sec;
  if (y <= T.wl) sec = 0.3 + 0.7 * Math.pow(clamp01((y + 0.6) / (T.wl + 1)), 0.6);
  else sec = y > T.deck ? 0.97 : 1;
  return (T.W / 2) * plan * sec;
}

// The keel's line: rising aft a little, and forward into the stem.
function keelAt(T, z) {
  const t = z / (T.L - 1);
  if (t < 0.1) return t < 0.04 ? 1 : 0;
  if (t > 0.72) return Math.round(Math.pow((t - 0.72) / 0.28, 1.6) * (T.wl + 0.4));
  return 0;
}

// The top of her at frame z: her main deck, or a castle's.
function topOf(T, z) {
  if (T.poop && z <= T.poop.z1) return T.poop.y;
  if (T.quarter && z <= T.quarter.z1) return T.quarter.y;
  if (T.fore && z >= T.fore.z0) return T.fore.y;
  return T.deck;
}

const MODELS = new Map();

// A kind's model (made once).
export function shipModel(type) {
  let m = MODELS.get(type);
  if (!m) {
    m = build(type);
    MODELS.set(type, m);
  }
  return m;
}

function build(type) {
  const T = SHIP_TYPES[type];
  const { L, W } = T;
  const H = Math.max(T.deck, (T.poop || T.quarter || {}).y || 0, (T.fore || {}).y || 0) + 3;
  const N = W * H * L;
  const vox = new Uint16Array(N);
  const meta = new Uint8Array(N);
  const idx = (x, y, z) => (y * L + z) * W + x;
  const inBox = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < L;
  const get = (x, y, z) => (inBox(x, y, z) ? vox[idx(x, y, z)] : 0);
  const set = (x, y, z, id, mt = 0) => {
    if (!inBox(x, y, z)) return;
    vox[idx(x, y, z)] = id;
    meta[idx(x, y, z)] = mt;
  };
  const mid = (W - 1) / 2;
  // Which cells are within her hull.
  const hull = new Uint8Array(N);
  const inHull = (x, y, z) => inBox(x, y, z) && hull[idx(x, y, z)] === 1;
  for (let z = 0; z < L; z++) {
    const k0 = keelAt(T, z);
    const top = topOf(T, z);
    for (let y = k0; y <= top; y++) {
      const hw = halfBeam(T, z, y);
      for (let x = 0; x < W; x++) if (Math.abs(x - mid) <= hw - 0.02 || (x === mid && hw > 0.3)) hull[idx(x, y, z)] = 1;
    }
  }
  // Her deck level, frame by frame and cell by cell: at or below it is
  // inside her, above it out on deck.
  const deckLevel = new Int8Array(W * L).fill(-1);
  // Her skin: wherever she meets the outside.
  for (let z = 0; z < L; z++) {
    const top = topOf(T, z);
    for (let x = 0; x < W; x++) {
      let any = false;
      for (let y = 0; y < H; y++) {
        if (!inHull(x, y, z)) continue;
        any = true;
        const skin = !inHull(x - 1, y, z) || !inHull(x + 1, y, z) || !inHull(x, y, z - 1) || !inHull(x, y, z + 1) || !inHull(x, y - 1, z);
        if (skin) set(x, y, z, y <= T.wl - 1 ? B.copper_sheath : B.hull_planks);
        else if (y === top || T.floors.includes(y) || y === T.deck) set(x, y, z, B.deck_planks);
      }
      if (any) deckLevel[z * W + x] = top;
    }
  }
  // The keel itself, and the stem and sternpost: dark timber.
  for (let z = 0; z < L; z++) {
    const k0 = keelAt(T, z);
    if (inHull(Math.round(mid), k0, z)) set(Math.round(mid), k0, z, B.hull_planks);
  }
  const cx = Math.round(mid);
  // The rail round each deck's edge (gaps where the steps come up, where
  // the guns are and for the gangways).
  const gaps = new Set();
  const gk = (x, z) => x * 1000 + z;
  // A paint band (a strake, in her colours: see shipvox.js) just under the
  // rail, and gilding on the transom for the great ships.
  for (let z = 0; z < L; z++) {
    const top = topOf(T, z);
    for (let x = 0; x < W; x++) {
      if (!inHull(x, top, z)) continue;
      const edge = !inHull(x - 1, top, z) || !inHull(x + 1, top, z) || !inHull(x, top, z - 1) || !inHull(x, top, z + 1);
      // (The castles' fronts get theirs below: they look down on the deck.)
      if (edge) set(x, top + 1, z, B.ship_rail);
    }
  }
  // The castles' front edges: a rail looking down on the main deck, with
  // the steps coming up at either side.
  const stepsUp = (z1, dir, from, to) => {
    // Steps down from a deck at `from` to one at `to`, starting at frame
    // z1 + dir and going `dir`-ward, at the two sides. (Round 69: at the
    // sides of the castle's own front row, just in from its rail, so they
    // come up onto its deck however narrow she is there: before, at the
    // narrow bow and stern they came up beside it, against its rail, and
    // whoever got up there some other way couldn't get down again.)
    const n = from - to - 1;
    let x0 = -1;
    let x1 = -1;
    for (let x = 0; x < W; x++) {
      if (!inHull(x, from, z1)) continue;
      if (x0 < 0) x0 = x;
      x1 = x;
    }
    const xs = x0 < 0 ? [1, W - 2] : x1 - x0 >= 4 ? [x0 + 1, x1 - 1] : [x0 + 1];
    for (const x of xs) {
      for (let k = 1; k <= n; k++) {
        const z = z1 + dir * k;
        for (let y = to + 1; y <= from - k; y++) set(x, y, z, B.deck_planks);
      }
      gaps.add(gk(x, z1));
    }
  };
  if (T.quarter) {
    const { z1, y } = T.quarter;
    for (let x = 0; x < W; x++) if (inHull(x, y, z1)) set(x, y + 1, z1, B.ship_rail);
    stepsUp(z1, 1, y, T.deck);
  }
  if (T.poop) {
    const { z1, y } = T.poop;
    for (let x = 0; x < W; x++) if (inHull(x, y, z1)) set(x, y + 1, z1, B.ship_rail);
    stepsUp(z1, 1, y, T.quarter.y);
  }
  if (T.fore) {
    const { z0, y } = T.fore;
    for (let x = 0; x < W; x++) if (inHull(x, y, z0)) set(x, y + 1, z0, B.ship_rail);
    stepsUp(z0, -1, y, T.deck);
  }
  // Doors into the cabins under the castles (where there's headroom).
  const cabins = [];
  if (T.quarter && T.quarter.y - T.deck >= 3) {
    set(cx, T.deck + 1, T.quarter.z1, B.air);
    set(cx, T.deck + 2, T.quarter.z1, B.air);
    cabins.push({ kind: 'cabin', z0: 1, z1: T.quarter.z1 - 1, y: T.deck + 1, door: { x: cx, z: T.quarter.z1 } });
  }
  if (T.poop && T.poop.y - T.quarter.y >= 3) {
    set(cx, T.quarter.y + 1, T.poop.z1, B.air);
    set(cx, T.quarter.y + 2, T.poop.z1, B.air);
    cabins.push({ kind: 'great', z0: 1, z1: T.poop.z1 - 1, y: T.quarter.y + 1, door: { x: cx, z: T.poop.z1 } });
  }
  if (T.fore && T.fore.y - T.deck >= 3) {
    set(cx, T.deck + 1, T.fore.z0, B.air);
    set(cx, T.deck + 2, T.fore.z0, B.air);
    cabins.push({ kind: 'galley', z0: T.fore.z0 + 1, z1: L - 3, y: T.deck + 1, door: { x: cx, z: T.fore.z0 } });
  }
  // Stairs down through her decks: an opening in each deck with steps
  // down under it, one well forward of the other. (The main deck's has a
  // low coaming round its sides.)
  const hatches = [];
  const decks = [...T.floors, T.deck].sort((a, b) => a - b);
  const mastZ = T.masts.map((q) => Math.round(q.z * (L - 1)));
  for (let i = decks.length - 1; i > 0; i--) {
    const U = decks[i];
    const D = decks[i - 1];
    const n = U - D - 1;
    // (Clear of the masts, and of the stairs above.)
    let zs = Math.round(L * (i === decks.length - 1 ? 0.42 : 0.6)) - 1;
    const clash = (z) => mastZ.some((mz) => mz >= z - 1 && mz <= z + n) || hatches.some((h) => Math.abs(h.z - z) < n + 2);
    for (let tries = 0; tries < L && clash(zs); tries++) zs += tries % 2 ? tries : -tries;
    const x = cx + 1;
    for (let j = 1; j <= n; j++) {
      const z = zs + j - 1;
      for (let y = D + 1; y <= D + j; y++) set(x, y, z, B.deck_planks);
      set(x, U, z, B.air);
    }
    hatches.push({ x, z: zs, n, U, D, top: U === T.deck });
    if (U === T.deck) {
      // The coaming: either side of the opening, and across its far end.
      for (let z = zs - 1; z <= zs + n - 1; z++) {
        if (inHull(x - 1, U, z) && get(x - 1, U + 1, z) === 0) set(x - 1, U + 1, z, B.ship_rail);
        if (inHull(x + 1, U, z) && get(x + 1, U + 1, z) === 0) set(x + 1, U + 1, z, B.ship_rail);
      }
      if (get(x, U + 1, zs - 1) === 0) set(x, U + 1, zs - 1, B.ship_rail);
    }
  }
  // The gangways: a gap in the rail amidships each side, to come aboard by.
  const gangways = [];
  {
    const z = Math.round(L * 0.5);
    for (const side of [-1, 1]) {
      let x = side < 0 ? 0 : W - 1;
      while (x >= 0 && x < W && !inHull(x, T.deck, z)) x -= side;
      if (get(x, T.deck + 1, z) === B.ship_rail) {
        set(x, T.deck + 1, z, B.air);
        gangways.push({ x, y: T.deck + 1, z, side });
      }
    }
  }
  for (const k of gaps) {
    const x = Math.floor(k / 1000);
    const z = k % 1000;
    for (const y of [T.deck + 1, (T.quarter || {}).y + 1, (T.fore || {}).y + 1, (T.poop || {}).y + 1]) if (y && get(x, y, z) === B.ship_rail) set(x, y, z, B.air);
  }
  // Masts: stepped on the keel, up through every deck; above the top deck
  // they're drawn as spars (the cell they stand in is theirs, though).
  const masts = [];
  for (const md of T.masts) {
    const z = Math.round(md.z * (L - 1));
    const top = topOf(T, z);
    for (let y = keelAt(T, z) + 1; y <= top + 1; y++) set(cx, y, z, B.ship_mast);
    masts.push({ x: cx, z, base: top + 1, h: md.h, rig: md.rig });
  }
  // The wheel: on the quarterdeck (or aft on a sloop's deck), clear of
  // the masts, with room aft of it for whoever's steering.
  const helmY = (T.quarter ? T.quarter.y : T.deck) + 1;
  const mz = new Set(T.masts.map((q) => Math.round(q.z * (L - 1))));
  let helmZ = -1;
  const zTop = T.quarter ? T.quarter.z1 : 3;
  const zLow = T.poop ? T.poop.z1 + 2 : 2;
  for (let z = zTop; z >= zLow && helmZ < 0; z--) {
    if (mz.has(z) || mz.has(z - 1)) continue;
    const here = get(cx, helmY, z);
    if (here !== 0 && here !== B.ship_rail) continue;
    if (get(cx, helmY, z - 1) !== 0 || get(cx, helmY + 1, z - 1) !== 0 || !inHull(cx, helmY - 1, z - 1)) continue;
    helmZ = z;
  }
  if (helmZ < 0) helmZ = Math.max(1, zTop - 1);
  set(cx, helmY, helmZ, B.helm);
  const helm = { x: cx, y: helmY, z: helmZ, stand: { x: cx, y: helmY, z: helmZ - 1 } };
  // The guns. On the main deck: in the rail, either side, run out through
  // it. On a gun deck: behind their ports in the hull.
  const guns = [];
  for (const z of T.deckGuns || []) {
    if (z >= L) continue;
    const top = topOf(T, z);
    for (const side of [-1, 1]) {
      let x = side < 0 ? 0 : W - 1;
      while (x >= 0 && x < W && !inHull(x, top, z)) x -= side;
      if (x < 0 || x >= W) continue;
      if (get(x, top + 1, z) !== B.ship_rail) continue;
      set(x, top + 1, z, B.ship_cannon, side < 0 ? 1 : 3);
      guns.push({ x, y: top + 1, z, side, deck: true });
    }
  }
  if (T.gunDeck) {
    const gy = decks[decks.length - 2] + 1;
    for (const z of T.gunDeck) {
      for (const side of [-1, 1]) {
        let x = side < 0 ? 0 : W - 1;
        while (x >= 0 && x < W && !inHull(x, gy, z)) x -= side;
        if (x < 0 || x >= W) continue;
        const ix = x - side;
        if (get(ix, gy, z) !== 0) continue;
        set(x, gy, z, B.gunport);
        set(ix, gy, z, B.ship_cannon, side < 0 ? 1 : 3);
        guns.push({ x: ix, y: gy, z, side, deck: false, port: { x, y: gy, z } });
      }
    }
  }
  // The stern: windows into the cabins, gilding along the transom's top,
  // for the great ships.
  if (cabins.length) {
    for (const c of cabins) {
      if (c.kind === 'galley') continue;
      for (let x = 0; x < W; x++) {
        if (get(x, c.y, 0) === B.hull_planks && Math.abs(x - mid) < W / 2 - 1.5) set(x, c.y, 0, B.stern_window);
      }
    }
    const tt = topOf(T, 0);
    for (let x = 0; x < W; x++) if (get(x, tt, 0) === B.hull_planks) set(x, tt, 0, B.gilt_trim);
    for (let x = 0; x < W; x++) if (get(x, tt + 1, 0) === B.ship_rail) set(x, tt + 1, 0, B.gilt_trim);
  }
  // Below: what each deck holds. The hold: cargo, the pump by the main
  // mast. The gun deck (or 'tween deck): hammocks between the guns, a
  // lantern or two. The cabins: the captain's table, a bed, a chest.
  const free = (x, y, z) => inHull(x, y, z) && get(x, y, z) === 0 && get(x, y + 1, z) === 0 && BLOCKS[get(x, y - 1, z)].standable && !hatches.some((h) => x === h.x && z >= h.z - 1 && z <= h.z + h.n);
  const holds = [];
  const hy = decks[0] + 1;
  const mainZ = masts.length > 1 ? masts[1].z : masts[0].z;
  if (free(cx - 1, hy, mainZ)) set(cx - 1, hy, mainZ, B.ship_pump);
  const pump = { x: cx - 1, y: hy, z: mainZ };
  let n = 0;
  const cargo = [B.barrel, B.crate, B.barrel, B.chest, B.crate, B.barrel];
  for (let z = 2; z < L - 2 && n < T.hold * 3; z++) {
    for (const x of [1, W - 2, 2, W - 3]) {
      if (!free(x, hy, z) || (x === pump.x && z === pump.z)) continue;
      if ((x + z) % 3 === 0) continue;
      const id = cargo[n % cargo.length];
      set(x, hy, z, id);
      holds.push({ x, y: hy, z, id });
      n++;
    }
  }
  const lanterns = [];
  for (let i = 1; i < decks.length; i++) {
    const y = decks[i - 1] + 1;
    if (y >= T.deck) break;
    for (let z = 3; z < L - 3; z += 6) {
      for (const x of [cx - 1, cx + 1]) {
        if (!free(x, y, z)) continue;
        set(x, y, z, B.lantern, META_STATE);
        lanterns.push({ x, y, z });
        break;
      }
    }
  }
  // Hammocks on the decks between: in the spaces between the guns.
  if (decks.length > 2) {
    const y = decks[decks.length - 2] + 1;
    for (let z = 2; z < L - 2; z += 2) {
      for (const x of [cx - 2, cx + 2]) if (free(x, y, z) && !guns.some((g) => g.z === z)) set(x, y, z, B.hammock, 0);
    }
  } else if (decks.length === 2) {
    for (let z = 3; z < L - 3; z += 3) if (free(cx + 1, hy, z) && get(cx + 1, hy, z) === 0) set(cx + 1, hy, z, B.hammock, 0);
  }
  for (const c of cabins) {
    const y = c.y;
    const spots = [];
    for (let z = c.z0; z <= c.z1; z++) for (let x = 1; x < W - 1; x++) if (free(x, y, z) && !(x === c.door.x && Math.abs(z - c.door.z) <= 1)) spots.push([x, z]);
    const put = (id, mt = 0) => {
      const s = spots.shift();
      if (s) set(s[0], y, s[1], id, mt);
      return s;
    };
    if (c.kind === 'galley') {
      put(B.furnace);
      put(B.barrel);
      put(B.crate);
      put(B.lantern, META_STATE);
    } else {
      // (The table in the middle of the cabin.)
      const mz = Math.round((c.z0 + c.z1) / 2);
      if (free(cx, y, mz)) set(cx, y, mz, B.table);
      if (free(cx - 1, y, mz)) set(cx - 1, y, mz, B.chair, 3);
      if (free(cx + 1, y, mz)) set(cx + 1, y, mz, B.chair, 1);
      const sp = spots.filter(([x, z]) => Math.abs(x - cx) > 1 || Math.abs(z - mz) > 0);
      spots.length = 0;
      spots.push(...sp);
      put(c.kind === 'great' ? B.bookshelf : B.bed);
      const ch = put(B.chest);
      if (ch) holds.push({ x: ch[0], y, z: ch[1], id: B.chest, captain: true });
      put(B.lantern, META_STATE);
    }
  }
  // On deck: the capstan before the mainmast, a lantern on her stern,
  // barrels lashed by the rail.
  const deckProps = [];
  {
    const z = mainZ + 2;
    if (free(cx, T.deck + 1, z) && !hatches.some((h) => Math.abs(h.z - z) <= h.n + 1)) {
      set(cx, T.deck + 1, z, B.capstan);
      deckProps.push({ x: cx, y: T.deck + 1, z, id: B.capstan });
    }
  }
  const sternLights = [];
  {
    const tt = topOf(T, 0) + 1;
    for (const x of [1, W - 2]) if (get(x, tt, 0) !== 0) sternLights.push({ x, y: tt + 1, z: 0 });
    if (T.W >= 9) sternLights.push({ x: cx, y: tt + 1, z: 0 });
  }
  // (Round 69) Every part of her decks to be got to, and away from: a
  // corner of a deck that can only be dropped into (railed round, too high
  // to climb out of) has the rail in its way opened, till there's none.
  const spawn = { x: cx, y: T.deck + 1, z: Math.round(L * 0.55) };
  while (get(spawn.x, spawn.y, spawn.z) !== 0 && spawn.z > 2) spawn.z--;
  connectDecks({ W, H, L, deckLevel }, vox, spawn);
  // Where she's walked on, and what's her: worked out for the ones who
  // use her (see shipLocal.js).
  const struct = new Uint8Array(N);
  let total = 0;
  for (let i = 0; i < N; i++) {
    const id = vox[i];
    if (id === B.hull_planks || id === B.deck_planks || id === B.ship_rail || id === B.copper_sheath || id === B.gunport || id === B.stern_window || id === B.gilt_trim || id === B.ship_mast) {
      struct[i] = 1;
      total++;
    }
  }
  // Her skin: hull cells next to the outside.
  const skin = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) {
    if (!inHull(x, y, z)) continue;
    if (!inHull(x - 1, y, z) || !inHull(x + 1, y, z) || !inHull(x, y, z - 1) || !inHull(x, y, z + 1) || !inHull(x, y - 1, z)) skin[idx(x, y, z)] = 1;
  }
  // Inside her: the cells within the hull at or under her deck level.
  const inside = new Uint8Array(N);
  for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) {
    const dl = deckLevel[z * W + x];
    for (let y = 0; y <= dl; y++) if (inHull(x, y, z)) inside[idx(x, y, z)] = 1;
  }
  // Her outline at the waterline (where she touches what she hits).
  const perim = [];
  for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) {
    const y = T.wl + 1;
    if (!inHull(x, y, z)) continue;
    if (!inHull(x - 1, y, z) || !inHull(x + 1, y, z) || !inHull(x, y, z - 1) || !inHull(x, y, z + 1)) perim.push({ x: x + 0.5, z: z + 0.5, cx: x, cz: z });
  }
  // (The bow's tip and the bowsprit's reach.)
  perim.push({ x: mid + 0.5, z: L + 0.3, cx: cx, cz: L - 1 });
  return {
    type, T, W, H, L, N, vox, meta, hull, skin, deckLevel, inside, struct, total, perim,
    // (The pivot she turns about: the middle of her plan.)
    px: W / 2, pz: L / 2,
    wl: T.wl, deck: T.deck, yBase: 5 - T.wl,
    masts, helm, guns, hatches, cabins, gangways, holds, lanterns, pump, deckProps, sternLights, spawn,
    bowsprit: { x: mid + 0.5, y: topOf(T, L - 1) + 1, z: L - 0.5, len: T.bowsprit },
    idx,
  };
}

// --- reading a ship's cells (her own copy: what's knocked out, mended) ----
export const vidx = (m, x, y, z) => (y * m.L + z) * m.W + x;
// (Round 69) Her decks joined up: from every place to stand on them, a way
// back to the middle of her main deck (`spawn`), stepping as anyone aboard
// does (see stepOn). Where there isn't one, the rail between that corner
// and a part that has a way is taken out (a gap in it), and again, till
// every corner has a way (or there's no rail left to open).
export function connectDecks(m, vox, spawn) {
  const { W, L, H } = m;
  const at = (x, y, z) => (y * L + z) * W + x;
  const cells = [];
  for (let z = 0; z < L; z++) for (let x = 0; x < W; x++) for (let y = 1; y <= H; y++) if (standOn(m, vox, x, y, z) && !isInside(m, x, y, z)) cells.push([x, y, z]);
  const reach = () => {
    const key = (x, y, z) => at(x, y, z);
    const ok = new Set();
    const s = cells.find((c) => c[0] === spawn.x && c[2] === spawn.z) || cells[0];
    if (!s) return ok;
    ok.add(key(...s));
    for (let changed = true; changed;) {
      changed = false;
      for (const [x, y, z] of cells) {
        const k = key(x, y, z);
        if (ok.has(k) || !standOn(m, vox, x, y, z)) continue;
        for (let dz = -1; dz <= 1 && !ok.has(k); dz++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          if (dx && dz && (stepOn(m, vox, x, y, z, x + dx, z) < 0 || stepOn(m, vox, x, y, z, x, z + dz) < 0)) continue;
          if (!onPlan(m, x + dx, z + dz)) continue;
          const ny = stepOn(m, vox, x, y, z, x + dx, z + dz);
          if (ny < 0 || isInside(m, x + dx, ny, z + dz)) continue;
          if (ok.has(key(x + dx, ny, z + dz))) {
            ok.add(k);
            changed = true;
            break;
          }
        }
      }
    }
    return ok;
  };
  for (let round = 0; round < 12; round++) {
    const ok = reach();
    const lost = cells.filter(([x, y, z]) => standOn(m, vox, x, y, z) && !ok.has(at(x, y, z)));
    if (!lost.length) return 0;
    let opened = 0;
    for (const [x, y, z] of lost) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (!onPlan(m, nx, nz)) continue;
        // (A rail in the way, at their feet or a step up: out.)
        for (const yy of [y, y + 1]) {
          if (vAt(m, vox, nx, yy, nz) !== B.ship_rail) continue;
          vox[at(nx, yy, nz)] = 0;
          opened++;
          break;
        }
        if (opened) break;
      }
      if (opened) break;
    }
    if (!opened) return lost.length;
  }
  return 0;
}

export function vAt(m, vox, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= m.W || y >= m.H || z >= m.L) return 0;
  return vox[(y * m.L + z) * m.W + x];
}

// Can someone stand with their feet in cell (x, y, z)? (Feet and head
// clear, something to stand on under them.)
export function standOn(m, vox, x, y, z) {
  if (x < 0 || z < 0 || x >= m.W || z >= m.L || y < 1 || y >= m.H + 2) return false;
  const f = vAt(m, vox, x, y, z);
  const h = vAt(m, vox, x, y + 1, z);
  if (f && BLOCKS[f].solid) return false;
  if (h && BLOCKS[h].solid) return false;
  const b = vAt(m, vox, x, y - 1, z);
  return !!b && BLOCKS[b].standable;
}

// From feet at (fx, fy, fz) into the column (x, z): where the feet end up
// (a step up, level, or a drop of up to two), or -1.
export function stepOn(m, vox, fx, fy, fz, x, z) {
  if (standOn(m, vox, x, fy, z)) return fy;
  const above = vAt(m, vox, fx, fy + 2, fz);
  if (standOn(m, vox, x, fy + 1, z) && !(above && BLOCKS[above].solid)) return fy + 1;
  for (const d of [1, 2, 3]) {
    if (standOn(m, vox, x, fy - d, z)) {
      // (Nothing in the way on the way down.)
      let clear = true;
      for (let y = fy - d + 1; y <= fy + 1; y++) {
        const id = vAt(m, vox, x, y, z);
        if (id && BLOCKS[id].solid) clear = false;
      }
      if (clear) return fy - d;
    }
  }
  return -1;
}

// Is (x, z) within her plan at all?
export function onPlan(m, x, z) {
  return x >= 0 && z >= 0 && x < m.W && z < m.L && m.deckLevel[z * m.W + x] >= 0;
}

// Feet at (x, y, z): inside her (below her deck), or out on deck?
export function isInside(m, x, y, z) {
  if (!onPlan(m, x, z)) return false;
  return y <= m.deckLevel[z * m.W + x];
}
