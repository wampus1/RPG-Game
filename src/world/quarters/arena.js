// (Round 146) The arena (see specialties.js): where gladiators fight for
// glory and the condemned for their freedom, and the crowd wagers on
// every bout (see sim/cities.js and game/cityplay.js).
//   A colosseum or an amphitheatre is a bowl: an oval (or, the high
// folk's, a rounded box) of stepped seats round a floor of raked sand,
// walled at the back (a colosseum's wall an arcade, its top crowned with
// braziers and banners), a barrier round the sand, the fighters' gates at
// either end and a way in through the seats beside each; the lord's box
// on one side under its canopy, awnings over the top seats. What's left of
// the lot round it holds its features: the beasts' cages, the cells of
// the condemned, the fighters' school, the champion in bronze, a shrine,
// a fountain, towers at the corners.
//   A village has a fighting pit: a square of red earth inside a rail,
// benches round it and a step of seats behind, awnings over them. The
// north keeps a ring of carved posts on the turf with banks of seats; the
// jade court a raised platform of lacquer under red pillars and lanterns,
// a gong at its head and a pavilion to watch from.
import { B } from '../blocks.js';
import { Y0, LIT } from './kit.js';

// Tiles of the lot outside what's built (`taken(x, z)`), off its edge and
// its ways in, nearest corner `c` (0..3: nw, ne, sw, se) first.
function corner(q, taken, c) {
  const cx = c % 2 ? q.x1 : q.x0;
  const cz = c >> 1 ? q.z1 : q.z0;
  const out = [];
  for (let z = q.z0 + 1; z < q.z1; z++) for (let x = q.x0 + 1; x < q.x1; x++) {
    if (taken(x, z) || q.atGate(x, z, 2, 3)) continue;
    // (Never right against what's built: a way round it.)
    let near = false;
    for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1; dx++) if (taken(x + dx, z + dz)) near = true;
    if (near) continue;
    out.push({ x, z, d: Math.abs(x - cx) + Math.abs(z - cz) });
  }
  return out.sort((a, b) => a.d - b.d);
}

