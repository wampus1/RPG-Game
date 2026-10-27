// (Round 146) Places of making (see specialties.js).
//   The forge: a yard of smithies open to it, anvils and hearths and the
// quenching troughs, the grindstones; the foundry's great furnaces and
// their heaps of ore and stacks of ingots; the water wheel turning the
// hammers; the smiths' guild hall and its board of commissions; chimneys
// smoking over it all; a smith in bronze.
//   The winery: rows of vines on their trellises, the press house and its
// press, the great vats, the cellar of casks, the tasting terrace. The
// north makes mead instead (skeps among the heather, a mead hall); the high
// folk brew (barley, vats); the jade court makes rice wine (paddies, jars).
//   The apiary: skeps among the flowers, the honey house and its press,
// the meadery, the chandler's bench.
//   The quarry: the cut face of the hill stepping up behind, dressed stone
// stacked in the yard, the crane, the carts, the masons' benches and the
// statues they're freeing from the stone.
//   The shipyard: a hull on the slip, its ribs and planking, the cranes
// over it, timber stacked, rope; the shipwright's bench; the lighthouse on
// the water, the ropewalk, the fish market.
import { B } from '../blocks.js';
import { Y0, LIT } from './kit.js';

// A smithy open to the yard on its south side: back wall, roof on posts,
// the hearth, the anvil, the trough; a smith at work.
function smithy(q, x0, z0, w = 5) {
  const m = q.m;
  const x1 = x0 + w - 1;
  const z1 = z0 + 2;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) q.ground(x, z, B.cobblestone);
  for (let x = x0; x <= x1; x++) q.stack(x, z0, Y0, Y0 + 1, m.wall);
  for (const x of [x0, x1]) q.stack(x, z1, Y0, Y0 + 1, m.corner);
  for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0; z <= z1; z++) q.put(x, Y0 + 2, z, m.roof, z === z0 ? 2 : z === z1 ? 0 : 1);
  q.put(x0 + 1, Y0, z0 + 1, B.furnace, LIT);
  q.fx(x0 + 2, Y0, z0 + 1, 'anvil', B.fg_anvil ?? B.anvil, 0);
  q.put(x1 - 1, Y0, z0 + 1, B.quench_trough, 0);
  q.role('smith', x0 + 2, z0 + 2, 2, ['work']);
  // The chimney up through the roof over the hearth, smoking.
  q.stack(x0 + 1, z0, Y0 + 2, Y0 + 4, B.bricks);
  q.smoke(x0 + 1, Y0 + 5, z0);
}

