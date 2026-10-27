// (Round 146) What's under the town, and what's older than it (see
// specialties.js).
//   The delve: the way down into the old place under the town, a ring of
// dressed stone round its shaft and a windlass over it (go down it: see
// game.useOldPlace and sim/cities.js, which makes it a dungeon of its
// own); round it a yard behind a barricade, the delvers' guild hall with
// its board of contracts and its tables, the relics brought up set out on
// stands, the alarm bell, the infirmary, the memorial to those who didn't
// come back; supplies stacked, lanterns all round.
//   The ruins: the town grew up among them. Broken walls of old stone, the
// stumps of a colonnade, a gate that leads nowhere now, the colossus's
// head fallen in the grass; the dig with its trenches and tents and the
// finds table; the stone with the old writing on it; the sealed vault; ivy
// and bushes over everything.
import { B } from '../blocks.js';
import { Y0, LIT } from './kit.js';

function delve(q) {
  const m = q.m;
  q.fill(q.x0, q.z0, q.x1, q.z1, B.cobblestone);
  const mx = q.cx;
  const mz = q.cz - 1;
  // The ring round the shaft, the way down in it.
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) q.ground(mx + dx, mz + dz, B.flagstone);
  q.fx(mx, Y0, mz, 'delve', B.delve_mouth);
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) q.lamp(mx + dx, mz + dz, 1);
  // The barricade round it, a gate in it toward the way in.
  if (q.has('barricade')) {
    for (let dx = -3; dx <= 3; dx++) for (const dz of [-3, 3]) if (!(dz === 3 && Math.abs(dx) <= 1)) q.put(mx + dx, Y0, mz + dz, B.palisade ?? m.trim);
    for (let dz = -2; dz <= 2; dz++) for (const dx of [-3, 3]) q.put(mx + dx, Y0, mz + dz, B.palisade ?? m.trim);
  }
  q.role('delver', mx - 1, mz + 3, 0, []);
  q.role('delver', mx + 1, mz + 3, 0, []);
  // The guild hall at the back: the board, the tables, the strongbox.
  if (q.has('guild') && q.D >= 13) {
    const r = { x0: q.x0 + 1, z0: q.z0, x1: mx - 4, z1: q.z0 + 5 };
    if (r.x1 - r.x0 >= 4) {
      const h = q.hall(r, { doors: [{ x: r.x1, z: r.z0 + 3, rot: 3 }], h: 3, use: 'guild' });
      for (let x = h.ix0; x < h.ix1; x += 3) {
        q.put(x, Y0, h.iz0 + 1, B.table);
        q.put(x, Y0, h.iz0 + 2, B.chair, 2);
        q.spot(x, h.iz0 + 2, 2, ['drink', 'social', 'gossip'], { seat: true });
      }
      q.put(h.ix1, Y0, h.iz0, B.chest);
      q.role('guildmaster', h.ix1 - 1, h.iz1, 0, []);
    }
  }
  q.fx(mx + 4, Y0, q.z1 - 1, 'contracts', B.delve_board);
  q.role('guildmaster', mx + 5, q.z1 - 1, 0, []);
  // The relics brought up, on their stands.
  if (q.has('relics')) for (let k = 0; k < 3; k++) q.fx(q.x1 - 1, Y0, q.z0 + 1 + k * 2, 'relics', B.display_stand ?? B.weapon_rack);
  // The alarm bell on its post.
  if (q.has('bell')) q.fx(mx + 3, Y0, mz - 3, 'bell', B.bell);
  // The infirmary: beds, herbs, a surgeon.
  if (q.has('infirmary') && q.x1 - (mx + 4) >= 4) {
    const r = { x0: mx + 4, z0: q.z0, x1: q.x1 - 2, z1: q.z0 + 4 };
    const h = q.hall(r, { doors: [{ x: r.x0, z: r.z1 - 1, rot: 1 }], h: 2, use: 'infirmary' });
    for (let x = h.ix0 + 1; x <= h.ix1; x++) q.put(x, Y0, h.iz0, B.bed, 0);
    q.put(h.ix0, Y0, h.iz0, B.herb);
    q.role('surgeon', h.ix0, h.iz1, 0, []);
    q.fx(h.ix0, Y0, h.iz1, 'infirmary');
  }
  // The memorial to the lost.
  if (q.has('memorial')) {
    q.fx(q.x0 + 2, Y0, q.z1 - 2, 'memorial', B.delve_memorial);
    q.spot(q.x0 + 3, q.z1 - 1, 2, ['mourn', 'pray']);
  }
  // Supplies: rope, crates, a cart.
  q.put(mx - 4, Y0, mz + 2, B.rope_coil);
  q.put(mx - 4, Y0, mz + 1, B.crate);
  q.put(mx + 4, Y0, mz + 2, B.barrel);
  q.put(mx - 5, Y0, mz + 2, B.mine_cart);
  q.sign(mx + 2, q.z1, 0);
  void LIT;
}

