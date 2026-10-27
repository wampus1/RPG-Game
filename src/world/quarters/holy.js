// (Round 146) The seats of faith (see specialties.js).
//   A holy seat: a cathedral in a city, an abbey in a town, a shrine in a
// village. The church: its nave long and tall under stained glass, rows
// of pews facing the altar, the shrine of its relic behind it, racks of
// candles down the walls, the font by the door; its bell tower; before it
// the court with its graves, its garden, its spring, its statues, the
// pilgrims' hostel. The jade court builds a temple behind a gate of red
// posts, its roof upswept; the sun peoples a stepped pyramid with the
// altar on its top; the north a stave church, dark and steep.
//   A stone circle: the old stones in a ring on the heath, the altar stone
// at its heart, the carved stones at its ways in, the fire, the grove,
// the seer's hut.
import { B } from '../blocks.js';
import { Y0, LIT } from './kit.js';

// The court before a church or temple: graves, garden, spring, statues,
// hostel, as it has them, on either side of the walk to the door.
function court(q, z0, mx) {
  const left = { x0: q.x0 + 1, x1: mx - 2 };
  const right = { x0: mx + 2, x1: q.x1 - 1 };
  const z1 = q.z1 - 1;
  if (z1 - z0 < 1) return;
  const sides = [left, right];
  let k = 0;
  const next = () => sides[k++ % 2];
  // The pilgrims' hostel: a low house of beds on one side of the court.
  if (q.has('hostel')) {
    const s = next();
    if (s.x1 - s.x0 >= 3 && z1 - z0 >= 2) {
      const door = s === left ? { x: s.x1, z: z0 + 1, rot: 3 } : { x: s.x0, z: z0 + 1, rot: 1 };
      const h = q.hall({ x0: s.x0, z0, x1: s.x1, z1 }, { doors: [door], h: 2, win: 'glass', use: 'hostel' });
      for (let x = h.ix0; x <= h.ix1; x++) if (x !== q.inside(door).x) q.put(x, Y0, h.iz0, B.bed, 0);
      q.fx(q.inside(door).x, Y0, q.inside(door).z, 'hostel');
    }
  }
  if (q.has('graves')) {
    const s = next();
    for (let z = z0; z <= z1; z += 2) for (let x = s.x0; x <= s.x1; x += 2) {
      q.ground(x, z, B.grass);
      q.put(x, Y0, z, B.gravestone);
    }
    q.spot(s.x0 + 1, z0, 2, ['mourn', 'pray', 'stroll']);
  }
  if (q.has('garden')) {
    const s = next();
    for (let z = z0; z <= z1; z++) for (let x = s.x0; x <= s.x1; x++) {
      q.ground(x, z, B.grass_lush);
      if ((x + z * 3) % 4 === 0) q.put(x, Y0, z, [B.flower_white, B.flower_yellow, B.herb, B.flower_purple][(x + z) % 4]);
    }
    q.put(Math.round((s.x0 + s.x1) / 2), Y0, z0, B.bench, 0);
    q.spot(Math.round((s.x0 + s.x1) / 2), z0, 0, ['rest', 'pray', 'read']);
  }
  if (q.has('spring')) {
    const s = sides[(k + 1) % 2];
    const x = Math.round((s.x0 + s.x1) / 2);
    q.fx(x, Y0, z1, 'spring', B.fountain);
    q.well(x, z1 - 1);
  }
  if (q.has('statues')) for (const x of [mx - 2, mx + 2]) q.put(x, Y0, q.z1 - 1, B.statue);
  for (const x of [mx - 1, mx + 1]) q.lamp(x, q.z1, 1);
}

