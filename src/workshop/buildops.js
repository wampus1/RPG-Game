// The Builder's building (round 62): walls, floors, rooms, roofs, doors,
// windows, stairs of blocks, pillars, and whole buildings to start from,
// all on a grid: { w, d, h, ground, get(x, y, z) -> [ref, meta] | null,
// set(x, y, z, ref, meta) } (ref null: leave the ground as it is).
// The same steps the game's own towns are built with (see
// world/settlement.js): walls with corner posts, glass every other block,
// a door of two halves, roofs that step up to a ridge, gable ends walled.

// Door turns by the side of the building it's in (as the game's towns).
const DOOR_ROT = { front: 2, back: 0, right: 1, left: 3 };

export function inside(g, x, y, z) {
  return x >= 0 && z >= 0 && y >= 0 && x < g.w && z < g.d && y < g.h;
}
const put = (g, x, y, z, ref, meta = 0) => {
  if (inside(g, x, y, z)) g.set(x, y, z, ref, meta);
};
export const norm = (a, b) => [Math.min(a, b), Math.max(a, b)];

// A floor (or any flat rectangle) of one block; `outline`: its edge only.
export function rect(g, x0, z0, x1, z1, y, ref, meta = 0, outline = false) {
  [x0, x1] = norm(x0, x1);
  [z0, z1] = norm(z0, z1);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (outline && x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
    put(g, x, y, z, ref, meta);
  }
}

// A line of blocks (Bresenham, on one layer).
export function line(g, x0, z0, x1, z1, y, ref, meta = 0) {
  const dx = Math.abs(x1 - x0);
  const dz = -Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let e = dx + dz;
  for (let n = 0; n < 400; n++) {
    put(g, x0, y, z0, ref, meta);
    if (x0 === x1 && z0 === z1) break;
    const e2 = 2 * e;
    if (e2 >= dz) {
      e += dz;
      x0 += sx;
    }
    if (e2 <= dx) {
      e += dx;
      z0 += sz;
    }
  }
}

// An ellipse on one layer (filled or not).
export function ellipse(g, x0, z0, x1, z1, y, ref, meta = 0, filled = true) {
  [x0, x1] = norm(x0, x1);
  [z0, z1] = norm(z0, z1);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const rx = (x1 - x0) / 2 + 0.5;
  const rz = (z1 - z0) / 2 + 0.5;
  const isIn = (x, z) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 <= 1;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (!isIn(x, z)) continue;
    if (!filled && isIn(x - 1, z) && isIn(x + 1, z) && isIn(x, z - 1) && isIn(x, z + 1)) continue;
    put(g, x, y, z, ref, meta);
  }
}

// A column of blocks.
export function pillar(g, x, z, y, H, ref, meta = 0) {
  for (let k = 0; k < H; k++) put(g, x, y + k, z, ref, meta);
}

// A door of two halves at (x, y, z), facing out of the `side` given.
export function door(g, x, y, z, side = 'front', ref = 'door') {
  const rot = DOOR_ROT[side] ?? 2;
  const top = ref === 'door' ? 'door_top' : ref === 'cell_door' ? 'cell_door_top' : null;
  put(g, x, y, z, ref, rot);
  if (top) put(g, x, y + 1, z, top, rot);
  else put(g, x, y + 1, z, 'air');
}

// Where a door goes in the walls of a rectangle: the middle of a side.
export function doorSpot(x0, z0, x1, z1, side) {
  const mx = Math.floor((x0 + x1) / 2);
  const mz = Math.floor((z0 + z1) / 2);
  return { front: [mx, z1], back: [mx, z0], left: [x0, mz], right: [x1, mz] }[side] || [mx, z1];
}

// Walls round a rectangle, H high from layer y: corner posts of their own
// block (if given), windows every other block along the second row, and
// a door in the middle of a side (two halves).
export function walls(g, x0, z0, x1, z1, y, H, o = {}) {
  [x0, x1] = norm(x0, x1);
  [z0, z1] = norm(z0, z1);
  const wall = o.wall || 'planks';
  const corner = o.corner || wall;
  const dr = o.door && o.door !== 'none' ? doorSpot(x0, z0, x1, z1, o.door) : null;
  const near = (x, z) => dr && Math.abs(x - dr[0]) + Math.abs(z - dr[1]) === 1;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
    const isCorner = (x === x0 || x === x1) && (z === z0 || z === z1);
    for (let k = 0; k < H; k++) {
      let ref = isCorner ? corner : wall;
      const along = z === z0 || z === z1 ? x - x0 : z - z0;
      if (o.windows && !isCorner && k === 1 && H >= 3 && along % 2 === 0 && !near(x, z) && !(dr && x === dr[0] && z === dr[1])) ref = o.glass || 'glass';
      put(g, x, y + k, z, ref);
    }
    // (Inside: cleared, so the hill it's set in doesn't fill it.)
  }
  if (o.hollow !== false) for (let z = z0 + 1; z < z1; z++) for (let x = x0 + 1; x < x1; x++) for (let k = 0; k < H; k++) {
    const c = g.get(x, y + k, z);
    if (!c || c[0] === 'keep') put(g, x, y + k, z, 'air');
  }
  if (dr) door(g, dr[0], y, dr[1], o.door, o.doorBlock || 'door');
}

