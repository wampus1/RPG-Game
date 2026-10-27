// (Round 146) Places of trade (see specialties.js).
//   The grand bazaar: a city's aisles of stalls under their awnings, each
// stall its goods heaped behind the counter (spices, rugs, pots, songbirds,
// silks, the fruit of the country, things from far away), its keeper
// standing among them; the fountain where the aisles cross; the auction
// block at the head of the main aisle with benches before it; the board of
// the region's prices and the counting house of the exchange by the way
// in; the caravanserai's yard where the caravans unload; a clock tower.
// The sun peoples' souk is roofed over in cloth from end to end; the jade
// court's hangs with lanterns. A town's market hall is the same in a long
// hall, its stalls down both sides.
//   The fairground: the striker, the fortune-teller's tent, the hoop-la,
// the carousel, the stage, the pens of prize beasts, the butts for the
// archery, the food stalls and the tents of the travelling folk, bunting
// and banners all round.
import { B } from '../blocks.js';
import { Y0, LIT } from './kit.js';

const GOODS = {
  spices: B.spice_sacks, rugs: B.rug_stack, pots: B.pottery, birds: B.birdcages, silk: B.silk_rack,
  produce: B.crate, cloth: B.cloth_bolts ?? B.crate, wine: B.barrel, far: B.plunder_heap ?? B.crate,
};

// A stall three wide facing `face` (0: its counter to the south of its
// back row): goods either side of where its keeper stands, the counter
// before them, the awning over the back row on its posts.
function stall(q, x, z, kinds, colour, roofed = true) {
  const [a, b] = kinds;
  q.put(x, Y0, z, GOODS[a] ?? B.crate);
  q.put(x + 2, Y0, z, GOODS[b] ?? B.barrel);
  for (let dx = 0; dx < 3; dx++) q.put(x + dx, Y0, z + 1, B.counter);
  if (roofed) {
    for (let dx = 0; dx < 3; dx++) q.canopy(x + dx, z, Y0 + 2, 0, colour);
    for (const dx of [0, 2]) q.put(x + dx, Y0 + 1, z, B.fence);
  }
  q.role('stallholder', x + 1, z, 0, ['market', 'shop']);
  const p = q.pt(x + 1, z);
  q.out.stalls.push({ x: p.x, z: p.z, face: q.dir(0), goods: a });
  // (Where a customer stands, before the counter.)
  q.spot(x + 1, z + 2, 2, ['shop', 'market', 'stroll', 'social']);
}

function stallKinds(q, rng) {
  const pool = ['produce', 'cloth', 'pots', 'produce'];
  if (q.has('spices') || q.fam === 'sun') pool.push('spices', 'spices');
  pool.push('rugs', 'birds');
  if (q.fam === 'jade' || q.size === 'city') pool.push('silk');
  if (q.has('far')) pool.push('far', 'silk');
  return [rng.pick(pool), rng.pick(pool)];
}