// The church: nave, aisle, pews, altar, relic, candles, font; tower.
function church(q, o = {}) {
  const m = q.m;
  const grand = q.size === 'city';
  const north = q.fam === 'north';
  q.fill(q.x0, q.z0, q.x1, q.z1, m.pave);
  const courtD = grand ? 5 : 4;
  const r = { x0: q.x0 + 2, z0: q.z0 + 1, x1: q.x1 - 2, z1: q.z1 - courtD };
  const mx = Math.round((r.x0 + r.x1) / 2);
  const doors = [{ x: mx, z: r.z1, rot: 0 }];
  if (grand) doors.push({ x: r.x0 + 2, z: r.z1, rot: 0 }, { x: r.x1 - 2, z: r.z1, rot: 0 });
  const wall = north ? B.planks_dark : m.wall;
  const hall = q.hall(r, {
    doors, h: grand ? 5 : 4, win: north ? 'glass' : 'stained', wall, corner: north ? B.log_pine : m.corner, floor: north ? B.planks_dark : B.flagstone,
    roof: north ? B.roof_wood : m.roof, maxPitch: grand ? 6 : 5, use: 'church',
  });
  const { ix0, iz0, ix1, iz1 } = hall;
  // The altar, and the relic's shrine behind it (or a saint in stone).
  q.put(mx, Y0, iz0 + 2, B.altar);
  q.fx(mx, Y0, iz0 + 2, 'altar');
  if (q.has('relic')) q.fx(mx, Y0, iz0, 'relic', B.relic_shrine);
  else q.put(mx, Y0, iz0, B.statue);
  q.put(mx - 1, Y0, iz0 + 2, B.candles, LIT);
  q.put(mx + 1, Y0, iz0 + 2, B.candles, LIT);
  q.role('cleric', mx, iz0 + 1, 0, ['pray']);
  // The aisle, carpeted, and the pews either side of it facing the altar.
  for (let z = iz0 + 3; z <= iz1; z++) q.put(mx, Y0, z, B.rug_red);
  for (let z = iz0 + 4; z <= iz1 - 2; z += 2) {
    for (let x = ix0 + 1; x <= ix1 - 1; x++) {
      if (Math.abs(x - mx) <= 1) continue;
      q.put(x, Y0, z, B.pew, 2);
      if ((x + z) % 2 === 0) q.spot(x, z, 2, ['pray'], { seat: true });
    }
  }
  // Candles to light down the walls.
  if (q.has('candles')) for (let z = iz0 + 3; z <= iz1 - 2; z += 4) for (const x of [ix0, ix1]) q.fx(x, Y0, z, 'candles', B.candle_rack, 0);
  // The font by the door.
  q.fx(mx + (grand ? 1 : 1), Y0, iz1 - 1, 'font', B.holy_font);
  q.role('cleric', mx - 1, iz1 - 1, 0, []);
  // Hung lamps, high.
  for (let z = iz0 + 2; z <= iz1; z += 4) for (const x of [ix0, ix1]) q.put(x, Y0 + 2, z, B.lantern, LIT);
  // The bell tower, at a front corner.
  if (q.has('bells')) {
    const tx = q.x1 - 3;
    const tz = r.z1 + 1;
    const h = (grand ? 5 : 4) + 4;
    for (let z = tz; z < tz + 3; z++) for (let x = tx; x < tx + 3; x++) q.stack(x, z, Y0, Y0 + h - 1, north ? B.planks_dark : m.wall);
    for (let z = tz; z < tz + 3; z++) for (let x = tx; x < tx + 3; x++) q.put(x, Y0 + h, z, north ? B.roof_wood : m.roof, z === tz ? 2 : z === tz + 2 ? 0 : 1);
    q.put(tx + 1, Y0 + h + 1, tz + 1, B.bell);
    q.fx(tx + 1, Y0 + h + 1, tz + 1, 'bell');
  }
  // The north's carved beasts on the gables.
  if (north) for (const x of [r.x0, r.x1]) q.put(x, hall.roofBase + Math.min(5, Math.ceil((r.z1 - r.z0 + 1) / 2)), Math.round((r.z0 + r.z1) / 2), B.holmgang_post);
  court(q, r.z1 + 2, mx);
  q.sign(mx + 3, q.z1, 0);
  void o;
}

