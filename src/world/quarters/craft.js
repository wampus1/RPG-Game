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
import { M } from '../settlement.js';

// Free ground at (x, z) in the quarter (nothing put there yet, not in the
// way in).
const open = (q, x, z) => q.inLot(x, z) && q.at(x, Y0, z) === undefined && !q.atGate(x, z, 1, 3);
// A few of `ids` scattered over a rectangle's free ground.
function scatter(q, x0, z0, x1, z1, ids, n) {
  const rng = q.rng;
  for (let k = 0, tries = 0; k < n && tries < n * 8; tries++) {
    const x = rng.int(x0, x1);
    const z = rng.int(z0, z1);
    if (!open(q, x, z)) continue;
    q.put(x, Y0, z, rng.pick(ids), rng.int(0, 3));
    k++;
  }
}

// A smithy open to the yard on its south side: back wall hung with tools,
// roof on posts, the hearth and its bellows, the anvil, the trough; a
// smith at work.
function smithy(q, x0, z0, w = 5) {
  const m = q.m;
  const x1 = x0 + w - 1;
  const z1 = z0 + 2;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) q.ground(x, z, B.cobblestone);
  for (let x = x0; x <= x1; x++) q.stack(x, z0, Y0, Y0 + 1, m.wall);
  for (const x of [x0, x1]) q.stack(x, z1, Y0, Y0 + 1, m.corner);
  for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0; z <= z1; z++) q.put(x, Y0 + 2, z, m.roof, z === z0 ? 2 : z === z1 ? 0 : 1);
  q.put(x0, Y0, z0 + 1, B.fg_bellows ?? B.barrel, 1);
  q.put(x0 + 1, Y0, z0 + 1, B.furnace, LIT);
  q.fx(x0 + 2, Y0, z0 + 1, 'anvil', B.fg_anvil ?? B.anvil, 0);
  q.put(x1 - 1, Y0, z0 + 1, B.quench_trough, 0);
  if (w >= 5) q.put(x1, Y0, z0 + 1, q.rng.pick([B.tool_rack, B.weapon_rack, B.shield_rack].filter((b) => b !== undefined)), 2);
  q.role('smith', x0 + 2, z0 + 2, 2, ['work']);
  // The chimney up through the roof over the hearth, smoking.
  q.stack(x0 + 1, z0, Y0 + 2, Y0 + 4, B.bricks);
  q.smoke(x0 + 1, Y0 + 5, z0);
}

// An anvil out in the yard: the block, the trough, a rack, the smith.
function yardAnvil(q, x, z) {
  if (![x - 1, x, x + 1].every((xx) => open(q, xx, z) && open(q, xx, z + 1))) return false;
  q.ground(x, z, B.cobblestone);
  q.fx(x, Y0, z, 'anvil', B.fg_anvil ?? B.anvil, 0);
  q.put(x + 1, Y0, z, B.quench_trough, 0);
  q.put(x - 1, Y0, z, q.rng.chance(0.5) ? B.fg_coalheap ?? B.coal_ore : B.grindstone);
  q.role('smith', x, z + 1, 2, ['work']);
  return true;
}