// ------------------------------------------------------------ ruins
function ruins(q) {
  const rng = q.rng;
  const old = q.fam === 'jade' ? B.tv_brick ?? B.mossy_bricks : q.fam === 'sun' ? B.sandstone : q.fam === 'classic' ? B.travertine : B.mossy_bricks;
  const wild = q.has('overgrown');
  q.fill(q.x0, q.z0, q.x1, q.z1, B.grass);
  // The old paving, broken, the grass through it.
  for (let z = q.z0 + 1; z <= q.z1 - 1; z++) for (let x = q.x0 + 1; x <= q.x1 - 1; x++) if ((x * 7 + z * 13) % 5 < 2) q.ground(x, z, B.cracked_bricks);
  // The walls of the old hall, standing here and there.
  const r = { x0: q.x0 + 1, z0: q.z0 + 1, x1: q.x1 - 1, z1: q.z1 - 3 };
  for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++) {
    const edge = x === r.x0 || x === r.x1 || z === r.z0;
    if (!edge) continue;
    const h = Math.max(0, Math.round(1 + 2 * Math.sin(x * 0.7 + z * 1.3) + rng.float(-1, 1)));
    for (let y = Y0; y < Y0 + h; y++) q.put(x, y, z, (x + y) % 3 ? old : B.cracked_bricks);
    if (wild && h && rng.chance(0.3)) q.put(x, Y0 + h, z, B.vine ?? B.leaves_oak);
  }
  // The colonnade: stumps of columns in a row, one or two standing whole.
  if (q.has('columns')) {
    for (let x = r.x0 + 2; x <= r.x1 - 2; x += 2) {
      const h = rng.chance(0.25) ? 3 : rng.int(0, 2);
      if (h === 0) q.put(x, Y0, r.z0 + 3, B.gl_column ?? B.rubble);
      else q.stack(x, r.z0 + 3, Y0, Y0 + h - 1, B.marble_column ?? old);
    }
  }
  // The colossus's head in the grass.
  const mx = q.cx;
  const mz = q.cz;
  if (q.has('colossus') && q.W >= 15) {
    q.piece(mx, mz, B.colossus_head, 'colossus');
    q.spot(mx, mz + 2, 2, ['sketch', 'stroll', 'gossip']);
  } else q.put(mx, Y0, mz, B.statue);
  // A gate that leads nowhere now.
  if (q.has('gate')) {
    const gx = q.x0 + 3;
    const gz = q.z1 - 2;
    for (const x of [gx - 1, gx + 1]) q.stack(x, gz, Y0, Y0 + 3, old);
    q.put(gx, Y0 + 3, gz, old);
    q.put(gx - 1, Y0 + 4, gz, old);
  }
  // The dig: trenches, tents, the finds table, the diggers.
  if (q.has('dig')) {
    const dx0 = q.x1 - 6;
    for (let k = 0; k < 3; k++) q.fx(dx0 + k * 2, Y0, r.z0 + 5 + (k % 2), 'dig', B.dig_site);
    q.tent(q.x1 - 2, q.z1 - 1, 2, 2);
    q.fx(q.x1 - 4, Y0, q.z1 - 1, 'finds', B.finds_table, 0);
    q.role('antiquarian', dx0 + 1, r.z0 + 6, 2, ['work']);
    q.role('antiquarian', q.x1 - 4, q.z1 - 2, 0, ['read']);
  }
  // The stone with the old writing.
  if (q.has('glyphs')) q.fx(q.x0 + 2, Y0, r.z0 + 2, 'glyphs', B.glyph_stone);
  // The sealed vault: a stair down that ends in a grate.
  if (q.has('vault')) {
    const vx = mx - 4;
    const vz = r.z0 + 2;
    q.put(vx, Y0, vz, B.iron_bars);
    q.ground(vx, vz, B.iron_bars);
    q.fx(vx, Y0, vz, 'vault');
    q.put(vx - 1, Y0, vz, B.rubble ?? B.cobblestone);
  }
  // Ivy, bushes and young trees over it all.
  if (wild) for (let k = 0; k < 10; k++) {
    const x = rng.int(q.x0 + 1, q.x1 - 1);
    const z = rng.int(q.z0 + 1, q.z1 - 1);
    if (q.at(x, Y0, z) === undefined && q.at(x, Y0 + 1, z) === undefined) q.put(x, Y0, z, rng.pick([B.bush, B.fern, B.tall_grass, B.sapling]));
  }
  q.sign(mx + 1, q.z1, 0);
}

export const DEEP = { delve, ruins };