function grandBazaar(q) {
  const rng = q.rng;
  const pave = q.fam === 'sun' ? B.sandstone : q.fam === 'jade' ? B.flagstone : q.m.pave;
  q.fill(q.x0, q.z0, q.x1, q.z1, pave);
  const mx = q.cx;
  const mz = q.cz;
  const souk = q.fam === 'sun';
  // Rows of stalls back to back, aisles between; the main aisle from the
  // way in (south) to the auction block (north), the cross aisle through
  // the middle.
  let colour = q.m.cloth;
  for (let z = q.z0 + 2; z + 1 <= q.z1 - 3; z += 4) {
    for (let x = q.x0 + 1; x + 2 <= q.x1 - 1; x += 4) {
      if (Math.abs(x + 1 - mx) <= 2 || (z <= mz && z + 1 >= mz - 1)) continue;
      stall(q, x, z, stallKinds(q, rng), colour);
      colour = (colour + 1) & 3;
    }
  }
  // The souk's cloth roof over the aisles.
  if (souk) for (let z = q.z0 + 1; z <= q.z1 - 1; z++) for (let x = q.x0 + 1; x <= q.x1 - 1; x++) if ((z - q.z0) % 4 === 0 && (x + z) % 2 === 0) q.canopy(x, z, Y0 + 3, 0, (x >> 1) & 3);
  // Where the aisles cross: a fountain (or a well), benches round it.
  if (q.has('fountain')) {
    q.fx(mx, Y0, mz, 'fountain', B.fountain);
    q.well(mx, mz + 1);
    for (const [dx, f] of [[-2, 1], [2, 3]]) {
      q.put(mx + dx, Y0, mz, B.bench, f);
      q.spot(mx + dx, mz, f, ['rest', 'social', 'gossip']);
    }
  } else q.lamp(mx, mz, 2);
  // The auction block at the head of the main aisle, benches before it.
  if (q.has('auction')) {
    q.fx(mx, Y0, q.z0 + 1, 'auction', B.auction_block, 0);
    q.role('auctioneer', mx, q.z0 + 2, 0, []);
    for (const dx of [-2, -1, 1, 2]) {
      q.put(mx + dx, Y0, q.z0 + 4, B.bench, 2);
      q.seat(mx + dx, q.z0 + 4, 2);
    }
  }
  // The board of prices and the exchange's counting house by the way in.
  if (q.has('exchange')) {
    q.fx(mx - 3, Y0, q.z1 - 1, 'prices', B.price_board);
    q.fx(mx + 3, Y0, q.z1 - 1, 'exchange', B.counter);
    q.put(mx + 4, Y0, q.z1 - 1, B.chest);
    q.role('changer', mx + 3, q.z1 - 2, 0, ['shop']);
  }
  // The caravanserai: a yard at the side for the beasts, water, hay, a cart.
  if (q.has('caravanserai')) {
    const x0 = q.x1 - 4;
    const z0 = q.z0 + 1;
    for (let z = z0; z <= z0 + 3; z++) for (let x = x0; x <= q.x1 - 1; x++) q.ground(x, z, B.dirt);
    q.put(x0, Y0, z0, B.hay_bale);
    q.put(x0 + 1, Y0, z0, B.quench_trough, 0);
    q.put(q.x1 - 1, Y0, z0 + 3, B.gl_cart ?? B.crate);
    q.pen(x0, z0 + 1, q.x1 - 1, z0 + 3, q.fam === 'north' ? ['reindeer', 'horse'] : ['horse'], 2);
  }
  // The clock tower in a corner.
  if (q.has('clock')) q.tower(q.x0, q.z1 - 2, 2, 6, q.m.wall, B.bell);
  // Lanterns: strung on posts for the jade court, lamps elsewhere.
  for (let x = q.x0; x <= q.x1; x += 4) for (const z of [q.z0, q.z1]) if (!q.atGate(x, z, 2)) q.lamp(x, z, q.fam === 'jade' ? 2 : 1);
  q.sign(mx + 2, q.z1, 0);
}

