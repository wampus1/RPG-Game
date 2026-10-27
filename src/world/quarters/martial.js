// (Round 146) Places of arms and horses (see specialties.js).
//   The citadel (a town's fort): its curtain wall crenellated round the
// lot, the gatehouse with its banners, towers at the corners with fires on
// their tops, the keep at the back flat-roofed behind its parapet; the
// yard where the garrison drills (dummies, butts, racks); the armoury, the
// stables, the sellswords' board and their benches; a chapel; a moat
// crossed by a bridge.
//   The racecourse (a city's hippodrome, a village's horse fair): the
// track round its rails, the spine down the middle with its obelisks, the
// stands along the front, the starting gates, the winning post before the
// stands, the bookmaker's board; stables; horses for sale in their pens.
import { B } from '../blocks.js';
import { Y0, LIT } from './kit.js';

function citadel(q) {
  const m = q.m;
  const moat = q.has('moat');
  const wallId = q.fam === 'north' ? B.log_wall : q.fam === 'sun' ? B.adobe : m.wall === B.marble ? B.stone_bricks : m.wall;
  q.fill(q.x0, q.z0, q.x1, q.z1, B.gravel);
  const e = moat ? 1 : 0;
  // The moat round the outside, bridged at the gate.
  if (moat) {
    for (let x = q.x0; x <= q.x1; x++) for (let z = q.z0; z <= q.z1; z++) {
      if (!q.onEdge(x, z)) continue;
      if (q.atGate(x, z, 1)) q.ground(x, z, B.planks);
      else {
        q.ground(x, z, B.water);
        q.put(x, Y0 - 1, z, B.water);
      }
    }
  }
  // The curtain wall, three high, crenellated, the gate in it.
  const gx = q.cx;
  for (let x = q.x0 + e; x <= q.x1 - e; x++) for (let z = q.z0 + e; z <= q.z1 - e; z++) {
    const edge = x === q.x0 + e || x === q.x1 - e || z === q.z0 + e || z === q.z1 - e;
    if (!edge) continue;
    if (z === q.z1 - e && Math.abs(x - gx) <= 1) continue;
    q.stack(x, z, Y0, Y0 + 2, wallId);
    if ((x + z) % 2 === 0) q.put(x, Y0 + 3, z, wallId);
  }
  // The gatehouse: the wall over the gate, banners either side.
  for (let x = gx - 1; x <= gx + 1; x++) q.put(x, Y0 + 2, q.z1 - e, wallId);
  for (const x of [gx - 2, gx + 2]) {
    q.stack(x, q.z1 - e, Y0, Y0 + 4, wallId);
    q.put(x, Y0 + 5, q.z1 - e, B.war_banner);
  }
  q.spot(gx - 1, q.z1 - e - 1, 0, ['watch', 'social']);
  // Towers at the corners.
  if (q.has('towers')) {
    for (const [x, z] of [[q.x0 + e, q.z0 + e], [q.x1 - e - 1, q.z0 + e], [q.x0 + e, q.z1 - e - 1], [q.x1 - e - 1, q.z1 - e - 1]]) q.tower(x, z, 2, 5, wallId, 'brazier');
  }
  const ix0 = q.x0 + e + 1;
  const ix1 = q.x1 - e - 1;
  const iz0 = q.z0 + e + 1;
  const iz1 = q.z1 - e - 1;
  // The keep at the back, flat-roofed, its parapet and banner.
  let keepZ1 = iz0 - 1;
  if (q.has('keep') || q.size === 'city') {
    const w = Math.min(ix1 - ix0 - 4, q.size === 'city' ? 9 : 7);
    const r = { x0: gx - Math.floor(w / 2), z0: iz0, x1: gx - Math.floor(w / 2) + w - 1, z1: iz0 + (q.size === 'city' ? 5 : 4) };
    const h = q.hall(r, { doors: [{ x: gx, z: r.z1, rot: 0 }], h: q.size === 'city' ? 5 : 4, flat: true, parapet: wallId, wall: wallId, corner: wallId, floor: B.stone_bricks, win: 'glass', use: 'keep' });
    // (The commander's chair behind the table at the head of the hall,
    // the banners either side, the strongbox in the corner; the way from
    // the door to the table kept clear.)
    q.put(gx, Y0, h.iz0, B.chair, 0);
    q.put(gx, Y0, h.iz0 + 1, B.table);
    for (const x of [gx - 2, gx + 2]) if (x >= h.ix0 && x <= h.ix1) q.put(x, Y0, h.iz0, B.war_banner);
    q.put(h.ix0, Y0, h.iz0, B.chest);
    q.role('commander', gx, h.iz0, 0, []);
    q.put(gx, h.roofBase + 1, Math.round((r.z0 + r.z1) / 2), B.war_banner);
    keepZ1 = r.z1;
  }
  // The yard: dummies in a row, butts at the end, racks of arms.
  const yz = keepZ1 + 2;
  for (let x = ix0 + 1; x <= ix1 - 1; x += 3) {
    if (Math.abs(x - gx) <= 1) continue;
    q.fx(x, Y0, yz, 'dummy', B.training_dummy);
    q.role('drillmaster', x, yz + 1, 2, ['train']);
  }
  q.fx(ix0, Y0, yz + 2, 'rack', B.weapon_rack);
  q.fx(ix1, Y0, yz + 2, 'butt', B.target_butt, 1);
  q.spot(ix1 - 5 > ix0 ? ix1 - 5 : ix0 + 1, yz + 2, 3, ['train']);
  // The armoury and the stables, down either side.
  if (q.has('armory') && iz1 - yz >= 4) {
    const r = { x0: ix0, z0: yz + 3, x1: ix0 + 4, z1: iz1 };
    const h = q.hall(r, { doors: [{ x: r.x1, z: r.z0 + 1, rot: 3 }], h: 3, wall: wallId, corner: wallId, win: 'none', use: 'armory' });
    for (let z = h.iz0; z <= h.iz1; z++) q.fx(h.ix0, Y0, z, 'armory', z % 2 ? B.weapon_rack : B.display_stand ?? B.weapon_rack);
    q.role('quartermaster', h.ix1, h.iz0, 3, []);
  }
  if (q.has('stables') && iz1 - yz >= 4) {
    const r = { x0: ix1 - 4, z0: yz + 3, x1: ix1, z1: iz1 };
    q.hall(r, { doors: [{ x: r.x0, z: r.z0 + 1, rot: 1 }], h: 2, wall: B.planks, corner: B.log_oak, floor: B.dirt, win: 'none', use: 'stables' });
    q.put(r.x1 - 1, Y0, r.z1 - 1, B.hay_bale);
    q.pen(r.x0 + 1, r.z0 + 1, r.x1 - 1, r.z1 - 1, ['horse'], 2);
  }
  // The sellswords: their board by the gate, their benches, themselves.
  if (q.has('mercs')) {
    q.fx(gx + 3, Y0, iz1, 'mercs', B.merc_board);
    q.put(gx - 3, Y0, iz1, B.mead_bench ?? B.bench, 0);
    for (const dx of [-4, -2]) q.role('sellsword', gx + dx, iz1, 0, ['social', 'drink']);
  }
  if (q.has('chapel')) {
    q.put(ix0, Y0, yz - 1 > iz0 ? yz - 1 : yz, B.altar);
    q.spot(ix0 + 1, yz - 1 > iz0 ? yz - 1 : yz, 3, ['pray']);
  }
  for (const x of [gx - 2, gx + 2]) q.lamp(x, iz1, 1);
  q.sign(gx + 3, q.z1, 0);
  void LIT;
}