// The features in the corners round a bowl (or a ring): what goes in
// which corner, as there's room.
function cornerFeatures(q, taken) {
  const used = new Set();
  const key = (x, z) => x * 65536 + z;
  const take = (x, z) => used.add(key(x, z));
  const free = (x, z) => !used.has(key(x, z)) && !taken(x, z);
  const spotsIn = (c, n) => corner(q, (x, z) => !free(x, z), c).slice(0, n);
  const order = q.rng.shuffle([0, 1, 2, 3]);
  let ci = 0;
  const nextCorner = () => order[ci++ % 4];
  // The champion: in bronze (a city's, if there's ground for it), else in
  // marble.
  if (q.has('statue')) {
    const c = nextCorner();
    const cand = corner(q, (x, z) => !free(x, z), c);
    const big = q.size === 'city' && cand.find((t) => [-1, 0, 1].every((dz) => [-1, 0, 1].every((dx) => free(t.x + dx, t.z + dz) && corner(q, (x, z) => !free(x, z), c).some((u) => u.x === t.x + dx && u.z === t.z + dz))));
    if (big) {
      q.piece(big.x, big.z, B.champion_bronze, 'champion');
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) take(big.x + dx, big.z + dz);
      q.spot(big.x, big.z + 2, 2, ['stroll', 'sketch', 'gossip']);
    } else if (cand[0]) {
      q.fx(cand[0].x, Y0, cand[0].z, 'champion', B.gladiator_statue, q.faceIn(cand[0].x, cand[0].z));
      q.ground(cand[0].x, cand[0].z, q.m.pave);
      take(cand[0].x, cand[0].z);
    }
  }
  // The beasts in their cages, side by side.
  if (q.has('cages')) {
    const c = nextCorner();
    for (const t of spotsIn(c, q.size === 'city' ? 3 : 2)) {
      q.fx(t.x, Y0, t.z, 'cage', B.beast_cage, q.faceIn(t.x, t.z));
      take(t.x, t.z);
    }
  }
  // The fighters' school: dummies to hit, a rack of arms, a butt.
  if (q.has('school')) {
    const c = nextCorner();
    const ts = spotsIn(c, 4);
    ts.forEach((t, k) => {
      take(t.x, t.z);
      if (k === 0) q.fx(t.x, Y0, t.z, 'rack', B.weapon_rack);
      else if (k === 3 && q.fam !== 'jade') q.fx(t.x, Y0, t.z, 'butt', B.target_butt, q.faceIn(t.x, t.z));
      else {
        q.put(t.x, Y0, t.z, q.fam === 'jade' ? B.wooden_dummy : B.training_dummy);
        q.role('gladiator', t.x + (t.x < q.cx ? 1 : -1), t.z, t.x < q.cx ? 1 : 3, ['train']);
      }
    });
  }
  // The cells of the condemned: bars, straw, the one who waits there.
  if (q.has('cells')) {
    const c = nextCorner();
    const ts = spotsIn(c, 3);
    ts.forEach((t, k) => {
      take(t.x, t.z);
      if (k < 2) {
        q.put(t.x, Y0, t.z, B.iron_bars);
        q.put(t.x, Y0 + 1, t.z, B.iron_bars);
      } else {
        q.ground(t.x, t.z, B.hay_bale);
        q.fx(t.x, Y0, t.z, 'cells');
        q.spot(t.x, t.z, 0, ['cell'], {});
      }
    });
  }
  // A shrine to whoever watches over fighters.
  if (q.has('shrine')) {
    const c = nextCorner();
    const t = spotsIn(c, 1)[0];
    if (t) {
      take(t.x, t.z);
      q.put(t.x, Y0, t.z, B.altar);
      q.spot(t.x, t.z + (t.z < q.cz ? 1 : -1), t.z < q.cz ? 2 : 0, ['pray']);
    }
  }
  if (q.has('fountain')) {
    const c = nextCorner();
    const t = spotsIn(c, 1)[0];
    if (t) {
      take(t.x, t.z);
      q.put(t.x, Y0, t.z, B.fountain);
      q.L.wells?.push(q.pt(t.x, t.z + 1));
    }
  }
  // Lamps along the walks.
  for (const c of [0, 1, 2, 3]) {
    const t = spotsIn(c, 1)[0];
    if (t && !(q.has('towers'))) {
      take(t.x, t.z);
      q.lamp(t.x, t.z, 1);
    }
  }
  return used;
}

// The board of bouts and the sign, by the main way in; the master of the
// games and the bookmaker there.
function front(q, taken) {
  const g = q.gates[0];
  const inX = g.side === 'w' ? 1 : g.side === 'e' ? -1 : 0;
  const inZ = g.side === 'n' ? 1 : g.side === 's' ? -1 : 0;
  const sx = g.x + (inZ ? 2 : 0);
  const sz = g.z + (inX ? 2 : 0);
  if (!taken(sx, sz)) {
    q.sign(sx, sz, inZ > 0 ? 0 : inZ < 0 ? 2 : inX > 0 ? 3 : 1);
  }
  const bx = g.x - (inZ ? 2 : 0) + inX;
  const bz = g.z - (inX ? 2 : 0) + inZ;
  if (!taken(bx, bz)) {
    q.fx(bx, Y0, bz, 'board', B.bout_board);
    q.role('bookie', bx + (inZ ? 1 : 0) + inX, bz + (inX ? 1 : 0) + inZ, (q.faceIn(bx, bz) + 2) & 3, ['market']);
  }
  q.role('lanista', g.x + inX * 2, g.z + inZ * 2, (inZ > 0 ? 2 : inZ < 0 ? 0 : inX > 0 ? 1 : 3));
}