function forge(q) {
  const m = q.m;
  const ember = q.fam === 'ember';
  q.fill(q.x0, q.z0, q.x1, q.z1, ember ? B.basalt_bricks : B.gravel);
  const village = q.size === 'village';
  // The smithies along the back of the yard.
  const n = village ? 1 : Math.max(1, Math.floor((q.W - 2) / 6));
  for (let k = 0; k < n; k++) smithy(q, q.x0 + 1 + k * 6, q.z0 + 1, 5);
  // The foundry: its great furnaces, ore heaped before them, ingots
  // stacked, the coal.
  const fz = q.z0 + 5;
  if ((q.has('foundry') || q.size === 'city') && !village) {
    for (let k = 0; k < (q.size === 'city' ? 2 : 1); k++) {
      const x = q.x1 - 2 - k * 3;
      q.put(x, Y0, fz, B.blast_furnace);
      q.smoke(x, Y0 + 3, fz);
      q.put(x, Y0, fz + 1, B.ore_pile);
      q.role('founder', x - 1, fz + 1, 0, ['work']);
    }
    q.put(q.x1 - 1, Y0, fz + 3, B.fg_ingots ?? B.crate);
    q.put(q.x1 - 2, Y0, fz + 3, B.fg_coalheap ?? B.coal_ore);
  }
  // The ore yard: carts and heaps by the way in.
  if (q.has('oreyard') || village) {
    q.put(q.x0 + 1, Y0, q.z1 - 1, B.ore_pile);
    q.put(q.x0 + 2, Y0, q.z1 - 1, B.mine_cart);
    if (!village) q.put(q.x0 + 1, Y0, q.z1 - 2, B.ore_pile);
  }
  // A grindstone and a whetting bench in the yard.
  q.put(q.cx - 2, Y0, q.cz, B.grindstone);
  q.role('smith', q.cx - 2, q.cz + 1, 2, ['work']);
  // The water wheel at the side, a race of water to it.
  if (q.has('waterwheel') && !village) {
    const wx = q.x0;
    const wz = q.cz;
    q.put(wx, Y0, wz, B.water_wheel, 1);
    q.ground(wx, wz + 1, B.water);
    q.ground(wx, wz - 1, B.water);
  }
  // The guild hall and its board.
  if (q.has('guild') && !village && q.W >= 15) {
    const r = { x0: q.x0 + 1, z0: q.z1 - 4, x1: q.x0 + 6, z1: q.z1 - 1 };
    const h = q.hall(r, { doors: [{ x: r.x1, z: r.z0 + 1, rot: 3 }], h: 3, use: 'guild' });
    q.put(h.ix0, Y0, h.iz0, B.table);
    q.put(h.ix0 + 1, Y0, h.iz0, B.chair, 3);
    q.put(h.ix1, Y0, h.iz1, B.chest);
    q.role('guildmaster', h.ix0 + 1, h.iz1, 0, []);
    q.fx(r.x1 + 1, Y0, r.z0, 'guild', B.guild_board);
  } else q.fx(q.cx + 2, Y0, q.z1 - 1, 'guild', B.guild_board);
  // The chimneys: tall stacks, smoking.
  if (q.has('chimneys') && !village) {
    for (const [x, z] of [[q.x1 - 1, q.z0 + 1], [q.cx + 1, q.z0 + 1]]) {
      q.stack(x, z, Y0, Y0 + 5, ember ? B.kiln_brick : B.bricks);
      q.smoke(x, Y0 + 6, z);
    }
  }
  if (q.has('statue')) q.put(q.cx, Y0, q.z1 - 2, B.statue);
  q.lamp(q.cx - 1, q.z1, 1);
  void m;
  q.sign(q.cx + 1, q.z1, 0);
}

// ------------------------------------------------------------ winery
function vineyard(q, x0, z0, x1, z1, plant = B.vine_row) {
  for (let z = z0; z <= z1; z += 2) {
    for (let x = x0; x <= x1; x++) {
      q.ground(x, z, B.farmland ?? B.dirt);
      if (plant === B.vine_row) q.fx(x, Y0, z, 'vine', B.vine_row);
      else q.put(x, Y0, z, plant);
    }
    if (z + 1 <= z1) for (let x = x0; x <= x1; x++) q.ground(x, z + 1, B.path);
  }
  for (let z = z0 + 1; z <= z1; z += 4) q.role('vintner', x0 + ((z * 3) % Math.max(1, x1 - x0)), z, 2, ['farm']);
}