// The jade court's temple: the gate of red posts, the court, the hall
// with its upswept roof, the incense, the bell, the lanterns.
function temple(q) {
  q.fill(q.x0, q.z0, q.x1, q.z1, B.flagstone);
  const grand = q.size === 'city';
  const r = { x0: q.x0 + 2, z0: q.z0 + 1, x1: q.x1 - 2, z1: q.z0 + Math.max(5, Math.round(q.D * 0.5)) };
  const mx = Math.round((r.x0 + r.x1) / 2);
  const hall = q.hall(r, { doors: [{ x: mx, z: r.z1, rot: 0 }], h: grand ? 4 : 3, win: 'none', wall: B.paper_wall ?? B.planks_lacquer, corner: B.planks_lacquer, floor: B.planks_lacquer, roof: B.roof_jade, use: 'temple' });
  const { ix0, iz0, ix1, iz1 } = hall;
  q.put(mx, Y0, iz0, B.statue);
  q.put(mx, Y0, iz0 + 1, B.altar);
  q.fx(mx, Y0, iz0 + 1, 'altar');
  for (const dx of [-2, 2]) q.put(mx + dx, Y0, iz0 + 1, B.incense);
  if (q.has('relic')) q.fx(mx + 3, Y0, iz0, 'relic', B.relic_shrine);
  if (q.has('candles')) for (const x of [ix0, ix1]) q.fx(x, Y0, iz0 + 2, 'candles', B.candle_rack);
  for (let z = iz0 + 3; z <= iz1 - 1; z += 2) for (let x = ix0 + 1; x <= ix1 - 1; x += 2) if (x !== mx) {
    q.put(x, Y0, z, B.meditation_mat);
    q.spot(x, z, 2, ['pray'], {});
  }
  q.role('cleric', mx + 1, iz0 + 2, 0, ['pray']);
  // The gate of red posts, its beam, at the court's foot.
  const gz = q.z1 - 1;
  for (const x of [mx - 2, mx + 2]) q.stack(x, gz, Y0, Y0 + 2, B.planks_lacquer);
  for (let x = mx - 3; x <= mx + 3; x++) q.put(x, Y0 + 3, gz, B.planks_lacquer);
  // Incense in the court, the font, lanterns, the bell in its frame.
  q.put(mx, Y0, r.z1 + 2, B.incense);
  q.fx(mx - 3, Y0, r.z1 + 2, 'font', B.holy_font);
  q.role('cleric', mx - 2, r.z1 + 3, 1, []);
  for (let z = r.z1 + 2; z < q.z1 - 1; z += 2) for (const x of [q.x0 + 1, q.x1 - 1]) q.put(x, Y0, z, B.lantern_tree ?? B.lantern, LIT);
  if (q.has('bells')) q.fx(q.x1 - 2, Y0, r.z1 + 2, 'bell', B.bell_pagoda ?? B.bell);
  if (q.has('garden')) for (let x = q.x0 + 2; x < mx - 3; x++) q.put(x, Y0, q.z1 - 2, [B.peony ?? B.flower_red, B.bush, B.flower_white][x % 3]);
  if (q.has('spring')) {
    q.ground(mx + 4, r.z1 + 3, B.water);
    q.put(mx + 4, Y0, r.z1 + 3, B.lily_pad);
  }
  q.sign(mx + 1, q.z1, 0);
}

