// (Round 146) Places of learning (see specialties.js).
//   The library: its great hall of shelves (scroll shelves where the jade
// court and the sun peoples keep scrolls, books elsewhere), long tables to
// read at, the great book open on its lectern at the head of the hall, the
// librarians' desks by the door; before it a court, cloistered or planted
// or set with statues of the learned; and as it has them, the map room's
// table and globe, the archive, the scribes at their desks, the star
// terrace with its telescope (climb up to it), a dome over the hall.
//   The monastery: walled, its gate in the middle of a side; the hall of
// stillness at the back with its mats before the altar; the yard where the
// monks train with the wooden men and the staves; the tea house; the
// garden and its pool; the bell; the pagoda.
import { B } from '../blocks.js';
import { Y0, LIT } from './kit.js';

const SCROLLS = new Set(['jade', 'sun']);

// A long hall of learning across the back of the lot: its shelves, its
// tables, its lectern, the librarian's desk; `r` its rectangle.
function readingHall(q, r, o = {}) {
  const shelf = SCROLLS.has(q.fam) ? B.scroll_shelf : B.bookshelf;
  const door = { x: Math.round((r.x0 + r.x1) / 2), z: r.z1, rot: 0 };
  const grand = q.size === 'city';
  const h = q.size === 'village' ? 3 : grand ? 5 : 4;
  const hall = q.hall(r, { doors: [door], h, win: grand || q.has('dome') ? 'stained' : 'glass', flat: o.flat ?? (q.has('dome') || q.m.flat), use: 'library' });
  const { ix0, iz0, ix1, iz1 } = hall;
  const mx = door.x;
  // Shelves all along the back wall and down the sides.
  for (let x = ix0; x <= ix1; x++) if (Math.abs(x - mx) > 1) q.fx(x, Y0, iz0, 'shelf', shelf, 0);
  for (let z = iz0 + 1; z <= iz1 - 1; z++) for (const x of [ix0, ix1]) q.fx(x, Y0, z, 'shelf', shelf, x === ix0 ? 3 : 1);
  // The lectern with the great book at the head of the hall, a rug down
  // the middle to it, candles either side.
  q.fx(mx, Y0, iz0 + 1, 'lectern', B.reading_lectern, 0);
  for (let z = iz0 + 2; z <= iz1 - 1; z++) q.put(mx, Y0, z, B.rug_red);
  q.role('librarian', mx, iz0 + 2, 2, ['read']);
  // Stacks: free-standing shelves in rows, aisles between, on either side
  // of the middle; tables to read at nearer the door.
  const rows = [];
  for (let z = iz0 + 2; z <= iz1 - 2; z += 3) rows.push(z);
  rows.forEach((z, i) => {
    for (const side of [-1, 1]) {
      const a = side < 0 ? ix0 + 2 : mx + 2;
      const b = side < 0 ? mx - 2 : ix1 - 2;
      if (b - a < 1) continue;
      const tables = i >= Math.ceil(rows.length / 2) || rows.length === 1;
      for (let x = a; x <= b; x++) {
        if (tables) {
          if ((x - a) % 4 === 3) continue;
          q.put(x, Y0, z, B.table);
          if (z + 1 < iz1) {
            q.put(x, Y0, z + 1, B.chair, 2);
            if ((x - a) % 2 === 0) q.spot(x, z + 1, 2, ['read', 'study'], { seat: true });
          }
          if ((x - a) % 4 === 1) q.put(x, Y0 + 1, z, B.candles, LIT);
        } else {
          if (x === b && rows.length > 1) continue;
          q.fx(x, Y0, z, 'shelf', shelf, 0);
        }
      }
    }
  });
  // The librarian's desk by the door.
  const dx = door.x + 2 <= ix1 ? door.x + 2 : door.x - 2;
  q.fx(dx, Y0, iz1, 'desk', B.writing_desk, 2);
  q.role('librarian', dx, iz1 - 1, 0, ['read']);
  // Lamps hung along the walls (lanterns on the shelves' tops).
  for (let x = ix0 + 1; x <= ix1 - 1; x += 4) q.put(x, Y0 + h - 1, iz0, B.lantern, LIT);
  // The dome, stepping up over the middle of the flat roof, a lantern on
  // its crown.
  if (q.has('dome') && (r.x1 - r.x0) >= 8) {
    const cx = mx;
    const cz = Math.round((r.z0 + r.z1) / 2);
    const R = Math.min(Math.floor((r.x1 - r.x0) / 2) - 1, Math.floor((r.z1 - r.z0) / 2) - 1, 5);
    const roof = q.fam === 'classic' || q.fam === 'ember' ? B.copper_roof : q.m.roof;
    for (let k = 0; k <= R; k++) {
      const rr = R - k * 1.1;
      if (rr < 0.8) break;
      for (let z = cz - R; z <= cz + R; z++) for (let x = cx - R; x <= cx + R; x++) {
        if (Math.hypot(x - cx, (z - cz) * 1.15) <= rr) q.put(x, hall.roofBase + 1 + k, z, roof);
      }
    }
    q.put(cx, hall.roofBase + 2 + Math.ceil(R / 1.1), cz, B.lantern, LIT);
  }
  return hall;
}