function winery(q) {
  const m = q.m;
  const kind = q.fam === 'north' ? 'mead' : q.fam === 'high' ? 'brew' : q.fam === 'jade' ? 'rice' : 'wine';
  q.fill(q.x0, q.z0, q.x1, q.z1, B.grass);
  // The fields across the back (vines, heather and skeps, barley, paddies).
  const fz1 = q.z0 + Math.max(4, Math.round(q.D * 0.5));
  if (kind === 'wine') vineyard(q, q.x0 + 1, q.z0 + 1, q.x1 - 1, fz1);
  else if (kind === 'brew') vineyard(q, q.x0 + 1, q.z0 + 1, q.x1 - 1, fz1, B.wheat_crop);
  else if (kind === 'mead') {
    for (let z = q.z0 + 1; z <= fz1; z++) for (let x = q.x0 + 1; x <= q.x1 - 1; x++) {
      q.ground(x, z, B.heath ?? B.grass);
      if ((x + z) % 3 === 0) q.put(x, Y0, z, B.heather ?? B.flower_purple);
      else if ((x * 3 + z) % 7 === 0) q.fx(x, Y0, z, 'skep', B.bee_skep);
    }
    q.role('vintner', q.cx, q.z0 + 2, 2, ['farm']);
  } else {
    for (let z = q.z0 + 1; z <= fz1; z++) for (let x = q.x0 + 1; x <= q.x1 - 1; x++) {
      if ((z - q.z0) % 3 === 0) {
        q.ground(x, z, B.path);
        continue;
      }
      q.ground(x, z, B.water);
      q.put(x, Y0 - 1, z, B.water);
      if ((x + z) % 2 === 0) q.put(x, Y0, z, B.reeds);
    }
    q.role('vintner', q.cx, q.z0 + 3, 2, ['farm']);
  }
  // The press house (or the brewhouse, the mead hall), its door to the yard.
  const r = { x0: q.x0 + 1, z0: fz1 + 2, x1: Math.min(q.x1 - 1, q.x0 + 8), z1: q.z1 - 1 };
  if (r.z1 - r.z0 >= 2) {
    const h = q.hall(r, { doors: [{ x: r.x1, z: Math.round((r.z0 + r.z1) / 2), rot: 3 }], h: 3, use: kind });
    q.fx(h.ix0, Y0, h.iz0, 'press', kind === 'rice' ? B.gl_jars ?? B.barrel : B.wine_press);
    if (q.has('vats') || kind === 'brew') q.put(h.ix0 + 2, Y0, h.iz0, B.wine_vat);
    for (let x = h.ix0; x <= h.ix1; x++) if (x > h.ix0 + 2) q.fx(x, Y0, h.iz1, 'cask', B.wine_cask, 0);
    q.role('vintner', h.ix0 + 1, h.iz1, 0, ['work']);
  }
  // The cellar's casks out in the yard under a roof, the tasting terrace.
  if (q.has('tasting')) {
    const tx = Math.max(r.x1 + 3, q.cx);
    const tz = fz1 + 3;
    for (let k = 0; k < 2; k++) {
      const x = tx + k * 3;
      if (x + 1 > q.x1 - 1) break;
      q.put(x, Y0, tz, B.table);
      q.put(x - 1, Y0, tz, B.chair, 3);
      q.put(x + 1, Y0, tz, B.chair, 1);
      q.spot(x - 1, tz, 3, ['drink', 'social'], { seat: true });
      q.spot(x + 1, tz, 1, ['drink', 'social'], { seat: true });
      q.canopy(x, tz, Y0 + 2, 0, m.cloth);
    }
    q.fx(tx, Y0, tz + 2 <= q.z1 - 1 ? tz + 2 : tz - 1, 'tasting', B.wine_cask, 0);
    q.role('vintner', tx + 1, tz + 2 <= q.z1 - 1 ? tz + 2 : tz - 1, 2, ['shop']);
  }
  if (q.has('cellar')) q.fx(q.x1 - 1, Y0, q.z1 - 1, 'cellar', B.wine_cask, 2);
  if (q.has('carts')) q.put(q.x1 - 2, Y0, fz1 + 1, B.gl_cart ?? B.crate, 1);
  q.lamp(q.cx - 1, q.z1, 1);
  q.sign(q.cx + 1, q.z1, 0);
}

