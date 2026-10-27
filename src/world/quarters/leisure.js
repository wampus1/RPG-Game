// (Round 146) Places of ease (see specialties.js).
//   The baths: the great warm pool tiled in blue with the water-bearer
// pouring into it, mosaics round it; the cold plunge; the steam room; the
// rubbing tables; towels and the attendant by the way in; a garden. The
// north's is a sauna and a plunge pool; the jade court's a hot spring among
// rocks behind a bamboo fence, lanterns about it; the Ashborn's springs
// steam out of the black rock. A village has a hot spring and a hut.
//   The theatre: the stage, a pace up, its curtain (drawn open for a play:
// see game/cityplay.js), the footlights, the painted scenery behind; the
// seats before it (a half-bowl of steps under the sky for the classic and
// sun peoples, benches in a hall elsewhere, tea tables before the jade
// court's opera pavilion); boxes, the orchestra, statues, lanterns.
//   The gardens: hedged round, walks of gravel crossing at the fountain,
// beds of flowers, clipped shapes, benches and urns; the pond, the maze,
// the glasshouse, the aviary, the menagerie. The jade court's is raked
// gravel, stones and a pond with a bridge; the sun peoples' four gardens
// parted by channels of water; the north's and the wild folk's a garden of
// trees.
import { B } from '../blocks.js';
import { Y0, LIT } from './kit.js';
import { SURFACE } from '../../config.js';

// A pool: water a pace deep, tiled under and round; spots in it to bathe.
function pool(q, x0, z0, x1, z1, rim = B.bath_tile, water = B.bath_water) {
  for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) q.ground(x, z, rim);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    q.put(x, SURFACE - 1, z, B.bath_tile);
    q.ground(x, z, water);
    if ((x + z) % 3 === 0) q.spot(x, z, (x + z) % 4, ['bathe', 'social', 'gossip'], { y: SURFACE });
  }
  q.fx(Math.round((x0 + x1) / 2), SURFACE, Math.round((z0 + z1) / 2), 'pool');
}

function thermae(q) {
  const m = q.m;
  const floor = q.has('mosaic') || q.fam === 'classic' ? B.mosaic : m.pave;
  q.fill(q.x0, q.z0, q.x1, q.z1, floor);
  q.enclose(m.wall, 2, null, 1);
  // Columns round the inside of the wall.
  for (let x = q.x0 + 1; x <= q.x1 - 1; x += 2) for (const z of [q.z0 + 1]) q.column(x, z, 2, B.lantern);
  const city = q.size === 'city';
  // The warm pool in the middle.
  const px0 = q.x0 + 3;
  const px1 = q.x1 - (city && q.has('steam') ? 8 : 3);
  const pz0 = q.z0 + 3;
  const pz1 = q.z1 - 4;
  pool(q, px0, pz0, px1, pz1);
  const mx = Math.round((px0 + px1) / 2);
  q.put(mx, Y0, pz0 - 1, B.bath_statue);
  if (q.has('statues')) for (const x of [px0 - 1, px1 + 1]) q.put(x, Y0, pz0 - 1, B.statue);
  // Benches along the pool's sides.
  for (let x = px0; x <= px1; x += 3) {
    q.put(x, Y0, pz1 + 2, B.bench, 2);
    q.seat(x, pz1 + 2, 2);
  }
  // The steam room at the side.
  if (q.has('steam')) {
    const r = city ? { x0: q.x1 - 6, z0: q.z0 + 2, x1: q.x1 - 1, z1: q.z0 + 6 } : { x0: q.x1 - 5, z0: q.z1 - 4, x1: q.x1 - 1, z1: q.z1 - 1 };
    if (r.x0 > px1 + 1 || !city) {
      const h = q.hall(r, { doors: [{ x: r.x0, z: r.z0 + 2, rot: 1 }], h: 3, win: 'none', floor: B.bath_tile, use: 'steam' });
      q.put(h.ix1, Y0, h.iz0, B.steam_vent);
      q.put(h.ix1, Y0, h.iz1, B.steam_vent);
      q.fx(h.ix0 + 1, Y0, h.iz0, 'steam');
      for (let z = h.iz0; z <= h.iz1; z++) q.spot(h.ix0, z, 3, ['bathe', 'rest', 'social']);
    }
  }
  // The cold plunge in a corner.
  if (q.has('cold')) {
    const cx0 = q.x0 + 2;
    const cz1 = q.z1 - 2;
    pool(q, cx0, cz1, cx0 + 1, cz1, B.bath_tile, B.water);
  }
  // The rubbing tables.
  if (q.has('massage')) {
    for (const x of [q.x1 - 3, q.x1 - 5]) {
      q.fx(x, Y0, q.z1 - 2, 'massage', B.massage_table, 0);
      q.canopy(x, q.z1 - 2, Y0 + 2, 0, 0);
    }
    q.role('attendant', q.x1 - 4, q.z1 - 2, 0, []);
  }
  // Towels and the attendant by the way in.
  q.fx(q.cx - 2, Y0, q.z1 - 1, 'towels', B.towel_shelf);
  q.role('attendant', q.cx - 1, q.z1 - 1, 0, ['shop']);
  if (q.has('garden')) for (let x = q.x0 + 1; x <= q.x0 + 3; x++) q.put(x, Y0, q.z1 - 3 >= q.z0 ? q.z1 - 3 : q.z1, B.garden_urn);
  q.sign(q.cx + 2, q.z1, 0);
}