// ------------------------------------------------------------ the bowl
function bowl(q) {
  const box = q.fam === 'high';
  const city = q.size === 'city';
  const T = city || q.W >= 21 ? 3 : 2;
  const cx = q.x0 + (q.W - 1) / 2;
  const cz = q.z0 + (q.D - 1) / 2;
  // (A box fills its lot to the corners: kept in from its edges, for
  // room round it.)
  const inset = box ? 3 : 0;
  const rx = (q.W - 1) / 2 - inset;
  const rz = (q.D - 1) / 2 - inset;
  const long = q.W >= q.D ? 'x' : 'z';
  const icx = Math.round(cx);
  const icz = Math.round(cz);
  const m = q.m;
  // What it's built of, by whose it is.
  const fill = { classic: B.travertine, sun: B.adobe, ember: B.basalt_bricks, high: B.stone_bricks, north: B.planks_dark, mist: B.planks_bog, tide: B.planks_drift, wild: B.planks_birch }[q.fam] ?? B.stone_bricks;
  const outer = { classic: city ? B.travertine : B.marble, sun: B.adobe, ember: B.kiln_brick, high: B.stone_bricks }[q.fam] ?? m.wall;
  const stairs = m.stairs;
  const sand = q.has('grass') ? B.grass_lush : B.arena_sand;
  const ring = (x, z) => q.ringOf(x, z, cx, cz, rx, rz, box);
  const corridor = (x, z) => (long === 'x' ? Math.abs(z - icz) <= 1 : Math.abs(x - icx) <= 1);
  const taken = (x, z) => q.inLot(x, z) && ring(x, z) >= 0;
  const H = T + (city ? 2 : 1);
  // The lord's box: three seats wide, middle of a long side, at the top.
  const boxSide = long === 'x' ? { x: icx, z: q.z0 } : { x: q.x0, z: icz };
  const inBox = (x, z) => q.has('box') && ring(x, z) === 1 && (long === 'x' ? Math.abs(x - icx) <= 1 && z < icz : Math.abs(z - icz) <= 1 && x < icx);
  let pit = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 };
  for (let z = q.z0; z <= q.z1; z++) {
    for (let x = q.x0; x <= q.x1; x++) {
      const k = ring(x, z);
      if (k < 0) {
        q.ground(x, z, m.pave);
        continue;
      }
      // The way in at either end, through the seats to the gates.
      if (corridor(x, z) && k <= T + 1) {
        q.ground(x, z, m.pave);
        if (k === T + 1) {
          const mid = long === 'x' ? z === icz : x === icx;
          const rot = long === 'x' ? (x < icx ? 3 : 1) : z < icz ? 0 : 2;
          if (mid) q.fx(x, Y0, z, 'gate', B.arena_gate, rot);
          else q.stack(x, z, Y0, Y0 + 1, fill);
        } else if (k === 0) {
          // (The arch over the way in.)
          q.put(x, Y0 + 2, z, outer);
          if (H > 3) q.stack(x, z, Y0 + 3, Y0 + H - 1, outer);
        }
        continue;
      }
      if (k === 0) {
        // The outer wall: an arcade for a colosseum (alcoves every third
        // pace, dark under their arches), braziers and banners on top.
        q.ground(x, z, m.pave);
        const arch = city && (x + z) % 3 === 0;
        for (let y = Y0; y < Y0 + H; y++) q.put(x, y, z, arch && y < Y0 + 2 ? B.air : arch && y === Y0 + 2 ? m.trim : outer);
        if (arch) q.put(x, Y0, z, B.air);
        if ((x * 7 + z * 3) % 11 === 0) q.brazier(x, z, Y0 + H);
        continue;
      }
      if (k <= T) {
        const j = T - k + 1;
        q.ground(x, z, fill);
        if (inBox(x, z)) {
          // The box: a floor at the top, chairs, the canopy over them.
          q.stack(x, z, Y0, Y0 + j - 1, fill);
          const face = q.faceIn(x, z);
          q.put(x, Y0 + j, z, B.chair, face);
          q.seatOnly(x, Y0 + j, z, face, { box: true });
          q.spot(x, z, face, ['social', 'noble'], { y: Y0 + j });
          q.canopy(x, z, Y0 + j + 2, face, 0);
          continue;
        }
        // (Every seat's a seat, but only every other one's kept for the
        // crowd to find, so they don't stand shoulder to shoulder.)
        q.tier(x, z, j, cx, cz, fill, stairs, (x + z) % 2 === 0);
        // The awning over the top rows on the shaded side, striped, in
        // one long run.
        if (j >= T - 1 && (q.has('awnings') || (city && q.fam === 'classic')) && z < icz - 1) {
          const ang = Math.atan2(z - cz, x - cx);
          q.canopy(x, z, Y0 + T + 2, q.faceIn(x, z), Math.floor(ang * 4 + 16) % 2 ? q.m.cloth : (q.m.cloth + 2) & 3);
        }
        continue;
      }
      if (k === T + 1) {
        // The barrier round the sand; a banner on it here and there.
        q.ground(x, z, fill);
        q.put(x, Y0, z, m.trim);
        if (city && !corridor(x, z)) {
          const k8 = Math.atan2((z - cz) / rz, (x - cx) / rx) / (Math.PI / 4);
          if (Math.abs(k8 - Math.round(k8)) < 0.05 && Math.round(k8) % 2 !== 0) q.put(x, Y0 + 1, z, B.war_banner);
        }
        continue;
      }
      // The sand.
      q.ground(x, z, sand);
      pit = { x0: Math.min(pit.x0, x), z0: Math.min(pit.z0, z), x1: Math.max(pit.x1, x), z1: Math.max(pit.z1, z) };
    }
  }
  // Banners at the ends, over the gates.
  const ends = long === 'x' ? [[q.x0, icz], [q.x1, icz]] : [[icx, q.z0], [icx, q.z1]];
  for (const [x, z] of ends) q.put(x, Y0 + H, z, B.war_banner);
  if (q.has('box')) q.put(boxSide.x, Y0 + T + 3, boxSide.z + (long === 'x' ? 1 : 0), B.war_banner);
  // The pit: where the fighters stand, where they train between bouts.
  const pcx = Math.round((pit.x0 + pit.x1) / 2);
  const pcz = Math.round((pit.z0 + pit.z1) / 2);
  const ga = long === 'x' ? { x: pit.x0, z: icz } : { x: icx, z: pit.z0 };
  const gb = long === 'x' ? { x: pit.x1, z: icz } : { x: icx, z: pit.z1 };
  q.out.pit = { ...q.area(pit), cx: q.pt(pcx, pcz).x, cz: q.pt(pcx, pcz).z, a: q.pt(ga.x, ga.z), b: q.pt(gb.x, gb.z), floor: Y0 };
  const dz = long === 'x' ? 0 : 2;
  const dx = long === 'x' ? 2 : 0;
  q.role('gladiator', pcx - dx, pcz - dz, long === 'x' ? 3 : 0, ['train']);
  q.role('gladiator', pcx + dx, pcz + dz, long === 'x' ? 1 : 2, ['train']);
  if (!q.has('school')) {
    q.put(pcx - dx * 2, Y0, pcz - dz * 2, B.training_dummy);
    q.put(pcx + dx * 2, Y0, pcz + dz * 2, B.training_dummy);
  }
  q.role('gladiator', pcx, pcz, 0, ['train']);
  // Corner towers.
  if (q.has('towers')) {
    for (const [x, z] of [[q.x0 + 1, q.z0 + 1], [q.x1 - 1, q.z0 + 1], [q.x0 + 1, q.z1 - 1], [q.x1 - 1, q.z1 - 1]]) {
      if (taken(x, z) || q.atGate(x, z, 2, 3)) continue;
      q.stack(x, z, Y0, Y0 + H + 1, outer);
      q.brazier(x, z, Y0 + H + 2);
    }
  }
  cornerFeatures(q, (x, z) => taken(x, z) || (q.has('towers') && (x === q.x0 + 1 || x === q.x1 - 1) && (z === q.z0 + 1 || z === q.z1 - 1)));
  front(q, taken);
}