// The sun peoples' stepped pyramid: three steps of sandstone, the stair
// up its face, the altar and the sun-wheel on top between braziers; the
// court with its obelisks.
function pyramid(q) {
  q.fill(q.x0, q.z0, q.x1, q.z1, B.sandstone);
  const grand = q.size === 'city';
  const T = grand ? 4 : 3;
  const cx = q.cx;
  const back = q.z0 + 1;
  const w = Math.min(q.W - 4, 2 * T * 2 + 5);
  const d = Math.min(q.D - 6, 2 * T * 2 + 3);
  const x0 = cx - Math.floor(w / 2);
  const z0 = back;
  for (let t = 0; t < T; t++) {
    for (let z = z0 + t * 2; z <= z0 + d - 1 - t * 2; z++) for (let x = x0 + t * 2; x <= x0 + w - 1 - t * 2; x++) q.stack(x, z, Y0 + t, Y0 + t, t % 2 ? B.adobe : B.sandstone);
  }
  // The stair up the middle of its face.
  const fz = z0 + d - 1;
  for (let t = 0; t < T; t++) {
    q.put(cx, Y0 + t, fz - t * 2, q.m.stairs, 2);
    q.put(cx, Y0 + t, fz - t * 2 + 1, B.air);
  }
  const top = Y0 + T;
  const tz = z0 + (T - 1) * 2;
  q.put(cx, top, tz, B.altar);
  q.fx(cx, top, tz, 'altar');
  q.put(cx, top, tz - 1, B.sun_wheel ?? B.statue);
  q.brazier(cx - 2, tz, top);
  q.brazier(cx + 2, tz, top);
  q.role('cleric', cx + 1, tz + 1, 2, ['pray'], { y: top });
  for (let x = cx - 1; x <= cx + 1; x++) q.spot(x, tz + 1, 2, ['pray'], { y: top });
  if (q.has('relic')) q.fx(cx - 1, top, tz - 1, 'relic', B.relic_shrine);
  // The court: obelisks, the pool, braziers, the font.
  const cz = fz + 2;
  for (const x of [q.x0 + 1, q.x1 - 1]) for (let z = cz; z < q.z1; z += 3) q.put(x, Y0, z, B.spina_obelisk);
  if (q.has('spring')) for (let x = cx - 2; x <= cx + 2; x++) if (x !== cx) q.ground(x, q.z1 - 1, B.water);
  q.fx(cx - 2, Y0, cz, 'font', B.holy_font);
  if (q.has('candles')) q.fx(cx + 2, Y0, cz, 'candles', B.candle_rack);
  q.role('cleric', cx - 1, cz + 1, 0, []);
  if (q.has('graves')) for (let x = q.x0 + 3; x < cx - 3; x += 2) q.put(x, Y0, q.z1 - 1, B.gravestone);
  q.sign(cx + 3, q.z1, 0);
}

// A village's shrine: a little roofed house open at the front, its altar
// and candles; the offering bowl, the spring, flowers, a bench.
function shrine(q) {
  const m = q.m;
  const jade = q.fam === 'jade';
  q.fill(q.x0, q.z0, q.x1, q.z1, B.grass);
  const cx = q.cx;
  for (let z = q.z0 + 3; z <= q.z1; z++) q.ground(cx, z, B.gravel);
  // The shrine house: posts at its corners, a back wall, the roof.
  const x0 = cx - 2;
  const x1 = cx + 2;
  const z0 = q.z0 + 1;
  const z1 = q.z0 + 3;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) q.ground(x, z, jade ? B.planks_lacquer : B.flagstone);
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) q.stack(x, z, Y0, Y0 + 1, jade ? B.planks_lacquer : m.corner);
  for (let x = x0 + 1; x < x1; x++) q.stack(x, z0, Y0, Y0 + 1, jade ? B.paper_wall ?? m.wall : m.wall);
  const roof = jade ? B.roof_jade : m.roof;
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    q.put(x, Y0 + 2, z0, roof, 2);
    q.put(x, Y0 + 2, z1, roof, 0);
    q.put(x, Y0 + 3, z0 + 1, roof, 1);
  }
  q.put(cx, Y0, z0 + 1, B.altar);
  q.fx(cx, Y0, z0 + 1, 'altar');
  q.put(cx - 1, Y0, z0 + 1, B.candles, LIT);
  if (q.has('relic')) q.fx(cx + 1, Y0, z0 + 1, 'relic', B.relic_shrine);
  else q.put(cx + 1, Y0, z0 + 1, B.offering_bowl ?? B.candles);
  q.role('cleric', cx + 1, z1, 2, ['pray']);
  for (const x of [cx - 1, cx]) q.spot(x, z1, 2, ['pray']);
  if (q.has('candles')) q.fx(x0 - 1, Y0, z1, 'candles', B.candle_rack);
  if (q.has('spring')) {
    q.fx(x1 + 2, Y0, z1 + 1, 'spring', B.well);
    q.well(x1 + 2, z1 + 2);
  }
  q.fx(cx - 2, Y0, z1 + 2, 'font', B.holy_font);
  for (let k = 0; k < 8; k++) {
    const x = q.x0 + 1 + ((k * 5) % (q.W - 2));
    const z = q.z1 - 1 - (k % 3);
    if (Math.abs(x - cx) > 1) q.put(x, Y0, z, [B.flower_white, B.flower_yellow, B.flower_blue][k % 3]);
  }
  q.put(cx + 2, Y0, q.z1 - 2, B.bench, 2);
  q.spot(cx + 2, q.z1 - 2, 2, ['rest', 'pray']);
  if (q.has('graves')) for (let x = q.x0 + 1; x < cx - 2; x += 2) q.put(x, Y0, z1 + 1, B.gravestone);
  q.lamp(cx - 1, q.z1, 1);
  q.sign(cx + 1, q.z1, 0);
}