function marketHall(q) {
  const rng = q.rng;
  q.fill(q.x0, q.z0, q.x1, q.z1, q.m.pave);
  const r = { x0: q.x0 + 1, z0: q.z0 + 1, x1: q.x1 - 1, z1: q.z1 - 2 };
  const mx = q.cx;
  const hall = q.hall(r, { doors: [{ x: mx, z: r.z1, rot: 0 }, { x: mx, z: r.z0, rot: 2 }], open: true, h: 4, win: 'glass', use: 'market' });
  // Stalls along both long walls, facing in: the goods against the wall
  // behind the keeper, the counter before them, a way round its end for
  // the keeper to come and go by.
  const wallStall = (x, z, dz, colour) => {
    const [a, b] = stallKinds(q, rng);
    q.put(x, Y0, z, GOODS[a] ?? B.crate);
    q.put(x + 1, Y0, z + dz, B.counter);
    q.put(x, Y0, z + dz, B.counter);
    q.put(x + 2, Y0, z + dz, GOODS[b] ?? B.barrel);
    q.canopy(x + 1, z, Y0 + 2, dz > 0 ? 0 : 2, colour);
    q.role('stallholder', x + 1, z, dz > 0 ? 0 : 2, ['market', 'shop']);
    const p = q.pt(x + 1, z);
    q.out.stalls.push({ x: p.x, z: p.z, face: q.dir(dz > 0 ? 0 : 2), goods: a });
    q.spot(x + 1, z + dz * 2, dz > 0 ? 2 : 0, ['shop', 'market', 'stroll']);
  };
  let colour = q.m.cloth;
  for (let x = hall.ix0; x + 2 <= hall.ix1; x += 4) {
    if (Math.abs(x + 1 - mx) <= 2) continue;
    wallStall(x, hall.iz0, 1, colour);
    wallStall(x, hall.iz1, -1, colour + 1);
    colour = (colour + 1) & 3;
  }
  if (q.has('auction')) {
    q.fx(hall.ix0, Y0, Math.round((hall.iz0 + hall.iz1) / 2), 'auction', B.auction_block, 3);
    q.role('auctioneer', hall.ix0 + 1, Math.round((hall.iz0 + hall.iz1) / 2), 1, []);
  }
  for (let x = hall.ix0 + 2; x <= hall.ix1 - 2; x += 5) q.put(x, Y0 + 3, Math.round((hall.iz0 + hall.iz1) / 2), B.lantern, LIT);
  if (q.has('exchange')) q.fx(mx - 2, Y0, q.z1, 'prices', B.price_board);
  if (q.has('fountain')) q.fx(mx + 3, Y0, q.z1, 'fountain', B.fountain);
  q.sign(mx + 2, q.z1, 0);
}

function bazaar(q) {
  if (q.spec.form === 'market_hall') marketHall(q);
  else grandBazaar(q);
}