// ------------------------------------------------------------ the pit
function pit(q) {
  const m = q.m;
  const x0 = q.x0 + 3;
  const z0 = q.z0 + 3;
  const x1 = q.x1 - 3;
  const z1 = q.z1 - 3;
  const earth = q.fam === 'sun' || q.fam === 'ember' ? B.arena_sand : q.has('grass') ? B.grass_lush : B.arena_sand;
  const midX = Math.round((x0 + x1) / 2);
  const midZ = Math.round((z0 + z1) / 2);
  q.fill(q.x0, q.z0, q.x1, q.z1, B.gravel);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) q.ground(x, z, earth);
  // The rail round it, a gap at each end for the fighters.
  for (let x = x0 - 1; x <= x1 + 1; x++) for (const z of [z0 - 1, z1 + 1]) q.put(x, Y0, z, B.fence);
  for (let z = z0; z <= z1; z++) for (const x of [x0 - 1, x1 + 1]) if (Math.abs(z - midZ) > 0) q.put(x, Y0, z, B.fence);
  // Benches round it, facing in; behind them a step of seats.
  for (let x = x0; x <= x1; x++) {
    for (const [z, face] of [[z0 - 2, 0], [z1 + 2, 2]]) {
      if (q.atGate(x, z, 1, 3)) continue;
      q.put(x, Y0, z, B.bench, face);
      if ((x - x0) % 2 === 0) q.seat(x, z, face);
      if (q.has('awnings') && (x - x0) % 2 === 0) q.canopy(x, z, Y0 + 2, face, m.cloth);
    }
  }
  for (let z = z0; z <= z1; z++) {
    for (const [x, face] of [[x0 - 2, 3], [x1 + 2, 1]]) {
      if (q.atGate(x, z, 1, 3) || Math.abs(z - midZ) <= 0) continue;
      q.tier(x, z, 1, midX, midZ, B.planks, B.planks_stairs, (z - z0) % 2 === 0);
    }
  }
  q.out.pit = { ...q.area({ x0, z0, x1, z1 }), cx: q.pt(midX, midZ).x, cz: q.pt(midX, midZ).z, a: q.pt(x0, midZ), b: q.pt(x1, midZ), floor: Y0 };
  q.role('gladiator', midX - 1, midZ, 3, ['train']);
  q.role('gladiator', midX + 1, midZ, 1, ['train']);
  // The gate the fighters come through, and the board.
  q.fx(x0 - 1, Y0, midZ, 'gate', B.arena_gate, 3);
  const taken = (x, z) => x >= x0 - 2 && x <= x1 + 2 && z >= z0 - 2 && z <= z1 + 2;
  cornerFeatures(q, taken);
  front(q, taken);
}