function holy(q) {
  if (q.spec.form === 'shrine') shrine(q);
  else if (q.fam === 'jade') temple(q);
  else if (q.fam === 'sun') pyramid(q);
  else church(q);
}

// ------------------------------------------------------------ the circle
function circle(q) {
  q.fill(q.x0, q.z0, q.x1, q.z1, q.fam === 'north' || q.fam === 'mist' ? B.heath ?? B.grass : B.grass);
  const cx = q.cx;
  const cz = q.cz - 1;
  const R = Math.min(Math.floor((q.W - 3) / 2), Math.floor((q.D - 4) / 2), 5);
  const n = R >= 5 ? 12 : 9;
  // The stones, a gap at the south where the way comes in.
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const x = Math.round(cx + Math.cos(a) * R);
    const z = Math.round(cz + Math.sin(a) * R * 0.9);
    if (z >= cz + R - 1 && Math.abs(x - cx) <= 1) continue;
    q.put(x, Y0, z, i % 4 === 0 && q.has('runes') ? B.rune_stone : B.standing_stone);
    if (i % 4 === 0 && q.has('runes')) q.fx(x, Y0, z, 'runes');
  }
  for (let z = cz + R - 1; z <= q.z1; z++) q.ground(cx, z, B.gravel);
  // The altar stone at the heart.
  q.fx(cx, Y0, cz, 'altar_stone', B.altar_stone);
  q.role('seer', cx, cz + 1, 2, ['pray']);
  for (const [dx, dz, f] of [[-2, 0, 3], [2, 0, 1], [0, -2, 0]]) q.spot(cx + dx, cz + dz, f, ['pray', 'stargaze', 'social']);
  if (q.has('bonfire')) {
    q.put(cx, Y0, cz + 2, B.campfire, LIT);
    q.seat(cx - 1, cz + 3, 2);
    q.seat(cx + 1, cz + 3, 2);
  }
  if (q.has('menhir')) q.fx(cx, Y0, cz - R - 1 >= q.z0 ? cz - R - 1 : q.z0, 'runes', B.rune_stone);
  // The grove: old trees about it.
  if (q.has('grove')) {
    for (const [x, z] of [[q.x0 + 1, q.z0 + 1], [q.x1 - 1, q.z0 + 1], [q.x0 + 1, q.z1 - 2], [q.x1 - 1, q.z1 - 2]]) {
      q.stack(x, z, Y0, Y0 + 2, B.log_oak);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) q.put(x + dx, Y0 + 3, z + dz, B.leaves_oak);
      q.put(x, Y0 + 4, z, B.leaves_oak);
    }
  }
  // The seer's hut, by the way in.
  const hx = q.x1 - 4;
  const hz = q.z1 - 3;
  if (hx > cx + 2) {
    const h = q.hall({ x0: hx, z0: hz, x1: q.x1, z1: q.z1 }, { doors: [{ x: hx, z: hz + 1, rot: 1 }], h: 2, roof: q.fam === 'north' ? B.roof_turf ?? B.thatch : B.thatch, wall: B.cob ?? q.m.wall, corner: B.log_oak, floor: B.dirt, use: 'seer' });
    q.put(h.ix1, Y0, h.iz0, B.bed, 0);
    q.put(h.ix0 + 1, Y0, h.iz1, B.candles, LIT);
    q.role('seer', h.ix0 + 1, h.iz0, 0, []);
  }
  q.sign(cx + 1, q.z1, 0);
}

export const HOLY = { holy, circle };