// A roofed bathhouse: a hall over the pool, benches, the towels.
function bathhouse(q) {
  const m = q.m;
  q.fill(q.x0, q.z0, q.x1, q.z1, m.pave);
  const r = { x0: q.x0 + 1, z0: q.z0 + 1, x1: q.x1 - 1, z1: q.z1 - 2 };
  const mx = Math.round((r.x0 + r.x1) / 2);
  const h = q.hall(r, { doors: [{ x: mx, z: r.z1, rot: 0 }], h: 3, floor: q.has('mosaic') ? B.mosaic : B.bath_tile, win: 'glass', use: 'baths' });
  pool(q, h.ix0 + 2, h.iz0 + 1, h.ix1 - 2, h.iz1 - 2);
  q.put(mx, Y0, h.iz0, B.bath_statue);
  for (let x = h.ix0; x <= h.ix1; x += 3) if (Math.abs(x - mx) > 1) {
    q.put(x, Y0, h.iz1, B.bench, 2);
    q.seat(x, h.iz1, 2);
  }
  if (q.has('steam')) for (const z of [h.iz0, h.iz1 - 1]) q.put(h.ix0, Y0, z, B.steam_vent);
  if (q.has('massage')) q.fx(h.ix1, Y0, h.iz0, 'massage', B.massage_table, 1);
  q.fx(mx + 2, Y0, q.z1, 'towels', B.towel_shelf);
  q.role('attendant', mx + 1, q.z1, 0, ['shop']);
  q.role('attendant', h.ix0 + 1, h.iz0, 0, []);
  q.sign(mx - 2, q.z1, 0);
}