// ------------------------------------------------------------ the north's ring
function holmgang(q) {
  const m = q.m;
  const x0 = q.x0 + 4;
  const z0 = q.z0 + 4;
  const x1 = q.x1 - 4;
  const z1 = q.z1 - 4;
  const midX = Math.round((x0 + x1) / 2);
  const midZ = Math.round((z0 + z1) / 2);
  q.fill(q.x0, q.z0, q.x1, q.z1, B.grass);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) q.ground(x, z, q.has('grass') ? B.grass_lush : B.arena_sand);
  // The posts round it, carved, the rope (a rail) between.
  for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) {
    const edge = x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1;
    if (!edge) continue;
    if (z === midZ && (x === x0 - 1 || x === x1 + 1)) continue;
    const post = (x - x0 + 1) % 3 === 0 && (z === z0 - 1 || z === z1 + 1) || (z - z0 + 1) % 3 === 0 && (x === x0 - 1 || x === x1 + 1);
    q.put(x, Y0, z, post ? B.holmgang_post : B.fence);
  }
  // Banks of turf seats on all sides, two high, logs to sit on.
  for (let z = q.z0 + 1; z <= q.z1 - 1; z++) for (let x = q.x0 + 1; x <= q.x1 - 1; x++) {
    const d = Math.min(x - (q.x0 + 1), (q.x1 - 1) - x, z - (q.z0 + 1), (q.z1 - 1) - z);
    if (d > 1 || q.atGate(x, z, 1, 4)) continue;
    if (Math.abs(z - midZ) <= 1 && (x < x0 || x > x1)) continue;
    q.tier(x, z, 2 - d, midX, midZ, B.dirt, m.stairs, (x + z) % 2 === 0);
  }
  for (const [x, z] of [[q.x0, q.z0], [q.x1, q.z0], [q.x0, q.z1], [q.x1, q.z1]]) q.brazier(x, z);
  q.put(midX, Y0, q.z0 + 3, B.war_banner);
  q.out.pit = { ...q.area({ x0, z0, x1, z1 }), cx: q.pt(midX, midZ).x, cz: q.pt(midX, midZ).z, a: q.pt(x0, midZ), b: q.pt(x1, midZ), floor: Y0 };
  q.role('gladiator', midX - 1, midZ, 3, ['train']);
  q.role('gladiator', midX + 1, midZ, 1, ['train']);
  q.fx(x0 - 1, Y0, midZ, 'gate', B.arena_gate, 3);
  if (q.has('cages')) q.fx(q.x1 - 1, Y0, midZ + 1, 'cage', B.beast_cage, 1);
  q.fx(q.x1 - 1, Y0, midZ - 1, 'rack', B.weapon_rack);
  q.put(q.x0 + 1, Y0, midZ - 1, B.mead_bench);
  const taken = (x, z) => x >= q.x0 + 1 && x <= q.x1 - 1 && z >= q.z0 + 1 && z <= q.z1 - 1;
  front(q, taken);
}