function forge(q) {
  const ember = q.fam === 'ember';
  const village = q.size === 'village';
  q.fill(q.x0, q.z0, q.x1, q.z1, ember ? B.basalt_bricks : B.gravel);
  // The lanes: up from the way in, and across in front of the smithies.
  for (let z = q.z0 + 4; z <= q.z1; z++) q.ground(q.cx, z, B.cobblestone);
  for (let x = q.x0 + 1; x <= q.x1 - 1; x++) q.ground(x, q.z0 + 4, B.cobblestone);
  // The smithies along the back of the yard.
  const n = village ? 1 : Math.max(1, Math.floor((q.W - 2) / 6));
  for (let k = 0; k < n; k++) smithy(q, q.x0 + 1 + k * 6, q.z0 + 1, 5);
  // The foundry along the east side: its great furnaces with the crucibles
  // before them, the casting floor of sand, ore heaped, coal, the ingots
  // stacked, the carts.
  const fz = q.z0 + 5;
  if ((q.has('foundry') || q.size === 'city') && !village) {
    for (let k = 0; k < (q.size === 'city' ? 2 : 1); k++) {
      const x = q.x1 - 2 - k * 3;
      q.put(x, Y0, fz, B.blast_furnace);
      q.fx(x, Y0, fz, 'furnace');
      q.smoke(x, Y0 + 3, fz);
      q.put(x, Y0, fz + 1, B.fg_crucible ?? B.cauldron ?? B.furnace);
      q.ground(x - 1, fz + 2, B.sand);
      q.ground(x, fz + 2, B.sand);
      q.fx(x, Y0, fz + 2, 'pour');
      q.put(x + 1, Y0, fz, B.ore_pile);
      q.role('founder', x - 1, fz + 1, 0, ['work']);
    }
    q.put(q.x1 - 1, Y0, fz + 4, B.fg_ingots ?? B.crate);
    q.put(q.x1 - 2, Y0, fz + 4, B.fg_ingots ?? B.crate);
    q.put(q.x1 - 1, Y0, fz + 5, B.fg_coalheap ?? B.coal_ore);
    q.put(q.x1 - 3, Y0, fz + 5, B.fg_cart ?? B.mine_cart, 1);
  }
  // The ore yard: carts and heaps by the way in.
  if (q.has('oreyard') || village) {
    q.put(q.x0 + 1, Y0, q.z1 - 1, B.ore_pile);
    q.put(q.x0 + 2, Y0, q.z1 - 1, B.mine_cart);
    if (!village) {
      q.put(q.x0 + 1, Y0, q.z1 - 2, B.ore_pile);
      q.put(q.x0 + 3, Y0, q.z1 - 1, B.fg_coalheap ?? B.coal_ore);
    }
  }
  // Anvils out in the yard, a smith at each.
  const ax = [q.cx - 3, q.cx + 3, q.cx - 3];
  const az = [q.z0 + 6, q.z0 + 6, q.z0 + 9];
  for (let k = 0; k < (village ? 1 : q.size === 'city' ? 3 : 2); k++) if (az[k] + 1 < q.z1 - 1) yardAnvil(q, ax[k], az[k]);
  // The grindstone and the whetting bench.
  if (open(q, q.cx - 1, q.cz + 1)) q.put(q.cx - 1, Y0, q.cz + 1, B.grindstone);
  // The water wheel at the side, a race of water to it, the trip hammer it
  // drives.
  if (q.has('waterwheel') && !village) {
    const wx = q.x0;
    const wz = q.cz;
    q.put(wx, Y0, wz, B.water_wheel, 1);
    q.ground(wx, wz + 1, B.water);
    q.ground(wx, wz - 1, B.water);
    if (open(q, wx + 1, wz)) q.put(wx + 1, Y0, wz, B.fg_hammer ?? B.anvil);
  }
  // The guild hall and its board (or the board on its own by the lane).
  if (q.has('guild') && !village && q.W >= 15) {
    const r = { x0: q.x0 + 1, z0: q.z1 - 4, x1: q.x0 + 6, z1: q.z1 - 1 };
    const h = q.hall(r, { doors: [{ x: r.x1, z: r.z0 + 1, rot: 3 }], h: 3, use: 'guild', clear: true });
    q.put(h.ix0, Y0, h.iz0, B.table);
    q.put(h.ix0 + 1, Y0, h.iz0, B.chair, 3);
    q.put(h.ix1, Y0, h.iz1, B.chest);
    q.put(h.ix0, Y0, h.iz1, B.fg_banner ?? B.bookshelf);
    q.role('guildmaster', h.ix0 + 1, h.iz1, 0, []);
    q.fx(r.x1 + 1, Y0, r.z0, 'guild', B.guild_board);
  } else q.fx(q.cx + 2, Y0, q.z1 - 1, 'guild', B.guild_board);
  // The smiths' own wares, set out for sale by the way in.
  const sx = q.cx + 2;
  const sz = q.z1 - 2;
  if (open(q, sx, sz) && open(q, sx + 1, sz)) {
    q.put(sx, Y0, sz, B.weapon_rack, 0);
    q.put(sx + 1, Y0, sz, B.armour_stand ?? B.display_stand, 0);
    if (open(q, sx + 2, sz)) q.put(sx + 2, Y0, sz, B.shield_rack ?? B.weapon_rack, 0);
  }
  // The chimneys: tall stacks, smoking.
  if (q.has('chimneys') && !village) {
    for (const [x, z] of [[q.x1 - 1, q.z0 + 1], [q.cx + 1, q.z0 + 1]]) {
      if (q.at(x, Y0, z) !== undefined && q.at(x, Y0, z) !== q.m.wall) continue;
      q.stack(x, z, Y0, Y0 + 5, ember ? B.kiln_brick : B.bricks);
      q.smoke(x, Y0 + 6, z);
    }
  }
  if (q.has('statue') && open(q, q.cx, q.z1 - 3)) q.put(q.cx, Y0, q.z1 - 3, B.fg_statue ?? B.statue);
  // Stock about the yard: barrels of water, crates, coal, iron.
  scatter(q, q.x0 + 1, q.z0 + 5, q.x1 - 1, q.z1 - 1, [B.barrel, B.crate, B.crate_open ?? B.crate, B.fg_coalheap ?? B.coal_ore, B.ore_pile], village ? 2 : q.size === 'city' ? 5 : 3);
  q.brazier(q.cx - 1, q.z1);
  q.lamp(q.x1 - 1, q.z1 - 1, 1);
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
  // The fields across the back (vines, heather and skeps, barley, paddies),
  // leaving the yard before them room for the press house.
  const fz1 = q.z0 + Math.max(3, Math.min(Math.round(q.D * 0.5), q.D - 8));
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
  // (Two paces inside at least: the press and the casks along the back
  // wall, a way along the front of them from the door.)
  const r = { x0: q.x0 + 1, z0: fz1 + 2, x1: Math.min(q.x1 - 1, q.x0 + 8), z1: Math.min(q.z1 - 1, fz1 + 5) };
  if (r.z1 - r.z0 >= 3) {
    const h = q.hall(r, { doors: [{ x: r.x1, z: r.z1 - 1, rot: 3 }], h: 3, use: kind });
    q.fx(h.ix0, Y0, h.iz0, 'press', kind === 'rice' ? B.gl_jars ?? B.barrel : B.wine_press);
    if (q.has('vats') || kind === 'brew') q.put(h.ix0 + 2, Y0, h.iz0, B.wine_vat);
    for (let x = h.ix0 + 3; x <= h.ix1; x++) q.fx(x, Y0, h.iz0, 'cask', B.wine_cask, 2);
    q.role('vintner', h.ix0 + 1, h.iz1, 2, ['work']);
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
  for (let z = q.z0 + 1; z <= q.z1 - 5; z++) for (let x = q.x0 + 1; x <= q.x1 - 1; x++) {
    if ((x * 7 + z * 5) % 9 === 0) q.fx(x, Y0, z, 'skep', B.bee_skep);
    else if ((x + z) % 2 === 0) q.put(x, Y0, z, flowers[(x * 3 + z) % flowers.length]);
  }
  q.role('beekeeper', q.cx, q.z0 + 2, 2, ['farm']);
  q.role('beekeeper', q.cx - 3, q.z0 + 4, 2, ['farm']);
  // The honey house.
  // (Two paces inside: the press, the mead and the chandler's table along
  // the back, a way along the front of them from the door.)
  const r = { x0: q.x1 - 6, z0: q.z1 - 4, x1: q.x1 - 1, z1: q.z1 - 1 };
  const h = q.hall(r, { doors: [{ x: r.x0, z: r.z1 - 1, rot: 1 }], h: 2, roof: B.thatch, use: 'honey' });
  q.fx(h.ix1, Y0, h.iz0, 'press', B.wine_press, 2);
  if (q.has('meadery')) q.fx(h.ix0 + 1, Y0, h.iz0, 'mead', B.wine_cask, 2);
  if (q.has('candles') && h.ix0 + 2 < h.ix1) {
    q.put(h.ix0 + 2, Y0, h.iz0, B.table);
    q.put(h.ix0 + 2, Y0 + 1, h.iz0, B.candles, LIT);
  }
  q.role('beekeeper', h.ix0 + 1, h.iz1, 2, ['work']);
  q.fx(r.x0 - 1, Y0, r.z1, 'honeystall', B.counter);
  q.put(q.x0 + 1, Y0, q.z1 - 1, B.bench, 0);
  q.spot(q.x0 + 1, q.z1 - 1, 0, ['rest', 'sketch']);
  q.sign(q.cx, q.z1, 0);
}

// ------------------------------------------------------------ quarry
function quarry(q) {
  const rng = q.rng;
  q.fill(q.x0, q.z0, q.x1, q.z1, B.gravel);
  // The cut face, stepping up toward the back in ledges, the stone in its
  // beds (a darker seam here and there), cut square where blocks have come
  // out of it.
  const face = Math.max(4, Math.round(q.D * 0.42));
  const seam = rng.int(1, 3);
  const ramp = rng.chance(0.5) ? q.x0 + 1 : q.x1 - 1;
  for (let z = q.z0; z < q.z0 + face; z++) {
    const ledge = Math.floor((q.z0 + face - z - 1) / 1.5);
    for (let x = q.x0; x <= q.x1; x++) {
      const cut = (x * 7 + z * 5 + q.i) % 9 === 0 ? 1 : 0;
      const h = Math.min(5, Math.max(0, ledge + 1 - cut));
      for (let y = Y0; y < Y0 + h; y++) q.put(x, y, z, y - Y0 === seam ? B.cobblestone : (x + z) % 5 === 0 ? B.stone : B.cut_stone);
      if (h === 0) q.ground(x, z, B.cut_stone);
    }
  }
  // A way up the ledges at one side: steps cut in the stone.
  for (let z = q.z0; z < q.z0 + face; z++) {
    const h = Math.min(5, Math.floor((q.z0 + face - z - 1) / 1.5) + 1);
    for (let y = Y0; y < Y0 + 6; y++) q.put(ramp, y, z, B.air);
    for (let y = Y0; y < Y0 + h - 1; y++) q.put(ramp, y, z, B.cut_stone);
    if (h > 0) q.put(ramp, Y0 + h - 1, z, q.m.stairs, 0);
  }
  const yz = q.z0 + face;
  // Ladders and scaffolds against the face; the masons on the ledges with
  // their picks.
  for (let x = q.x0 + 3; x <= q.x1 - 3; x += 4) {
    if (x === ramp) continue;
    if (rng.chance(0.5)) q.put(x, Y0, yz - 1, B.ladder, 2);
    else q.stack(x, yz, Y0, Y0 + 1, B.hold_scaffold ?? B.planks);
  }
  for (let x = q.x0 + 2; x <= q.x1 - 2; x += 5) if (q.at(x, Y0, yz) === undefined) q.role('mason', x, yz, 2, ['mine']);
  // The crane at the foot of the face, a block in its sling; dressed stone
  // stacked in rows; the carts and their track down to the way in.
  if (q.has('crane')) q.put(q.x1 - 3, Y0, yz + 1, B.yard_crane, 0);
  for (let x = q.x0 + 1; x <= q.x0 + Math.min(6, q.W - 6); x += 1) if ((x - q.x0) % 3 !== 0) q.put(x, Y0, yz + 2, B.stone_blocks);
  for (let x = q.x0 + 1; x <= q.x0 + 4; x += 1) if (x % 2) q.put(x, Y0, yz + 3, B.stone_blocks);
  if (q.has('carts')) {
    for (let z = yz + 1; z <= q.z1; z++) q.ground(q.cx + 2, z, B.cobblestone);
    q.put(q.cx + 2, Y0, yz + 2, B.mine_cart, 0);
    q.put(q.cx + 2, Y0, q.z1 - 2, B.sw_cart ?? B.mine_cart, 0);
  }
  // The masons' yard: benches under awnings, the statues coming out of
  // the stone, the tools on their racks, water for the saws.
  const bz = q.z1 - 2;
  for (const dx of [-3, 0]) {
    const x = q.cx + dx;
    if (q.at(x, Y0, bz) !== undefined) continue;
    q.fx(x, Y0, bz, 'mason', B.mason_bench, 0);
    q.canopy(x, bz, Y0 + 2, 0, 2);
    q.canopy(x + 1, bz, Y0 + 2, 0, 2);
    q.role('mason', x, bz - 1, 0, ['work']);
  }
  if (q.has('statues')) {
    if (q.at(q.cx + 4, Y0, bz) === undefined) q.put(q.cx + 4, Y0, bz, B.rough_statue);
    if (q.at(q.cx - 5, Y0, bz) === undefined) q.fx(q.cx - 5, Y0, bz, 'statue', B.statue);
  }
  if (q.at(q.x1 - 1, Y0, q.z1 - 1) === undefined) q.put(q.x1 - 1, Y0, q.z1 - 1, B.tool_rack ?? B.workbench, 0);
  scatter(q, q.x0 + 1, yz + 1, q.x1 - 1, q.z1 - 1, [B.rubble ?? B.cobblestone, B.barrel, B.crate], 4);
  q.lamp(q.cx - 1, q.z1, 1);
  q.sign(q.cx + 1, q.z1, 0);
}

// ------------------------------------------------------------ shipyard
// A hull on the slip: keel, ribs half planked, the stem and stern posts,
// the mast stepped, scaffolds and a ladder beside it.
function hull(q, x0, z0, len, beam, bowEast = true) {
  const cz = z0 + Math.floor(beam / 2);
  // (The fore part planked already, the rest still ribs.)
  const fore = (x) => (bowEast ? x - x0 : x0 + len - 1 - x);
  const planked = (x) => fore(x) >= len * 0.4;
  for (let x = x0; x < x0 + len; x++) {
    const t = fore(x) / (len - 1);
    const half = Math.max(0, Math.round((beam / 2) * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.08))));
    q.put(x, Y0, cz, B.log_oak);
    for (let dz = -half; dz <= half; dz++) {
      if (!dz) continue;
      const side = Math.abs(dz) === half;
      if (side) q.stack(x, cz + dz, Y0, Y0 + 1, planked(x) ? B.hull_planks : (x % 2 ? B.planks_dark : B.air));
      else if (x % 3 === 0 && !planked(x)) q.put(x, Y0, cz + dz, B.planks_dark);
    }
    if (planked(x) && half) for (let dz = -half + 1; dz <= half - 1; dz++) q.put(x, Y0 + 1, cz + dz, B.deck_planks ?? B.planks);
    // Scaffolds along her sides where the planking's going on.
    if (!planked(x) && x % 2 === 0) for (const dz of [-half - 1, half + 1]) if (q.inLot(x, cz + dz)) q.stack(x, cz + dz, Y0, Y0 + 1, B.hold_scaffold ?? B.planks);
  }
  const stern = bowEast ? x0 : x0 + len - 1;
  const stem = bowEast ? x0 + len - 1 : x0;
  q.stack(stern, cz, Y0, Y0 + 2, B.log_oak);
  q.stack(stem, cz, Y0, Y0 + 3, B.log_oak);
  q.stack(x0 + Math.floor(len * 0.5), cz, Y0 + 2, Y0 + 5, B.ship_mast ?? B.log_oak);
  q.put(stem + (bowEast ? -1 : 1), Y0, cz + Math.floor(beam / 2) + 1, B.ladder, 2);
  return cz;
}