// The star terrace: a platform two paces up, steps to it, the telescope
// on it under the sky (see game/cityplay.js: at night, the stars).
function starTerrace(q, x0, z0) {
  for (let z = z0; z < z0 + 3; z++) for (let x = x0; x < x0 + 3; x++) {
    q.stack(x, z, Y0, Y0 + 1, q.m.trim);
  }
  q.put(x0 + 1, Y0 + 2, z0, B.telescope, 0);
  q.fx(x0 + 1, Y0 + 2, z0, 'telescope');
  q.spot(x0 + 1, z0 + 1, 2, ['stargaze'], { y: Y0 + 2 });
  q.role('astronomer', x0 + 2, z0 + 1, 2, ['stargaze'], { y: Y0 + 2 });
  // The steps up (two, from the front).
  q.put(x0 + 1, Y0, z0 + 3, q.m.stairs, 2);
  q.put(x0 + 1, Y0 + 1, z0 + 2, q.m.stairs, 2);
  q.put(x0, Y0 + 2, z0 + 2, B.fence);
  q.put(x0 + 2, Y0 + 2, z0 + 2, B.fence);
  q.put(x0 + 2, Y0 + 2, z0, B.lantern, LIT);
}

function library(q) {
  const m = q.m;
  q.fill(q.x0, q.z0, q.x1, q.z1, m.pave);
  const village = q.size === 'village';
  // The hall across the back (where the street is, it's the front).
  const deep = village ? q.D - 3 : Math.max(7, Math.round(q.D * 0.55));
  const hall = readingHall(q, { x0: q.x0 + 1, z0: q.z0 + 1, x1: q.x1 - 1, z1: q.z0 + deep });
  const cz0 = hall.z1 + 1;
  const mx = Math.round((hall.x0 + hall.x1) / 2);
  // The court before it: columns down either side for a cloister, or
  // beds and a tree, or statues of the learned flanking the walk.
  const walk = (x) => Math.abs(x - mx) <= 1;
  for (let z = cz0; z <= q.z1; z++) q.ground(mx, z, B.flagstone);
  if (!village) {
    if (q.has('cloister')) {
      for (let x = q.x0 + 1; x <= q.x1 - 1; x += 2) {
        if (walk(x)) continue;
        q.column(x, q.z1 - 1, 2, B.lantern);
        q.put(x, Y0 + 2, q.z1 - 1, m.trim);
      }
      for (let z = cz0 + 1; z < q.z1 - 1; z += 2) for (const x of [q.x0 + 1, q.x1 - 1]) q.column(x, z, 2);
    }
    if (q.has('garden')) {
      for (let z = cz0 + 1; z < q.z1 - 1; z++) for (let x = q.x0 + 3; x <= q.x1 - 3; x++) {
        if (walk(x) || Math.abs(x - mx) === 2) continue;
        q.ground(x, z, B.grass_lush);
        if ((x + z) % 3 === 0) q.put(x, Y0, z, [B.flower_red, B.flower_blue, B.flower_white, B.herb][(x * 7 + z) % 4]);
      }
    }
    if (q.has('statues')) for (const x of [mx - 3, mx + 3]) if (x > q.x0 + 1 && x < q.x1 - 1) q.put(x, Y0, cz0 + 1, B.statue);
    // Benches facing the walk, for reading in the sun.
    for (const [x, f] of [[mx - 2, 3], [mx + 2, 1]]) {
      const z = Math.min(q.z1 - 2, cz0 + 2);
      q.put(x, Y0, z, B.bench, f);
      q.spot(x, z, f, ['read', 'rest', 'social']);
    }
  }
  // The map room's table and the globe, out in the hall's front corners
  // (or the court's, where there's room).
  if (q.has('maps')) {
    q.fx(hall.ix1 - 1, Y0, hall.iz1 - 1, 'maps', B.map_table, 0);
    q.fx(hall.ix0 + 1, Y0, hall.iz1 - 1, 'globe', B.globe);
    q.role('cartographer', hall.ix1 - 1, hall.iz1 - 2, 0, ['read']);
  }
  // The star terrace in a corner of the court.
  if (q.has('observatory') && !village && q.z1 - cz0 >= 4) starTerrace(q, q.x1 - 3, cz0 + 1);
  else if (q.has('observatory')) {
    q.fx(hall.x1, Y0, hall.z1 + 1, 'telescope', B.telescope, 0);
    q.role('astronomer', hall.x1 - 1, hall.z1 + 1, 1, ['stargaze']);
  }
  // The scribes at their desks, by the windows.
  if (q.has('scriptorium')) {
    for (let x = hall.ix0 + 2; x <= hall.ix1 - 2; x += 3) {
      if (Math.abs(x - mx) <= 1) continue;
      q.fx(x, Y0, hall.iz1 - 1, 'desk', B.writing_desk, 2);
      q.role('scribe', x, hall.iz1 - 2, 0, ['read']);
      if (x + 3 > hall.ix1 - 2) break;
    }
  }
  // The archive: a strongroom of records off the court.
  if (q.has('archive') && !village && q.x1 - q.x0 >= 15 && q.z1 - cz0 >= 4) {
    const a = { x0: q.x0 + 1, z0: cz0 + 1, x1: q.x0 + 5, z1: Math.min(q.z1 - 1, cz0 + 4) };
    const door = { x: a.x1, z: Math.round((a.z0 + a.z1) / 2), rot: 3 };
    const h = q.hall(a, { doors: [door], h: 3, win: 'none', use: 'archive' });
    for (let x = h.ix0; x <= h.ix1; x++) q.fx(x, Y0, h.iz0, 'shelf', B.scroll_shelf, 0);
    q.fx(h.ix0, Y0, h.iz1, 'archive', B.chest);
    q.role('archivist', h.ix1, h.iz1, 1, ['read']);
  }
  // A lamp at the gate, and the sign.
  const g = q.gates[0];
  q.sign(g.x + (g.side === 'n' || g.side === 's' ? 2 : 0), g.z + (g.side === 'w' || g.side === 'e' ? 2 : 0), g.side === 'n' ? 0 : 2);
  q.lamp(q.x0, q.z1, 1);
  q.lamp(q.x1, q.z1, 1);
}