// A spring: a natural pool, steaming, among rocks (or the jade court's
// behind its bamboo, or the Ashborn's black rock), a hut to change in.
function spring(q) {
  const jade = q.fam === 'jade';
  const ember = q.fam === 'ember';
  const north = q.fam === 'north';
  q.fill(q.x0, q.z0, q.x1, q.z1, ember ? B.basalt : jade ? B.gravel : B.grass);
  const cx = q.cx;
  const cz = q.cz - 1;
  const rx = Math.max(2, Math.floor(q.W / 2) - 3);
  const rz = Math.max(2, Math.floor(q.D / 2) - 3);
  for (let z = cz - rz - 1; z <= cz + rz + 1; z++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
    const d = ((x - cx) / (rx + 0.5)) ** 2 + ((z - cz) / (rz + 0.5)) ** 2;
    if (d <= 1) {
      q.put(x, SURFACE - 1, z, ember ? B.basalt : B.stone);
      q.ground(x, z, B.bath_water);
      if ((x + z) % 3 === 0) q.spot(x, z, 0, ['bathe', 'social'], { y: SURFACE });
    } else if (d <= 1.7) {
      q.ground(x, z, ember ? B.basalt : B.stone);
      if ((x * 3 + z) % 5 === 0) q.put(x, Y0, z, B.rock);
    }
  }
  q.fx(cx, SURFACE, cz, 'pool');
  // The steam off it.
  for (const [dx, dz] of [[-rx - 1, 0], [rx + 1, 1]]) q.put(cx + dx, Y0, cz + dz, B.steam_vent);
  if (jade) {
    for (let x = q.x0; x <= q.x1; x++) for (const z of [q.z0]) q.stack(x, z, Y0, Y0 + 1, B.bamboo ?? B.fence);
    for (const [x, z] of [[q.x0 + 1, q.z1 - 1], [q.x1 - 1, q.z1 - 1]]) q.put(x, Y0, z, B.lantern_tree ?? B.lantern, LIT);
  }
  // The hut to change in (a sauna, in the north).
  const r = { x0: q.x0, z0: q.z1 - 3, x1: q.x0 + 3, z1: q.z1 };
  const h = q.hall(r, { doors: [{ x: r.x1, z: r.z0 + 1, rot: 3 }], h: 2, wall: north ? B.log_wall : B.planks, corner: north ? B.log_pine : B.log_oak, floor: B.planks, roof: north ? B.roof_turf ?? B.roof_wood : B.thatch, win: 'none', use: north ? 'sauna' : 'hut' });
  if (north) {
    q.put(h.ix0, Y0, h.iz0, B.steam_vent);
    q.fx(h.ix0 + 1 <= h.ix1 ? h.ix0 + 1 : h.ix0, Y0, h.iz1, 'steam');
  } else q.fx(h.ix0, Y0, h.iz0, 'towels', B.towel_shelf);
  q.role('attendant', r.x1 + 1, r.z0 + 2, 1, []);
  q.put(q.x1 - 1, Y0, q.z1 - 1, B.bench, 2);
  q.seat(q.x1 - 1, q.z1 - 1, 2);
  // A deck of planks on the far side of the pool, to sit with your feet in
  // the water; benches along it.
  const free = (x, z) => q.inLot(x, z) && q.at(x, Y0, z) === undefined && !q.atGate(x, z, 1, 2);
  const dz = cz - rz - 2;
  if (dz > q.z0) {
    for (let x = cx - 2; x <= cx + 2; x++) if (free(x, dz)) q.ground(x, dz, north ? B.planks_dark : jade ? B.planks_lacquer ?? B.planks : B.planks);
    for (const x of [cx - 2, cx + 2]) if (free(x, dz)) {
      q.put(x, Y0, dz, B.bench, 0);
      q.seat(x, dz, 0);
    }
  }
  // Lamps round the rim; the people's own touch: a figure pouring water,
  // a carved post, a stone lantern.
  for (const [lx, lz] of [[cx - rx - 2, cz - rz], [cx + rx + 2, cz - rz], [cx - rx - 2, cz + rz], [cx + rx + 2, cz + rz]]) if (free(lx, lz)) {
    if (ember) q.brazier(lx, lz);
    else q.lamp(lx, lz, 1);
  }
  const sx = cx + rx + 2;
  if (free(sx, cz)) q.put(sx, Y0, cz, north ? B.holmgang_post ?? B.log_pine : jade ? B.lantern_tree ?? B.lantern : B.bath_statue, north || jade ? 0 : 1);
  // A cold plunge beside it; a table for the rub-downs.
  if (q.has('cold')) {
    const px = cx - rx - 3;
    for (const [ax, az] of [[px, cz + 1], [px, cz + 2]]) if (free(ax, az)) {
      q.put(ax, SURFACE - 1, az, B.stone);
      q.ground(ax, az, north ? B.ice ?? B.water : B.water);
      q.spot(ax, az, 0, ['bathe'], { y: SURFACE });
    }
  }
  if (q.has('massage') && free(q.x1 - 2, q.z1 - 3)) q.fx(q.x1 - 2, Y0, q.z1 - 3, 'massage', B.massage_table, 0);
  // Flowers and ferns about it, towels drying on a line.
  if (q.has('garden') || jade) for (let k = 0; k < 6; k++) {
    const x = q.rng.int(q.x0 + 1, q.x1 - 1);
    const z = q.rng.int(q.z0 + 1, q.z1 - 1);
    if (free(x, z)) q.put(x, Y0, z, q.rng.pick([B.flower_red, B.flower_white, B.fern ?? B.bush, B.bush].filter((b) => b !== undefined)));
  }
  q.sign(cx + 1, q.z1, 0);
}