// ------------------------------------------------------------ the jade court
function court(q) {
  const m = q.m;
  const x0 = q.x0 + 4;
  const z0 = q.z0 + 4;
  const x1 = q.x1 - 4;
  const z1 = q.z1 - 4;
  const midX = Math.round((x0 + x1) / 2);
  const midZ = Math.round((z0 + z1) / 2);
  q.fill(q.x0, q.z0, q.x1, q.z1, B.flagstone);
  // The platform: a pace up, of lacquer, steps up at either end.
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    q.put(x, Y0, z, B.planks_lacquer);
    if ((x === x0 || x === x1) && (z === z0 || z === z1)) {
      q.stack(x, z, Y0 + 1, Y0 + 3, B.planks_lacquer);
      q.put(x, Y0 + 4, z, B.lantern, LIT);
    }
  }
  q.put(x0 - 1, Y0, midZ, B.planks_lacquer_stairs, 1);
  q.put(x1 + 1, Y0, midZ, B.planks_lacquer_stairs, 3);
  // The gong at its head; incense either side.
  q.put(midX, Y0, z0 - 2, B.gong);
  q.put(midX - 2, Y0, z0 - 2, B.incense);
  q.put(midX + 2, Y0, z0 - 2, B.incense);
  // Seats on two sides, stepping up; the pavilion across the far end.
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    for (const [z, j] of [[z1 + 2, 1], [z1 + 3, 2]]) if (!q.atGate(x, z, 1, 4) && z < q.z1) q.tier(x, z, j, midX, midZ, B.planks_lacquer, m.stairs, (x + j) % 2 === 0);
  }
  if (q.has('box')) {
    const r = { x0: midX - 3, z0: q.z0 + 1, x1: midX + 3, z1: q.z0 + 2 };
    for (let x = r.x0; x <= r.x1; x++) {
      q.put(x, Y0, r.z1, B.chair, 0);
      q.put(x, Y0 + 3, r.z0, B.roof_jade, 2);
      q.put(x, Y0 + 3, r.z1, B.roof_jade, 0);
      if (x === r.x0 || x === r.x1) for (const z of [r.z0, r.z1]) q.stack(x, z, Y0, Y0 + 2, B.planks_lacquer);
      q.seatOnly(x, Y0, r.z1, 0, { box: true });
    }
  }
  q.out.pit = { ...q.area({ x0, z0, x1, z1 }), cx: q.pt(midX, midZ).x, cz: q.pt(midX, midZ).z, a: q.pt(x0, midZ), b: q.pt(x1, midZ), floor: Y0 + 1 };
  q.role('gladiator', midX - 1, midZ, 3, ['train'], { y: Y0 + 1 });
  q.role('gladiator', midX + 1, midZ, 1, ['train'], { y: Y0 + 1 });
  q.fx(x0 - 2, Y0, midZ - 1, 'gate', B.arena_gate, 3);
  const taken = (x, z) => x >= x0 - 2 && x <= x1 + 2 && z >= z0 - 2 && z <= q.z1;
  cornerFeatures(q, taken);
  front(q, taken);
}

export const ARENA = {
  arena(q) {
    if (q.spec.form === 'pit') pit(q);
    else if (q.fam === 'north') holmgang(q);
    else if (q.fam === 'jade') court(q);
    else bowl(q);
  },
};