// ------------------------------------------------------------ the fair
function fair(q) {
  const rng = q.rng;
  q.fill(q.x0, q.z0, q.x1, q.z1, B.grass_lush);
  const mx = q.cx;
  // A loop of trodden path round the middle.
  for (let x = q.x0 + 2; x <= q.x1 - 2; x++) for (const z of [q.z0 + 2, q.z1 - 2]) q.ground(x, z, B.path);
  for (let z = q.z0 + 2; z <= q.z1 - 2; z++) for (const x of [q.x0 + 2, q.x1 - 2]) q.ground(x, z, B.path);
  for (let z = q.cz; z <= q.z1; z++) q.ground(mx, z, B.path);
  // Banners round the edge.
  for (let x = q.x0; x <= q.x1; x += 3) for (const z of [q.z0, q.z1]) if (!q.atGate(x, z, 2)) q.put(x, Y0, z, B.festival_banner);
  for (let z = q.z0 + 3; z < q.z1; z += 3) for (const x of [q.x0, q.x1]) q.put(x, Y0, z, B.festival_banner);
  // What's to do, spread about inside the loop.
  const slots = [];
  for (let z = q.z0 + 4; z <= q.z1 - 4; z += 3) for (let x = q.x0 + 4; x <= q.x1 - 4; x += 3) if (Math.abs(x - mx) > 1) slots.push({ x, z });
  rng.shuffle(slots);
  const take = (pred = () => true) => {
    const i = slots.findIndex(pred);
    return i >= 0 ? slots.splice(i, 1)[0] : null;
  };
  // The carousel (a town's), in the middle.
  if (q.has('carousel') && q.size !== 'village') {
    const c = { x: mx, z: q.cz - 1 };
    q.piece(c.x, c.z, B.carousel, 'carousel');
    for (let i = slots.length - 1; i >= 0; i--) if (Math.abs(slots[i].x - c.x) <= 2 && Math.abs(slots[i].z - c.z) <= 2) slots.splice(i, 1);
    q.role('showman', c.x + 2, c.z + 1, 3, []);
  }
  if (q.has('strongman')) {
    const s = take();
    if (s) {
      q.fx(s.x, Y0, s.z, 'striker', B.high_striker);
      q.role('showman', s.x + 1, s.z + 1, 3, []);
      q.spot(s.x - 1, s.z + 1, 1, ['social', 'play']);
    }
  }
  if (q.has('fortune')) {
    const s = take();
    if (s) {
      q.fx(s.x, Y0, s.z, 'fortune', B.fortune_tent, 0);
      q.role('fortuneteller', s.x, s.z - 1, 0, []);
    }
  }
  if (q.has('games')) {
    const s = take();
    if (s) {
      q.fx(s.x, Y0, s.z, 'hoopla', B.ring_toss, 0);
      q.put(s.x + 1, Y0, s.z, B.prize_shelf);
      q.spot(s.x, s.z + 1, 2, ['play', 'social']);
    }
    const t = take();
    if (t) {
      q.fx(t.x, Y0, t.z, 'butt', B.target_butt, 0);
      q.spot(t.x, t.z + 3 <= q.z1 - 1 ? t.z + 3 : t.z + 1, 2, ['play', 'train']);
    }
  }
  if (q.has('stage')) {
    const s = take((p) => p.z <= q.cz);
    if (s) {
      for (let dx = -1; dx <= 1; dx++) q.put(s.x + dx, Y0, s.z, B.stage_floor);
      q.role('musician', s.x, s.z, 0, ['music'], { y: Y0 + 1 });
      q.spot(s.x - 1, s.z + 2, 2, ['music', 'social']);
      q.spot(s.x + 1, s.z + 2, 2, ['music', 'social']);
      q.out.stage = { ...q.area({ x0: s.x - 1, z0: s.z, x1: s.x + 1, z1: s.z }), y: Y0 + 1 };
    }
  }
  if (q.has('pens')) {
    const x0 = q.x0 + 1;
    const z0 = q.z0 + 1;
    for (let x = x0; x <= x0 + 4; x++) for (const z of [z0, z0 + 3]) q.put(x, Y0, z, B.fence);
    for (const x of [x0, x0 + 4]) for (let z = z0; z <= z0 + 3; z++) q.put(x, Y0, z, B.fence);
    q.put(x0 + 2, Y0, z0 + 3, B.air);
    q.put(x0 + 1, Y0, z0 + 1, B.hay_bale);
    q.pen(x0 + 1, z0 + 1, x0 + 3, z0 + 2, rng.pick([['sheep', 'pig'], ['cow', 'sheep'], ['pig', 'chicken']]), 3);
    q.fx(x0 + 2, Y0, z0 + 4, 'judging');
    q.spot(x0 + 3, z0 + 4, 2, ['social', 'stroll']);
  }
  // Food: a stall or two, tables before them.
  for (let k = 0; k < (q.size === 'village' ? 1 : 2); k++) {
    const s = take();
    if (!s) break;
    q.put(s.x, Y0, s.z, B.barrel);
    q.put(s.x + 1, Y0, s.z, B.counter);
    q.canopy(s.x, s.z, Y0 + 2, 0, k);
    q.canopy(s.x + 1, s.z, Y0 + 2, 0, k);
    q.role('stallholder', s.x, s.z - 1 >= q.z0 ? s.z - 1 : s.z, 0, ['market', 'shop']);
    q.put(s.x, Y0, s.z + 2, B.table);
    q.seat(s.x - 1, s.z + 2, 1);
  }
  // The travelling folk's tents round the edge.
  let c = 0;
  for (let x = q.x0 + 1; x <= q.x1 - 1; x += 4) {
    const z = q.z1 - 1;
    if (q.atGate(x, z, 2)) continue;
    q.tent(x, z, 2, c++ & 3);
  }
  q.lamp(mx - 2, q.z1, 1);
  q.lamp(mx + 2, q.z1, 1);
  q.sign(mx + 1, q.z1, 0);
}

export const TRADE = { bazaar, fair };