// A roof over a rectangle from layer y: 'gable' (its ridge along the
// longer side, stepping up from both eaves; the ends walled up), 'hip'
// (stepping in on all four sides), 'flat' (one layer, a low wall about it
// if `parapet`), 'shed' (one slope, high at the back).
export function roof(g, x0, z0, x1, z1, y, o = {}) {
  [x0, x1] = norm(x0, x1);
  [z0, z1] = norm(z0, z1);
  const ref = o.roof || 'roof_red';
  const end = o.gableWall || o.wall || 'planks';
  const style = o.style || 'gable';
  if (style === 'flat') {
    rect(g, x0, z0, x1, z1, y, ref);
    if (o.parapet) rect(g, x0, z0, x1, z1, y + 1, o.wall || end, 0, true);
    return y + (o.parapet ? 2 : 1);
  }
  if (style === 'shed') {
    const n = z1 - z0 + 1;
    for (let k = 0; k < n; k++) {
      const z = z1 - k;
      const yy = y + Math.floor(k / 2);
      for (let x = x0; x <= x1; x++) put(g, x, yy, z, ref, 0);
      for (const x of [x0, x1]) for (let q = y; q < yy; q++) put(g, x, q, z, end);
    }
    return y + Math.ceil(n / 2);
  }
  if (style === 'hip') {
    let k = 0;
    for (; x0 + k <= x1 - k && z0 + k <= z1 - k; k++) {
      const ax = x0 + k;
      const bx = x1 - k;
      const az = z0 + k;
      const bz = z1 - k;
      for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) {
        if (x !== ax && x !== bx && z !== az && z !== bz) continue;
        const rot = az === bz ? 1 : z === az ? 2 : z === bz ? 0 : 1;
        put(g, x, y + k, z, ref, rot);
      }
    }
    return y + k;
  }
  // A gable: the ridge runs along the longer side.
  const alongX = o.ridge ? o.ridge === 'x' : x1 - x0 >= z1 - z0;
  if (alongX) {
    const layers = Math.ceil((z1 - z0 + 1) / 2);
    for (let k = 0; k < layers; k++) {
      const zs = z0 + k;
      const ze = z1 - k;
      for (let x = x0; x <= x1; x++) for (const z of zs === ze ? [zs] : [zs, ze]) put(g, x, y + k, z, ref, zs === ze ? 1 : z === zs ? 2 : 0);
      for (const x of [x0, x1]) for (let z = zs + 1; z <= ze - 1; z++) put(g, x, y + k, z, end);
    }
    return y + layers;
  }
  const layers = Math.ceil((x1 - x0 + 1) / 2);
  for (let k = 0; k < layers; k++) {
    const xs = x0 + k;
    const xe = x1 - k;
    for (let z = z0; z <= z1; z++) for (const x of xs === xe ? [xs] : [xs, xe]) put(g, x, y + k, z, ref, xs === xe ? 0 : x === xs ? 3 : 1);
    for (const z of [z0, z1]) for (let x = xs + 1; x <= xe - 1; x++) put(g, x, y + k, z, end);
  }
  return y + layers;
}

// A whole room: a floor, walls, a door and windows, and a roof on top.
// o: { floor, wall, corner, roof, style, height, door, windows, glass }.
export function room(g, x0, z0, x1, z1, y, o = {}) {
  [x0, x1] = norm(x0, x1);
  [z0, z1] = norm(z0, z1);
  const H = Math.max(1, o.height || 3);
  if (o.floor) rect(g, x0, z0, x1, z1, y, o.floor);
  walls(g, x0, z0, x1, z1, y + 1, H, { wall: o.wall, corner: o.corner, door: o.door ?? 'front', windows: o.windows ?? true, glass: o.glass });
  if (o.style !== 'none') roof(g, x0, z0, x1, z1, y + 1 + H, { roof: o.roof, style: o.style || 'gable', wall: o.wall, gableWall: o.wall, parapet: o.parapet });
}

// Stairs of blocks climbing from (x0, z0) toward (x1, z1), a step a
// block, `wide` across.
export function steps(g, x0, z0, x1, z1, y, ref, wide = 1) {
  const dx = Math.sign(x1 - x0);
  const dz = Math.sign(z1 - z0);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) + 1;
  for (let k = 0; k < n && y + k < g.h; k++) {
    const x = x0 + dx * k;
    const z = z0 + dz * k;
    for (let q = 0; q < wide; q++) {
      const ax = dz ? x + q : x;
      const az = dx ? z + q : z;
      for (let s = 0; s <= k; s++) put(g, ax, y + s, az, ref);
    }
  }
}