function baths(q) {
  if (q.spec.form === 'hot_spring' || q.fam === 'jade' || q.fam === 'ember' || q.fam === 'north') spring(q);
  else if (q.spec.form === 'thermae') thermae(q);
  else bathhouse(q);
}

// ------------------------------------------------------------ theatre
// The stage: `x0..x1` across, its back at z0, its front edge at z1; the
// curtain along the front, footlights below it, the scenery at the back.
function stage(q, x0, z0, x1, z1) {
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    q.ground(x, z, B.stage_floor);
    q.put(x, Y0, z, B.stage_floor);
  }
  const curtain = [];
  for (let x = x0; x <= x1; x++) {
    q.put(x, Y0 + 1, z1, B.stage_curtain, 0);
    curtain.push(q.pt(x, z1));
    if ((x - x0) % 2 === 0) q.put(x, Y0, z1 + 1, B.footlight, LIT);
  }
  for (let x = x0; x <= x1; x += 2) q.put(x, Y0 + 1, z0, B.stage_flat, 0);
  if (q.has('props')) {
    q.put(x0 + 1, Y0 + 1, z0 + 1, B.barrel);
    q.put(x1 - 1, Y0 + 1, z0 + 1, B.chair, 0);
  }
  // The players' marks on it.
  const mx = Math.round((x0 + x1) / 2);
  for (const dx of [-2, 0, 2]) q.role('actor', mx + dx, z1 - 1, 0, ['music'], { y: Y0 + 1 });
  q.out.stage = { ...q.area({ x0, z0, x1, z1 }), y: Y0 + 1, curtain, mx: q.pt(mx, z1 - 1) };
  // Steps up at the side.
  q.put(x1 + 1, Y0, z0 + 1, q.m.stairs, 3);
  return mx;
}