// ------------------------------------------------------------ racecourse
function racecourse(q) {
  const m = q.m;
  q.fill(q.x0, q.z0, q.x1, q.z1, B.grass);
  if (q.spec.form === 'horse_fair') return horseFair(q);
  const city = q.size === 'city';
  const standsD = q.has('stands') ? 3 : 1;
  const cx = q.x0 + (q.W - 1) / 2;
  const tz0 = q.z0;
  const tz1 = q.z1 - standsD;
  const cz = (tz0 + tz1) / 2;
  const rx = (q.W - 1) / 2;
  const rz = (tz1 - tz0) / 2;
  const icz = Math.round(cz);
  const width = city ? 3 : 2;
  const ring = (x, z) => (z > tz1 ? -1 : q.ringOf(x, z, cx, cz, rx, rz));
  const pts = [];
  // (Round 147) The way through the rails: out of the stands onto the
  // track before the winning post, and across it into the middle on the
  // far side.
  const mid = q.gates[0].x;
  const opening = (x, z, k) => (k === 0 ? Math.abs(x - mid) <= 1 && z > cz : Math.abs(x - mid) <= 0 && z < cz);
  for (let z = tz0; z <= tz1; z++) {
    for (let x = q.x0; x <= q.x1; x++) {
      const k = ring(x, z);
      if (k < 0) continue;
      if (k === 0) {
        q.ground(x, z, opening(x, z, 0) ? B.race_track : B.grass);
        if (!opening(x, z, 0)) q.put(x, Y0, z, B.fence);
      } else if (k <= width) {
        q.ground(x, z, B.race_track);
        if (k === Math.ceil(width / 2)) pts.push(q.pt(x, z));
      } else if (k === width + 1) {
        q.ground(x, z, B.grass);
        if (!opening(x, z, 1)) q.put(x, Y0, z, B.fence);
      } else q.ground(x, z, B.grass_lush);
    }
  }
  // The spine down the middle: a low wall, obelisks and statues on it.
  if (q.has('spina') || q.fam === 'classic') {
    const half = Math.max(2, Math.round(rx - width - 4));
    for (let x = Math.round(cx) - half; x <= Math.round(cx) + half; x++) {
      q.ground(x, icz, m.trim);
      q.put(x, Y0, icz, m.trim);
      const d = x - Math.round(cx);
      if (d === 0) q.put(x, Y0 + 1, icz, q.has('statues') ? B.statue : B.spina_obelisk);
      else if (Math.abs(d) === half || (Math.abs(d) === Math.round(half / 2))) q.put(x, Y0 + 1, icz, B.spina_obelisk);
    }
  } else {
    q.put(Math.round(cx), Y0, icz, q.has('statues') ? B.statue : B.hay_bale);
  }
  // The starting gates across the track at the west end; the winning post
  // before the stands.
  const sx = Math.round(cx - rx + width / 2 + 2);
  for (let z = tz1 - width; z <= tz1 - 1; z++) if (ring(sx, z) >= 1 && ring(sx, z) <= width) q.put(sx, Y0, z, B.start_gate, 3);
  q.fx(Math.round(cx), Y0, tz1 - width - 1, 'finish', B.finish_post);
  // The stands: seats stepping up along the front, an awning over the top
  // row in a city; the bookmaker at the end.
  if (q.has('stands')) {
    for (let x = q.x0 + 1; x <= q.x1 - 1; x++) {
      if (q.atGate(x, q.z1, 1, 3)) continue;
      for (let r = 0; r < 2; r++) {
        const z = tz1 + 1 + r;
        q.ground(x, z, m.pave);
        q.tier(x, z, r + 1, x, z - 10, m.trim, m.stairs, (x + r) % 2 === 0);
        if (r === 1 && city && x % 2 === 0) q.canopy(x, z, Y0 + 3, 2, m.cloth + (x % 4 === 0 ? 1 : 0));
      }
    }
  }
  q.fx(q.x0 + 2, Y0, q.z1, 'odds', B.odds_board);
  q.role('bookie', q.x0 + 3, q.z1, 2, ['market']);
  // Stables at the east end, horses in the pen beside it.
  if (q.has('stables')) {
    q.put(q.x1 - 1, Y0, q.z1, B.hay_bale);
    q.role('groom', q.x1 - 2, q.z1, 2, ['farm']);
  }
  q.role('jockey', sx + 1, tz1 - 1, 3, ['train']);
  q.role('jockey', sx + 1, tz1 - 2, 3, ['train']);
  // The racers' way round, in order (see game/cityplay.js).
  const c = q.pt(Math.round(cx), Math.round(cz));
  pts.sort((a, b) => Math.atan2(a.z - c.z, a.x - c.x) - Math.atan2(b.z - c.z, b.x - c.x));
  q.out.track = { pts, start: q.pt(sx, tz1 - 1), finish: q.pt(Math.round(cx), tz1 - 1), loop: true };
  q.sign(Math.round(cx) + 2, q.z1, 0);
}