// ------------------------------------------------------------ monastery
function monastery(q) {
  const m = q.m;
  const jade = q.fam === 'jade';
  const wallId = jade ? B.planks_lacquer : m.wall;
  q.fill(q.x0, q.z0, q.x1, q.z1, B.gravel);
  q.enclose(wallId, 2);
  // The hall of stillness across the back.
  const deep = Math.max(5, Math.round(q.D * 0.42));
  const r = { x0: q.x0 + 2, z0: q.z0 + 1, x1: q.x1 - 2, z1: q.z0 + deep };
  const mx = Math.round((r.x0 + r.x1) / 2);
  const hall = q.hall(r, { doors: [{ x: mx, z: r.z1, rot: 0 }], h: 3, roof: jade ? B.roof_jade : m.roof, wall: jade ? B.paper_wall ?? m.wall : m.wall, corner: jade ? B.planks_lacquer : m.corner, floor: jade ? B.planks_lacquer : m.floor, use: 'meditation' });
  q.put(mx, Y0, hall.iz0, B.altar);
  q.put(mx - 1, Y0, hall.iz0, B.incense);
  q.put(mx + 1, Y0, hall.iz0, B.incense);
  q.put(mx, Y0 + 1, hall.iz0, B.candles, LIT);
  for (let z = hall.iz0 + 2; z <= hall.iz1; z += 2) {
    for (let x = hall.ix0 + 1; x <= hall.ix1 - 1; x += 2) {
      if (x === mx) continue;
      q.fx(x, Y0, z, 'mat', B.meditation_mat);
      q.spot(x, z, 2, ['pray', 'rest'], {});
      if (x < mx) q.role('monk', x, z, 2, ['pray']);
    }
  }
  const yz0 = r.z1 + 2;
  // The yard: the wooden men and the staves, where the monks train.
  if (q.has('training')) {
    for (let k = 0; k < 3; k++) {
      const x = q.x0 + 2 + k * 2;
      if (x >= mx - 1) break;
      q.fx(x, Y0, yz0, 'dummy', B.wooden_dummy, 0);
      q.role('monk', x, yz0 + 1, 2, ['train']);
    }
    q.fx(q.x0 + 2, Y0, q.z1 - 1, 'rack', B.weapon_rack);
  }
  // The tea house: a little pavilion, its table.
  if (q.has('tea')) {
    const tx = q.x1 - 3;
    const tz = yz0 + 1;
    q.fx(tx, Y0, tz, 'tea', B.tea_table);
    for (const [dx, dz, f] of [[-1, 0, 3], [1, 0, 1]]) {
      q.put(tx + dx, Y0, tz + dz, B.stool);
      q.spot(tx + dx, tz + dz, f, ['social', 'rest', 'drink'], { seat: true });
    }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) q.put(tx + dx, Y0 + 2, tz + dz, jade ? B.roof_jade : m.roof, dz < 0 ? 2 : dz > 0 ? 0 : 1);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) q.stack(tx + dx, tz + dz, Y0, Y0 + 1, B.planks_lacquer ?? m.corner);
    q.role('monk', tx, tz + 1, 2, []);
  }
  // The garden: a pool, stones, clipped pines.
  if (q.has('garden')) {
    const gx = mx + 2;
    const gz = q.z1 - 2;
    for (let dx = 0; dx < 3; dx++) q.ground(gx + dx, gz, B.water);
    q.put(gx + 1, Y0 - 1, gz, B.water);
    q.put(gx + 1, Y0, gz, B.lily_pad);
    q.put(gx + 3, Y0, gz, B.rock);
    q.put(gx - 1, Y0, gz - 1, B.topiary);
    q.spot(gx + 1, gz - 1, 0, ['stroll', 'sketch', 'rest']);
  }
  // The bell (in its own little tower), the pagoda.
  if (q.has('bells')) q.put(q.x0 + 1, Y0, q.z0 + 1 + deep + 1, B.bell_pagoda ?? B.bell);
  if (q.has('pagoda')) {
    const px = q.x1 - 3;
    const pz = r.z1 + 1 >= q.z1 - 3 ? q.z1 - 3 : q.z1 - 3;
    for (let k = 0; k < 4; k++) {
      const y = Y0 + k * 2;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) q.put(px, y, pz, B.planks_lacquer);
        else q.put(px + dx, y + 1, pz + dz, B.roof_jade ?? m.roof, dz < 0 ? 2 : dz > 0 ? 0 : 1);
      }
      q.put(px, y + 1, pz, B.planks_lacquer);
    }
    q.put(px, Y0 + 8, pz, B.lantern, LIT);
  }
  // Lanterns at the gate, the sign.
  const g = q.gates[0];
  q.sign(g.x + (g.side === 'n' || g.side === 's' ? 2 : 0), g.z + (g.side === 'w' || g.side === 'e' ? 2 : 0), g.side === 'n' ? 0 : 2);
  q.role('monk', g.x, g.z + (g.side === 's' ? -1 : 1), g.side === 's' ? 0 : 2, []);
}

export const LEARNING = { library, monastery };