function theatre(q) {
  const m = q.m;
  const open = q.fam === 'classic' || q.fam === 'sun';
  const jade = q.fam === 'jade';
  q.fill(q.x0, q.z0, q.x1, q.z1, m.pave);
  const city = q.size === 'city';
  const sw = city ? 5 : 4;
  const sx0 = q.cx - sw;
  const sx1 = q.cx + sw;
  if (open) {
    // The stage building's back wall, columns along it, statues in niches.
    for (let x = q.x0 + 1; x <= q.x1 - 1; x++) q.stack(x, q.z0, Y0, Y0 + 3, m.wall);
    for (let x = sx0 - 1; x <= sx1 + 1; x += 2) q.column(x, q.z0 + 1, 3);
    const mx = stage(q, sx0, q.z0 + 1, sx1, q.z0 + 3);
    if (q.has('statues')) for (const x of [sx0 - 2, sx1 + 2]) q.put(x, Y0, q.z0 + 1, B.statue);
    // The half-bowl of seats facing it, stepping up.
    const cz = q.z0 + 4;
    const R = q.D - 5;
    for (let z = cz + 1; z <= q.z1 - 1; z++) for (let x = q.x0 + 1; x <= q.x1 - 1; x++) {
      const d = Math.hypot(x - mx, (z - cz) * 1.25);
      if (q.atGate(x, z, 1, 3) || Math.abs(x - mx) <= 0) continue;
      const band = Math.floor((d - 3) / 1.6);
      if (band < 0 || d > R + 2) continue;
      q.tier(x, z, Math.min(3, band + 1), mx, cz, m.trim, m.stairs, (x + z) % 2 === 0);
    }
    if (q.has('orchestra')) for (const dx of [-2, 2]) q.role('musician', mx + dx, cz + 1, 2, ['music']);
  } else if (jade) {
    // The opera pavilion: the stage under a roof of jade on red posts.
    const mx = stage(q, sx0, q.z0 + 1, sx1, q.z0 + 3);
    for (const x of [sx0 - 1, sx1 + 1]) for (const z of [q.z0 + 1, q.z0 + 4]) q.stack(x, z, Y0, Y0 + 3, B.planks_lacquer);
    for (let x = sx0 - 2; x <= sx1 + 2; x++) for (let z = q.z0; z <= q.z0 + 4; z++) q.put(x, Y0 + 4, z, B.roof_jade, z === q.z0 ? 2 : z === q.z0 + 4 ? 0 : 1);
    // Tea tables before it.
    for (let z = q.z0 + 6; z <= q.z1 - 2; z += 3) for (let x = q.x0 + 2; x <= q.x1 - 2; x += 4) {
      if (Math.abs(x - mx) <= 1) continue;
      q.put(x, Y0, z, B.tea_table);
      for (const dx of [-1, 1]) {
        q.put(x + dx, Y0, z, B.stool);
        q.seat(x + dx, z, 2);
      }
    }
    if (q.has('orchestra')) q.role('musician', sx0 - 2, q.z0 + 3, 3, ['music']);
  } else {
    // The playhouse: a hall, the stage at its far end, benches facing it,
    // a gallery stepping up at the back.
    const r = { x0: q.x0 + 1, z0: q.z0, x1: q.x1 - 1, z1: q.z1 - 1 };
    const h = q.hall(r, { doors: [{ x: q.cx, z: r.z1, rot: 0 }], h: 4, win: 'glass', use: 'theatre' });
    const mx = stage(q, Math.max(h.ix0 + 1, sx0), h.iz0, Math.min(h.ix1 - 1, sx1), h.iz0 + 2);
    for (let z = h.iz0 + 5; z <= h.iz1 - 2; z += 2) for (let x = h.ix0 + 1; x <= h.ix1 - 1; x++) {
      if (Math.abs(x - mx) <= 0) continue;
      q.put(x, Y0, z, B.pew, 2);
      if ((x + z) % 2 === 0) q.seatOnly(x, Y0, z, 2);
      if ((x + z) % 2 === 0) q.spot(x, z, 2, ['social', 'music'], { seat: true });
    }
    // The gallery along the back.
    for (let x = h.ix0; x <= h.ix1; x++) if (Math.abs(x - mx) > 1) q.tier(x, h.iz1, 1, mx, h.iz0, m.trim, m.stairs, x % 2 === 0);
    if (q.has('lanterns')) for (let z = h.iz0 + 3; z <= h.iz1; z += 3) for (const x of [h.ix0, h.ix1]) q.put(x, Y0 + 2, z, B.lantern, LIT);
    if (q.has('orchestra')) q.role('musician', mx - 2, h.iz0 + 3, 2, ['music']);
  }
  // Boxes either side for the grand.
  if (q.has('boxes') && !jade) {
    for (const x of [q.x0 + 1, q.x1 - 1]) {
      const z = q.z0 + 5;
      q.stack(x, z, Y0, Y0, m.trim);
      q.put(x, Y0 + 1, z, B.chair, x < q.cx ? 3 : 1);
      q.canopy(x, z, Y0 + 3, x < q.cx ? 3 : 1, 0);
      q.seatOnly(x, Y0 + 1, z, x < q.cx ? 3 : 1, { box: true });
    }
  }
  if (q.has('lanterns') && open) for (let x = q.x0 + 1; x <= q.x1 - 1; x += 4) q.lamp(x, q.z1, 1);
  // The playbill by the way in.
  q.fx(q.cx - 2, Y0, q.z1, 'playbill', B.playbill);
  q.role('manager', q.cx - 1, q.z1 - 1 >= q.z0 ? q.z1 - 1 : q.z1, 0, ['shop']);
  q.sign(q.cx + 2, q.z1, 0);
}