// Fill the touching cells of one kind on a layer (as a paint bucket),
// within bounds, with `ref`.
export function flood(g, x, y, z, ref, meta = 0, limit = 20000) {
  const k0 = g.get(x, y, z);
  const same = (c) => (!c && !k0) || (c && k0 && c[0] === k0[0]);
  if (k0 && k0[0] === ref) return 0;
  const seen = new Set();
  const stack = [[x, z]];
  let n = 0;
  while (stack.length && n < limit) {
    const [cx, cz] = stack.pop();
    const k = cz * 4096 + cx;
    if (seen.has(k) || cx < 0 || cz < 0 || cx >= g.w || cz >= g.d) continue;
    seen.add(k);
    if (!same(g.get(cx, y, cz))) continue;
    g.set(cx, y, cz, ref, meta);
    n++;
    stack.push([cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]);
  }
  return n;
}

// ------------------------------------------------------------ to start from
// Whole buildings: what a new structure can begin as. Each returns its
// size and fills a grid of it; `marks` added as it says.
export const PRESETS = [
  { id: 'empty', name: 'An empty plot', icon: 'grid', blurb: 'Nothing yet: a patch of ground, 11 by 11, 8 high, to build on.', w: 11, d: 11, h: 8, ground: 1, build() {} },
  { id: 'cottage', name: 'Cottage', icon: 'house', blurb: 'A plank cottage with log corners, glass windows, a door and a red tiled roof. A bed, a table and a chest inside.', w: 9, d: 7, h: 9, ground: 1, build(g, mk) {
    room(g, 1, 1, 7, 5, 1, { floor: 'planks', wall: 'planks', corner: 'log_oak', roof: 'roof_red', height: 3, door: 'front', windows: true });
    put(g, 2, 2, 2, 'bed', 1);
    put(g, 5, 2, 2, 'table');
    put(g, 6, 2, 2, 'chair', 3);
    put(g, 6, 2, 4, 'chest', 2);
    put(g, 2, 2, 4, 'torch');
    mk({ type: 'chest', x: 6, y: 2, z: 4, loot: null });
  } },
  { id: 'tower', name: 'Watchtower', icon: 'flag', blurb: 'A tall stone tower, a ladder of floors inside, a lookout of battlements on top.', w: 7, d: 7, h: 14, ground: 1, build(g) {
    rect(g, 1, 1, 5, 5, 1, 'cobblestone');
    walls(g, 1, 1, 5, 5, 2, 9, { wall: 'stone_bricks', corner: 'stone_bricks', door: 'front', windows: false });
    for (const y of [5, 8]) rect(g, 2, 2, 4, 4, y, 'planks');
    for (const y of [4, 7]) put(g, 3, y, 3, 'glass');
    rect(g, 1, 1, 5, 5, 11, 'stone_bricks');
    for (let z = 1; z <= 5; z++) for (let x = 1; x <= 5; x++) if ((x === 1 || x === 5 || z === 1 || z === 5) && (x + z) % 2 === 0) put(g, x, 12, z, 'stone_bricks');
    put(g, 3, 12, 3, 'torch');
    put(g, 2, 6, 2, 'torch');
    steps(g, 2, 4, 4, 4, 2, 'planks');
  } },
  { id: 'ruin', name: 'Ruin', icon: 'skull', blurb: 'The broken walls of something old, roofless, overgrown, with a chest left in the rubble.', w: 11, d: 9, h: 7, ground: 1, build(g, mk) {
    rect(g, 1, 1, 9, 7, 1, 'cobblestone');
    walls(g, 1, 1, 9, 7, 2, 3, { wall: 'mossy_cobblestone', corner: 'stone_bricks', door: 'front', windows: false });
    // (Fallen in, here and there.)
    for (const [x, y, z] of [[3, 4, 1], [4, 4, 1], [4, 3, 1], [9, 4, 3], [9, 4, 4], [9, 3, 4], [6, 4, 7], [7, 4, 7], [1, 4, 5], [1, 3, 5], [1, 4, 6]]) put(g, x, y, z, 'air');
    for (const [x, z] of [[3, 3], [7, 5], [5, 2]]) put(g, x, 2, z, 'tall_grass');
    put(g, 6, 2, 3, 'rubble');
    put(g, 8, 2, 2, 'chest', 2);
    mk({ type: 'chest', x: 8, y: 2, z: 2, loot: null });
  } },
  { id: 'stall', name: 'Market stall', icon: 'chest', blurb: 'A counter under a striped canopy, barrels and crates about it, for a trader.', w: 7, d: 5, h: 6, ground: 1, build(g, mk) {
    for (let x = 1; x <= 5; x++) put(g, x, 2, 2, 'counter', 2);
    for (const x of [1, 5]) pillar(g, x, 1, 2, 2, 'log_oak');
    for (let x = 1; x <= 5; x++) for (const z of [1, 2]) put(g, x, 4, z, 'awning_red');
    put(g, 0, 2, 3, 'barrel');
    put(g, 6, 2, 3, 'crate');
    put(g, 6, 2, 1, 'barrel');
    mk({ type: 'npc', x: 3, y: 2, z: 1, creature: null });
  } },
  { id: 'camp', name: 'Camp', icon: 'sun', blurb: 'Tents round a fire, logs to sit on, a chest of what they\'ve taken. Somebody lives here.', w: 13, d: 11, h: 6, ground: 1, build(g, mk) {
    put(g, 6, 2, 5, 'campfire');
    for (const [x, z, r] of [[3, 2, 0], [9, 2, 0], [3, 8, 2]]) put(g, x, 2, z, 'tent', r);
    for (const [x, z] of [[5, 5], [7, 5], [6, 7]]) put(g, x, 2, z, 'bench', 0);
    put(g, 10, 2, 8, 'chest', 2);
    put(g, 9, 2, 8, 'crate');
    mk({ type: 'chest', x: 10, y: 2, z: 8, loot: null });
    mk({ type: 'spawn', x: 6, y: 2, z: 4, creature: 'bandit', count: 3, respawn: true, respawnMins: 600 });
  } },
  { id: 'shrine', name: 'Shrine', icon: 'star', blurb: 'A little open shrine of marble pillars about a brazier. Step in and something happens (a trigger, to set).', w: 9, d: 9, h: 7, ground: 1, build(g, mk) {
    rect(g, 1, 1, 7, 7, 1, 'marble');
    rect(g, 2, 2, 6, 6, 1, 'flagstone');
    for (const [x, z] of [[1, 1], [7, 1], [1, 7], [7, 7]]) pillar(g, x, z, 2, 3, 'marble');
    rect(g, 1, 1, 7, 7, 5, 'marble', 0, true);
    put(g, 4, 2, 4, 'brazier', 4);
    mk({ type: 'trigger', x: 4, y: 2, z: 4, r: 3, once: true, message: 'The flame in the brazier leans toward you.' });
  } },
  { id: 'entrance', name: 'Dungeon way in', icon: 'stairs', blurb: 'A crumbling stone mouth in the ground: the way down into a dungeon of your own.', w: 7, d: 7, h: 6, ground: 1, build(g, mk) {
    rect(g, 1, 1, 5, 5, 1, 'stone_bricks');
    for (const [x, z] of [[1, 1], [5, 1], [1, 5], [5, 5]]) pillar(g, x, z, 2, 2, 'mossy_cobblestone');
    put(g, 2, 2, 1, 'mossy_cobblestone');
    put(g, 4, 2, 5, 'cobblestone');
    put(g, 3, 1, 3, 'air');
    mk({ type: 'entry', x: 3, y: 1, z: 3 });
  } },
  { id: 'floor', name: 'Dungeon floor', icon: 'skull', blurb: 'A floor below: halls of stone with a way up, a way down, foes about and a chest. The last floor\'s boss marker is where the master waits.', w: 21, d: 15, h: 5, ground: 1, build(g, mk) {
    for (let z = 0; z < 15; z++) for (let x = 0; x < 21; x++) for (let y = 1; y < 5; y++) put(g, x, y, z, 'cave_rock');
    const hall = (ax, az, bx, bz) => {
      rect(g, ax, az, bx, bz, 1, 'stone_bricks');
      for (let y = 2; y <= 3; y++) rect(g, ax, az, bx, bz, y, 'air');
    };
    hall(1, 1, 7, 6);
    hall(13, 1, 19, 6);
    hall(6, 8, 14, 13);
    hall(7, 3, 13, 4);
    hall(9, 4, 10, 8);
    put(g, 2, 2, 2, 'torch');
    put(g, 18, 2, 2, 'torch');
    put(g, 7, 2, 12, 'torch');
    put(g, 13, 2, 12, 'chest', 2);
    mk({ type: 'up', x: 3, y: 2, z: 3, rot: 2 });
    mk({ type: 'down', x: 17, y: 2, z: 4 });
    mk({ type: 'spawn', x: 10, y: 2, z: 10, creature: 'skeleton', count: 2 });
    mk({ type: 'spawn', x: 16, y: 2, z: 3, creature: 'skeleton', count: 1 });
    mk({ type: 'chest', x: 13, y: 2, z: 12, loot: null });
    mk({ type: 'boss', x: 10, y: 2, z: 11, creature: null, r: 6 });
  } },
];