// A village's horse fair: a paddock fenced round, a straight gallop with a
// post at each end, pens of horses for sale, the judges' bench.
function horseFair(q) {
  const z0 = q.z0 + 1;
  const z1 = q.z0 + 3;
  for (let x = q.x0 + 1; x <= q.x1 - 1; x++) {
    q.put(x, Y0, z0 - 1, B.fence);
    for (let z = z0; z <= z1; z++) q.ground(x, z, B.race_track);
    q.put(x, Y0, z1 + 1, B.fence);
  }
  q.put(q.x0 + 1, Y0, z0, B.start_gate, 3);
  q.fx(q.x1 - 1, Y0, z1 + 2, 'finish', B.finish_post);
  const pts = [];
  for (let x = q.x0 + 2; x <= q.x1 - 2; x++) pts.push(q.pt(x, z0 + 1));
  q.out.track = { pts, start: q.pt(q.x0 + 2, z0 + 1), finish: q.pt(q.x1 - 2, z0 + 1), loop: false };
  // Pens of horses.
  const pz = z1 + 3;
  for (let x = q.x0 + 1; x <= q.x0 + 6; x++) for (const z of [pz, q.z1 - 1]) q.put(x, Y0, z, B.fence);
  for (const x of [q.x0 + 1, q.x0 + 6]) for (let z = pz; z <= q.z1 - 1; z++) q.put(x, Y0, z, B.fence);
  q.pen(q.x0 + 2, pz + 1, q.x0 + 5, q.z1 - 2, ['horse'], 3);
  q.role('horsetrader', q.x0 + 7, pz + 1, 3, ['market', 'shop']);
  q.fx(q.x0 + 7, Y0, pz, 'horses', B.counter);
  // The judges' bench, the board, benches for the crowd.
  q.fx(q.cx + 3, Y0, z1 + 2, 'odds', B.odds_board);
  q.role('bookie', q.cx + 4, z1 + 2, 2, ['market']);
  for (let x = q.cx - 2; x <= q.cx + 1; x++) {
    q.put(x, Y0, z1 + 2, B.bench, 2);
    q.seat(x, z1 + 2, 2);
  }
  q.role('jockey', q.x0 + 2, z0, 3, ['train']);
  q.sign(q.cx, q.z1, 0);
}

export const MARTIAL = { citadel, racecourse };