// ------------------------------------------------------------ gardens
function gardens(q) {
  const m = q.m;
  const jade = q.fam === 'jade';
  const sun = q.fam === 'sun' || q.fam === 'ember';
  const wild = q.fam === 'north' || q.fam === 'wild' || q.fam === 'mist';
  q.fill(q.x0, q.z0, q.x1, q.z1, B.grass_lush);
  const mx = q.cx;
  const mz = q.cz;
  // The hedge round it, gaps for the gates.
  q.enclose(jade ? B.bamboo ?? B.hedge : B.hedge, 1);
  const flowers = [B.flower_red, B.flower_yellow, B.flower_white, B.flower_blue, B.flower_purple, B.peony ?? B.flower_red];
  // The walks: a cross through the middle (water channels for the sun's).
  for (let x = q.x0 + 1; x <= q.x1 - 1; x++) q.ground(x, mz, sun ? B.water : B.gravel);
  for (let z = q.z0 + 1; z <= q.z1 - 1; z++) q.ground(mx, z, sun ? B.water : B.gravel);
  if (sun) for (let z = q.z0 + 1; z <= q.z1 - 1; z++) for (const x of [mx - 1, mx + 1]) q.ground(x, z, B.flagstone);
  if (sun) for (let x = q.x0 + 1; x <= q.x1 - 1; x++) for (const z of [mz - 1, mz + 1]) q.ground(x, z, B.flagstone);
  // The heart: a fountain, or the pond with its bridge, or a great tree.
  if (q.has('pond') || jade) {
    for (let z = mz - 2; z <= mz + 2; z++) for (let x = mx - 3; x <= mx + 3; x++) {
      if (Math.hypot((x - mx) / 3.4, (z - mz) / 2.4) > 1) continue;
      q.ground(x, z, B.water);
      q.put(x, Y0 - 1, z, B.water);
      if ((x + z) % 4 === 0) q.put(x, Y0, z, B.lily_pad);
    }
    for (let x = mx - 3; x <= mx + 3; x++) q.ground(x, mz, B.planks_lacquer ?? B.planks);
    q.put(mx + 4, Y0, mz - 2, B.reeds);
    q.spot(mx, mz, 0, ['stroll', 'sketch', 'fish', 'rest']);
  } else if (wild) {
    q.stack(mx, mz, Y0, Y0 + 3, B.log_oak);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dz) < 4) q.put(mx + dx, Y0 + 4, mz + dz, B.leaves_oak);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) q.put(mx + dx, Y0 + 5, mz + dz, B.leaves_oak);
  } else {
    q.fx(mx, Y0, mz, 'fountain', B.fountain);
    q.well(mx, mz + 1);
  }
  // The beds in the four quarters, topiary at their corners, benches.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ax = sx < 0 ? q.x0 + 2 : mx + 2;
    const bx = sx < 0 ? mx - 2 : q.x1 - 2;
    const az = sz < 0 ? q.z0 + 2 : mz + 2;
    const bz = sz < 0 ? mz - 2 : q.z1 - 2;
    if (bx < ax || bz < az) continue;
    for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) {
      if (jade) {
        q.ground(x, z, B.arena_sand);
        if ((x * 5 + z * 3) % 11 === 0) q.put(x, Y0, z, B.rock);
      } else if (wild) {
        if ((x * 7 + z * 5) % 9 === 0) q.put(x, Y0, z, [B.bush, B.fern, B.berry_bush][(x + z) % 3]);
        else if ((x + z) % 3 === 0) q.put(x, Y0, z, flowers[(x * 3 + z) % flowers.length]);
      } else if ((z - az) % 2 === 0) q.put(x, Y0, z, flowers[(x + z * 2) % flowers.length]);
    }
    if (q.has('topiary') && !wild) q.put(sx < 0 ? bx : ax, Y0, sz < 0 ? bz : az, B.topiary);
    const bxp = sx < 0 ? mx - 1 - (sun ? 1 : 0) : mx + 1 + (sun ? 1 : 0);
    const bzp = sz < 0 ? az : bz;
    q.put(bxp, Y0, bzp, B.bench, sx < 0 ? 3 : 1);
    q.spot(bxp, bzp, sx < 0 ? 3 : 1, ['rest', 'read', 'sketch', 'social']);
  }
  // The rest of what it has, in its corners.
  const corners = [[q.x0 + 2, q.z0 + 2], [q.x1 - 2, q.z0 + 2], [q.x0 + 2, q.z1 - 2], [q.x1 - 2, q.z1 - 2]];
  let c = 0;
  if (q.has('aviary')) {
    const [x, z] = corners[c++];
    q.fx(x, Y0, z, 'aviary', B.aviary);
  }
  if (q.has('menagerie')) {
    const [x, z] = corners[c++];
    q.fx(x, Y0, z, 'cage', B.beast_cage, 0);
    q.pen(Math.min(x, x + (x < mx ? 2 : -2)), z + (z < mz ? 1 : -1), Math.max(x, x + (x < mx ? 2 : -2)), z + (z < mz ? 2 : -2), ['deer', 'crane', 'flamingo', 'white_hare'], 2);
  }
  if (q.has('glasshouse') && c < 4) {
    const [x, z] = corners[c++];
    const r = { x0: x < mx ? x - 1 : x - 3, z0: z < mz ? z - 1 : z - 2, x1: x < mx ? x + 3 : x + 1, z1: z < mz ? z + 2 : z + 1 };
    const h = q.hall(r, { doors: [{ x: x < mx ? r.x1 : r.x0, z: r.z0 + 1, rot: x < mx ? 3 : 1 }], h: 3, wall: B.glass, corner: m.trim, roof: B.glass, flat: true, floor: B.grass_lush, win: 'none', use: 'glasshouse' });
    for (let zz = h.iz0; zz <= h.iz1; zz++) for (let xx = h.ix0; xx <= h.ix1; xx++) q.put(xx, Y0, zz, [B.giant_fern ?? B.fern, B.flower_purple, B.peony ?? B.flower_red][(xx + zz) % 3]);
    q.fx(h.ix0, Y0, h.iz0, 'glasshouse');
  }
  if (q.has('maze') && c < 4) {
    const [x, z] = corners[c++];
    const x0 = x < mx ? x - 1 : x - 4;
    const z0 = z < mz ? z - 1 : z - 3;
    for (let zz = z0; zz <= z0 + 4; zz++) for (let xx = x0; xx <= x0 + 5; xx++) {
      if ((xx - x0) % 2 === 0 && (zz - z0) % 2 === 0) q.stack(xx, zz, Y0, Y0 + 1, B.hedge);
      else if (((xx - x0) * 3 + (zz - z0) * 5) % 4 === 0) q.stack(xx, zz, Y0, Y0 + 1, B.hedge);
    }
    q.fx(x0 + 3, Y0, z0 + 2, 'maze', B.garden_urn);
  }
  q.role('gardener', mx - 3, mz + 3, 2, ['garden', 'farm']);
  q.role('gardener', mx + 3, mz - 3, 0, ['garden', 'farm']);
  for (const [x, z] of corners.slice(c)) q.put(x, Y0, z, wild ? B.bush : B.garden_urn);
  for (const x of [mx - 1, mx + 1]) q.lamp(x, q.z1, 1);
  q.sign(mx + 2, q.z1, 0);
}

export const LEISURE = { baths, theatre, gardens };