// ------------------------------------------------------------ apiary
function apiary(q) {
  q.fill(q.x0, q.z0, q.x1, q.z1, B.grass_lush);
  const flowers = [B.flower_yellow, B.flower_purple, B.flower_white, B.flower_blue, B.heather ?? B.flower_red];
  for (let z = q.z0 + 1; z <= q.z1 - 4; z++) for (let x = q.x0 + 1; x <= q.x1 - 1; x++) {
    if ((x * 7 + z * 5) % 9 === 0) q.fx(x, Y0, z, 'skep', B.bee_skep);
    else if ((x + z) % 2 === 0) q.put(x, Y0, z, flowers[(x * 3 + z) % flowers.length]);
  }
  q.role('beekeeper', q.cx, q.z0 + 2, 2, ['farm']);
  q.role('beekeeper', q.cx - 3, q.z0 + 4, 2, ['farm']);
  // The honey house.
  const r = { x0: q.x1 - 6, z0: q.z1 - 3, x1: q.x1 - 1, z1: q.z1 - 1 };
  const h = q.hall(r, { doors: [{ x: r.x0, z: r.z0 + 1, rot: 1 }], h: 2, roof: B.thatch, use: 'honey' });
  q.fx(h.ix1, Y0, h.iz0, 'press', B.wine_press);
  if (q.has('meadery')) q.fx(h.ix0 + 1, Y0, h.iz0, 'mead', B.wine_cask, 0);
  if (q.has('candles')) {
    q.put(h.ix0 + 2 <= h.ix1 ? h.ix0 + 2 : h.ix1, Y0, h.iz0, B.table);
    q.put(h.ix0 + 2 <= h.ix1 ? h.ix0 + 2 : h.ix1, Y0 + 1, h.iz0, B.candles, LIT);
  }
  q.role('beekeeper', h.ix0, h.iz0, 0, ['work']);
  q.fx(r.x0 - 1, Y0, r.z1, 'honeystall', B.counter);
  q.put(q.x0 + 1, Y0, q.z1 - 1, B.bench, 0);
  q.spot(q.x0 + 1, q.z1 - 1, 0, ['rest', 'sketch']);
  q.sign(q.cx, q.z1, 0);
}

// ------------------------------------------------------------ quarry
function quarry(q) {
  q.fill(q.x0, q.z0, q.x1, q.z1, B.gravel);
  // The cut face, stepping up toward the back.
  const face = Math.max(3, Math.round(q.D * 0.4));
  for (let z = q.z0; z < q.z0 + face; z++) {
    const h = Math.min(5, q.z0 + face - z);
    for (let x = q.x0; x <= q.x1; x++) {
      const notch = (x * 5 + z * 3) % 7 === 0 ? 1 : 0;
      q.stack(x, z, Y0, Y0 + Math.max(0, h - 1 - notch), B.cut_stone);
    }
  }
  const yz = q.z0 + face;
  // Masons at the face with their picks.
  for (let x = q.x0 + 2; x <= q.x1 - 2; x += 5) q.role('mason', x, yz, 2, ['mine']);
  // Dressed stone stacked, the crane over it, carts.
  if (q.has('crane')) q.put(q.x1 - 2, Y0, yz + 1, B.yard_crane, 0);
  for (let x = q.x0 + 1; x <= q.x0 + 4; x += 2) q.put(x, Y0, yz + 2, B.stone_blocks);
  if (q.has('carts')) q.put(q.x0 + 1, Y0, q.z1 - 1, B.mine_cart);
  // The masons' benches, the statues coming out of the stone.
  q.fx(q.cx, Y0, q.z1 - 2, 'mason', B.mason_bench, 0);
  q.role('mason', q.cx, q.z1 - 3, 0, ['work']);
  if (q.has('masons')) q.role('mason', q.cx - 2, q.z1 - 3, 0, ['work']);
  if (q.has('statues')) {
    q.put(q.cx + 3, Y0, q.z1 - 2, B.rough_statue);
    q.fx(q.cx - 3, Y0, q.z1 - 2, 'statue', B.statue);
  }
  q.lamp(q.cx - 1, q.z1, 1);
  q.sign(q.cx + 1, q.z1, 0);
}

// ------------------------------------------------------------ shipyard
// A hull on the slip: keel, ribs half planked, the stem and stern posts,
// the scaffold beside it.
function hull(q, x0, z0, len, beam) {
  const cz = z0 + Math.floor(beam / 2);
  // (The fore part planked already, the rest still ribs.)
  const planked = (x) => x - x0 < len * 0.6;
  for (let x = x0; x < x0 + len; x++) {
    const t = (x - x0) / (len - 1);
    const half = Math.max(0, Math.round((beam / 2) * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05))));
    q.put(x, Y0, cz, B.log_oak);
    for (let dz = -half; dz <= half; dz++) {
      if (!dz) continue;
      const side = Math.abs(dz) === half;
      if (side) q.stack(x, cz + dz, Y0, Y0 + 1, planked(x) ? B.hull_planks : (x % 2 ? B.planks_dark : B.air));
      else if (x % 3 === 0 && !planked(x)) q.put(x, Y0, cz + dz, B.planks_dark);
    }
    if (planked(x) && half) for (let dz = -half + 1; dz <= half - 1; dz++) q.put(x, Y0 + 1, cz + dz, B.deck_planks ?? B.planks);
  }
  q.stack(x0, cz, Y0, Y0 + 2, B.log_oak);
  q.stack(x0 + len - 1, cz, Y0, Y0 + 3, B.log_oak);
  q.stack(x0 + Math.floor(len * 0.4), cz, Y0 + 2, Y0 + 4, B.ship_mast ?? B.log_oak);
}