// Which side of the lot (as it's drawn up) the water's on, if any.
function waterSide(q) {
  const wet = (x, z) => {
    const p = q.pt(x, z);
    return q.L.maskAt(p.x, p.z) === M.WATER;
  };
  const n = { n: 0, s: 0, w: 0, e: 0 };
  for (let k = 1; k <= 3; k++) {
    for (let x = q.x0; x <= q.x1; x++) {
      if (wet(x, q.z0 - k)) n.n++;
      if (wet(x, q.z1 + k)) n.s++;
    }
    for (let z = q.z0; z <= q.z1; z++) {
      if (wet(q.x0 - k, z)) n.w++;
      if (wet(q.x1 + k, z)) n.e++;
    }
  }
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'n';
}

function shipyard(q) {
  const rng = q.rng;
  q.fill(q.x0, q.z0, q.x1, q.z1, B.gravel);
  const side = waterSide(q);
  const city = q.size === 'city';
  const len = Math.min(q.W - 6, city ? 15 : 11);
  const beam = city ? 7 : 5;
  // The slip: down to the water's edge, the hull on it, its bow away from
  // the water (she goes in stern first).
  let hx = q.x0 + 2;
  let hz = q.z0 + 1;
  let bowEast = true;
  if (side === 'w') {
    hx = q.x0 + 1;
    hz = q.cz - Math.floor(beam / 2) - 1;
  } else if (side === 'e') {
    hx = q.x1 - len;
    hz = q.cz - Math.floor(beam / 2) - 1;
    bowEast = false;
  } else if (side === 's') hz = q.z1 - beam - 3;
  hz = Math.max(q.z0 + 1, Math.min(hz, q.z1 - beam - 3));
  for (let z = hz - 1; z <= hz + beam; z++) for (let x = hx - 1; x <= hx + len; x++) if (q.inLot(x, z)) q.ground(x, z, B.hold_planks ?? B.planks);
  const cz = hull(q, hx, hz, len, beam, bowEast);
  q.fx(bowEast ? hx + len : hx - 1, Y0, cz, 'hull');
  for (let x = hx + 1; x < hx + len; x += 3) q.role('shipwright', x, hz + beam, 2, ['work']);
  // The quay along the water: planking, posts, a boat tied up, nets drying,
  // an anchor.
  const edge = [];
  if (side === 'n' || side === 's') {
    const z = side === 'n' ? q.z0 : q.z1;
    for (let x = q.x0; x <= q.x1; x++) edge.push([x, z]);
  } else {
    const x = side === 'w' ? q.x0 : q.x1;
    for (let z = q.z0; z <= q.z1; z++) edge.push([x, z]);
  }
  edge.forEach(([x, z], k) => {
    if (q.at(x, Y0, z) !== undefined || q.atGate(x, z, 1, 2)) return;
    q.ground(x, z, B.planks_drift ?? B.planks);
    if (k % 5 === 0) q.put(x, Y0, z, B.fence);
    else if (k % 7 === 3) q.put(x, Y0, z, rng.pick([B.bc_nets ?? B.crate, B.gt_net ?? B.crate, B.lv_anchor ?? B.barrel, B.rope_coil]));
  });
  // The timber yard on the far side of the slip from the water: logs and
  // sawn planks stacked to season, the saw-bench, the steaming of planks.
  const ty = side === 'n' ? q.z1 - 2 : side === 's' ? q.z0 + 1 : q.z1 - 2;
  const tx0 = side === 'e' ? q.x0 + 1 : side === 'w' ? q.x1 - 6 : q.x0 + 1;
  for (let k = 0; k < 5; k++) {
    const x = tx0 + k;
    if (!open(q, x, ty)) continue;
    if (k < 2) q.stack(x, ty, Y0, Y0 + (k === 0 ? 1 : 0), B.log_oak);
    else if (k < 4) q.stack(x, ty, Y0, Y0 + 1, B.sw_planks ?? B.planks);
    else q.put(x, Y0, ty, B.sawbench ?? B.workbench, 0);
  }
  if (open(q, tx0 + 4, ty - 1)) q.role('shipwright', tx0 + 4, ty - 1, 0, ['work']);
  // Tar: the pot on its fire, barrels.
  const px = side === 'e' ? q.x0 + 2 : q.x1 - 2;
  if (open(q, px, q.cz + 2)) {
    q.put(px, Y0, q.cz + 2, B.hold_cauldron ?? B.barrel);
    if (open(q, px, q.cz + 3)) q.put(px, Y0, q.cz + 3, B.barrel);
    q.smoke(px, Y0 + 2, q.cz + 2);
  }
  // Cranes over the slip.
  if (q.has('crane')) for (let x = hx + 2; x < hx + len; x += 6) if (open(q, x, hz + beam + 1)) q.put(x, Y0, hz + beam + 1, B.yard_crane, 2);
  // The shipwright's bench (see ui/shipdesign.js: a ship made to your
  // plan) under an awning, by the way in.
  const bx = q.cx;
  const bz = q.z1 - 3;
  if (open(q, bx, bz)) {
    q.fx(bx, Y0, bz, 'shipwright', B.shipwright_bench);
    q.canopy(bx, bz, Y0 + 2, 0, 1);
    q.canopy(bx + 1, bz, Y0 + 2, 0, 1);
    q.role('shipwright', bx + 1, bz, 3, ['work']);
  }
  // The ropewalk: a long shed down the side away from the water.
  if (q.has('ropewalk')) {
    const r = side === 'e' ? { x0: q.x0, z0: q.z0 + 1, x1: q.x0 + 2, z1: q.z1 - 3 } : { x0: q.x1 - 2, z0: q.z0 + 1, x1: q.x1, z1: q.z1 - 3 };
    let clear = true;
    for (let z = r.z0; z <= r.z1 && clear; z++) for (let x = r.x0; x <= r.x1; x++) if (q.at(x, Y0, z) !== undefined) clear = false;
    if (clear && r.z1 - r.z0 >= 4) {
      q.hall(r, { doors: [{ x: side === 'e' ? r.x1 : r.x0, z: r.z1 - 1, rot: side === 'e' ? 3 : 1 }], h: 2, use: 'ropewalk' });
      q.put(r.x0 + 1, Y0, r.z0 + 1, B.rope_coil);
      q.put(r.x0 + 1, Y0, r.z0 + 3, B.rope_coil);
    }
  }
  // The fish market's stalls by the way in.
  if (q.has('fishmarket')) {
    for (let k = 0; k < 2; k++) {
      const x = q.cx + 3 + k * 3;
      if (x + 1 >= q.x1 || !open(q, x, q.z1 - 2) || !open(q, x + 1, q.z1 - 2)) continue;
      q.put(x, Y0, q.z1 - 2, B.crate_fish ?? B.crate);
      q.put(x + 1, Y0, q.z1 - 2, B.counter);
      q.canopy(x, q.z1 - 2, Y0 + 2, 0, 1);
      q.canopy(x + 1, q.z1 - 2, Y0 + 2, 0, 1);
      q.role('stallholder', x, q.z1 - 3, 0, ['market', 'shop']);
    }
  }
  // The light, at the corner by the water.
  if (q.has('lighthouse')) {
    const lx = side === 'w' ? q.x0 + 1 : q.x1 - 1;
    const lz = side === 's' ? q.z1 - 2 : q.z0 + 1;
    let clear = true;
    for (const [dx, dz] of [[-1, 0], [0, 0], [-1, 1], [0, 1]]) if (q.at(lx + dx, Y0, lz + dz) !== undefined && q.at(lx + dx, Y0, lz + dz) !== B.fence) clear = false;
    if (clear) {
      q.tower(lx - 1, lz, 2, 7, q.m.wall);
      for (const [dx, dz] of [[-1, 0], [0, 0], [-1, 1], [0, 1]]) q.put(lx + dx, Y0 + 7, lz + dz, B.glass);
      q.put(lx, Y0 + 8, lz, B.beacon, LIT);
      q.fx(lx, Y0 + 8, lz, 'lighthouse');
    }
  }
  scatter(q, q.x0 + 1, q.z0 + 1, q.x1 - 1, q.z1 - 1, [B.barrel, B.crate, B.rope_coil, B.sw_sacks ?? B.crate], city ? 7 : 4);
  q.lamp(q.cx - 2, q.z1, 1);
  q.sign(q.cx + 2, q.z1, 0);
}

export const CRAFT = { forge, winery, apiary, quarry, shipyard };