function shipyard(q) {
  q.fill(q.x0, q.z0, q.x1, q.z1, B.planks_drift ?? B.planks);
  // The slip, down toward the water (the back of the lot, where the shore
  // is, if it is), the hull on it.
  const len = Math.min(q.W - 6, q.size === 'city' ? 15 : 11);
  const beam = q.size === 'city' ? 7 : 5;
  const hx = q.x0 + 2;
  const hz = q.z0 + 1;
  for (let z = hz; z < hz + beam; z++) for (let x = hx - 1; x <= hx + len; x++) q.ground(x, z, B.gravel);
  hull(q, hx, hz, len, beam);
  q.fx(hx + len, Y0, hz + Math.floor(beam / 2), 'hull');
  for (let x = hx + 1; x < hx + len; x += 3) q.role('shipwright', x, hz + beam, 2, ['work']);
  // Cranes beside it.
  if (q.has('crane')) for (let x = hx + 2; x < hx + len; x += 6) q.put(x, Y0, hz + beam + 1, B.yard_crane, 2);
  // Timber stacked, rope, tar.
  const yz = hz + beam + 2;
  for (let x = q.x0 + 1; x <= q.x0 + 3; x++) q.put(x, Y0, q.z1 - 1, B.log_oak);
  q.put(q.x0 + 4, Y0, q.z1 - 1, B.rope_coil);
  q.put(q.x0 + 5, Y0, q.z1 - 1, B.barrel);
  // The shipwright's bench (see ui/shipdesign.js: a ship made to your
  // plan) under a roof.
  q.fx(q.cx, Y0, yz, 'shipwright', B.shipwright_bench);
  q.role('shipwright', q.cx + 1, yz, 3, ['work']);
  // The ropewalk: a long shed down the side.
  if (q.has('ropewalk') && q.x1 - (hx + len) >= 3) {
    const r = { x0: q.x1 - 2, z0: q.z0 + 1, x1: q.x1, z1: q.z1 - 2 };
    q.hall(r, { doors: [{ x: r.x0, z: r.z1 - 1, rot: 1 }], h: 2, use: 'ropewalk' });
    q.put(r.x0 + 1, Y0, r.z0 + 1, B.rope_coil);
  }
  // The fish market's stalls by the way in.
  if (q.has('fishmarket')) {
    for (let k = 0; k < 2; k++) {
      const x = q.cx + 3 + k * 3;
      if (x + 1 >= q.x1) break;
      q.put(x, Y0, q.z1 - 2, B.crate_fish ?? B.crate);
      q.put(x + 1, Y0, q.z1 - 2, B.counter);
      q.canopy(x, q.z1 - 2, Y0 + 2, 0, 1);
      q.canopy(x + 1, q.z1 - 2, Y0 + 2, 0, 1);
      q.role('stallholder', x, q.z1 - 3, 0, ['market', 'shop']);
    }
  }
  // The light, at the corner nearest the water.
  if (q.has('lighthouse')) {
    const lx = q.x1 - 1;
    const lz = q.z0 + 1;
    q.tower(lx - 1, lz, 2, 7, q.m.wall);
    for (const [dx, dz] of [[-1, 0], [0, 0], [-1, 1], [0, 1]]) q.put(lx + dx, Y0 + 7, lz + dz, B.glass);
    q.put(lx, Y0 + 8, lz, B.beacon, LIT);
    q.fx(lx, Y0 + 8, lz, 'lighthouse');
  }
  q.lamp(q.cx - 2, q.z1, 1);
  q.sign(q.cx + 2, q.z1, 0);
}

export const CRAFT = { forge, winery, apiary, quarry, shipyard };
