// (Round 97) What the architects of the old places (see deeps/) share in
// laying out their rooms: raising a tile a step (or two, a ledge) and
// sinking one, setting someone out exactly there, finding a free tile
// near another, a room's main way in and its back wall, a pocket dug
// behind a wall, and whatever of a room can't be got to sealed up.
import { B, BLOCKS } from '../blocks.js';

export const key = (ctx, x, z) => z * ctx.W + x;
// A tile raised a step (a bench cut in the rock), or two (a ledge up the
// side of a shaft: a ladder to it).
export function raise(ctx, H, x, z, id, high = 1) {
  const { b } = ctx;
  for (let k = 0; k < high; k++) b.set(x, H.FY + k, z, id);
  for (let k = high; k < high + 2; k++) b.set(x, H.FY + k, z, B.air);
  (high > 1 ? (ctx.ledge ||= new Set()) : (ctx.lifted ||= new Set())).add(key(ctx, x, z));
  ctx.out.maxY = Math.max(ctx.out.maxY || 0, H.FY + high);
}
// A tile sunk a step below the floor (a sump's pit), water in it or not.
export function sink(ctx, H, x, z, floor, water = false) {
  const { b } = ctx;
  b.set(x, H.FY - 1, z, water ? B.water : B.air);
  b.set(x, H.FY - 2, z, floor);
  (ctx.sunk ||= new Set()).add(key(ctx, x, z));
  ctx.reserved.add(key(ctx, x, z));
}
// Someone set out exactly there (in another land, its own in their place,
// and its own look on the rest: see render/pixart.VARIANTS).
export const LOOK = { kharos: 1, myrrow: 2, hollowmark: 2, velmarch: 3, saltmere: 3 };
export function put(ctx, species, x, z, r, o = {}) {
  const { out, b } = ctx;
  if (out.spawns.some((s) => s.x === b.x0 + x && s.z === z)) return null;
  const sw = ctx.T.swap && ctx.T.swap[species];
  const v = LOOK[ctx.rec.isle] || 0;
  const s = { id: out.spawns.length, species: sw ? ctx.rng.pick(sw) : species, x: b.x0 + x, z, room: r.id, ...(v ? { variant: v } : {}), ...o };
  out.spawns.push(s);
  return s;
}
export const isUp = (ctx, x, z) => ctx.lifted?.has(key(ctx, x, z)) || ctx.ledge?.has(key(ctx, x, z)) || ctx.sunk?.has(key(ctx, x, z));
export const free = (ctx, H, r, x, z) => H.freeIn(ctx, r, x, z) && !isUp(ctx, x, z);
export function near(ctx, H, r, x, z, rad = 3, ok = null) {
  for (let d = 0; d <= rad; d++) {
    for (let dz = -d; dz <= d; dz++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
        if (free(ctx, H, r, x + dx, z + dz) && (!ok || ok(x + dx, z + dz))) return { x: x + dx, z: z + dz };
      }
    }
  }
  return null;
}
export const lvlOf = (ctx) => (ctx.rec.level || 1) + ctx.n * 0.5;
export function mainDoor(ctx, H, r) {
  const ds = H.doorways(ctx.plan, r).filter((d) => H.own(ctx.plan, r, d.x, d.z));
  if (!ds.length) return null;
  const e = ctx.out.entry ? { x: ctx.out.entry.x - ctx.b.x0, z: ctx.out.entry.z } : { x: r.cx, z: r.cz };
  return ds.sort((a, c) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(c.x - e.x, c.z - e.z))[0];
}
export const groupOf = (ctx, r, k) => `${ctx.n}:${r.id}:${k}`;
export function lore(ctx, x, z, entry) {
  (ctx.out.lore ||= []).push({ x: ctx.b.x0 + x, z, ...entry });
}
// The side of the room furthest from its main way in (its back wall), as
// a row: which axis it runs along, the row by the wall, and which way is
// out from the wall into the room.
export function backOf(ctx, H, r) {
  const door = mainDoor(ctx, H, r);
  const along = r.x1 - r.x0 >= r.z1 - r.z0;
  if (along) {
    const back = door && door.z <= r.cz ? r.z1 : r.z0;
    return { along, back, out: back === r.z1 ? -1 : 1 };
  }
  const back = door && door.x <= r.cx ? r.x1 : r.x0;
  return { along, back, out: back === r.x1 ? -1 : 1 };
}
export const at2 = (S, a, row) => (S.along ? { x: a, z: row } : { x: row, z: a });
// A pocket dug behind one wall of the room (three deep, two wide at its
// end): its way in, and where its back is.
export function pocket(ctx, H, r, lining, accept = null) {
  const { plan, b, rng } = ctx;
  const FY = H.FY;
  const W = ctx.W;
  for (const w of rng.shuffle(H.wallsOf(plan, r))) {
    const dx = H.own(plan, r, w.x - 1, w.z) ? 1 : H.own(plan, r, w.x + 1, w.z) ? -1 : 0;
    const dz = H.own(plan, r, w.x, w.z - 1) ? 1 : H.own(plan, r, w.x, w.z + 1) ? -1 : 0;
    if (!!dx === !!dz) continue;
    // (Not where something's already been set against it.)
    if (b.get(w.x - dx, FY, w.z - dz) !== B.air || ctx.reserved?.has((w.z - dz) * W + w.x - dx)) continue;
    const cells = [1, 2, 3].map((k) => ({ x: w.x + dx * k, z: w.z + dz * k }));
    const side = (c) => [[dz, dx], [-dz, -dx]].map(([ox, oz]) => ({ x: c.x + ox, z: c.z + oz }));
    const all = [w, ...cells, ...side(cells[1]), ...side(cells[2])];
    if (all.some((c) => c.x < 2 || c.z < 2 || c.x >= W - 2 || c.z >= ctx.D - 2 || plan.at(c.x, c.z) || plan.forbid[c.z * W + c.x])) continue;
    if (all.some((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oz]) => plan.at(c.x + ox, c.z + oz) && plan.room[(c.z + oz) * W + c.x + ox] !== r.id))) continue;
    if (accept && !accept(w, { x: dx, z: dz })) continue;
    const open = [...cells, ...side(cells[2])];
    for (const c of open) {
      plan.carve(c.x, c.z);
      plan.forbid[c.z * W + c.x] = 1;
      b.set(c.x, FY, c.z, B.air);
      b.set(c.x, FY + 1, c.z, B.air);
      b.set(c.x, FY - 1, c.z, ctx.T.floor);
    }
    // Its own walls, all round.
    if (lining) {
      for (const c of open) {
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const q = { x: c.x + ox, z: c.z + oz };
          if (plan.at(q.x, q.z) || (q.x === w.x && q.z === w.z)) continue;
          for (const y of [FY, FY + 1]) b.set(q.x, y, q.z, lining);
        }
      }
    }
    return { door: w, back: cells[2], dir: { x: dx, z: dz }, cells: open };
  }
  return null;
}

// Whatever of a room can't be got to from its doors (shut in by a fall of
// rock, a step up too many) is filled with the fall, and nothing's left
// set out in it.
export function sealHollows(ctx, H, r, fill = B.mine_fall) {
  const { b, plan, out } = ctx;
  const FY = H.FY;
  const W = ctx.W;
  const solid = (x, y, z) => BLOCKS[b.get(x, y, z)].solid;
  // (Where you'd stand on the tile, or null: the floor, or a step up.)
  const stand = (x, z) => (!solid(x, FY, z) && !solid(x, FY + 1, z) ? FY : solid(x, FY, z) && !solid(x, FY + 1, z) && !solid(x, FY + 2, z) ? FY + 1 : null);
  const seen = new Set();
  const q = [];
  for (const d of H.doorways(plan, r)) {
    if (!H.own(plan, r, d.x, d.z) || stand(d.x, d.z) === null) continue;
    seen.add(d.z * W + d.x);
    q.push(d);
  }
  while (q.length) {
    const { x, z } = q.pop();
    const h = stand(x, z);
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox;
      const nz = z + oz;
      const j = nz * W + nx;
      if (seen.has(j) || !H.own(plan, r, nx, nz)) continue;
      const h2 = stand(nx, nz);
      if (h2 === null || h2 - h > 1) continue;
      seen.add(j);
      q.push({ x: nx, z: nz });
    }
  }
  if (!seen.size) return;
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(plan, r, x, z) || seen.has(z * W + x) || solid(x, FY, z)) continue;
      b.set(x, FY, z, fill);
      b.set(x, FY + 1, z, fill);
      const k = out.spawns.findIndex((sp) => sp.x === b.x0 + x && sp.z === z);
      if (k >= 0) out.spawns.splice(k, 1);
    }
  }
  out.spawns.forEach((sp, i) => (sp.id = i));
}


// (Round 98) A frame laid along a room's long way: u from one end toward
// the other (the end away from its main way in), v across it.
export function frameOf(ctx, H, r) {
  const longX = r.x1 - r.x0 >= r.z1 - r.z0;
  const door = mainDoor(ctx, H, r);
  const L = longX ? r.x1 - r.x0 + 1 : r.z1 - r.z0 + 1;
  const Wd = longX ? r.z1 - r.z0 + 1 : r.x1 - r.x0 + 1;
  // (Down a long room toward its end away from the way in; a room laid
  // north and south always toward its north end, where its end wall's
  // face can be seen.)
  let dir = longX ? 1 : -1;
  if (door && longX) dir = door.x <= r.cx ? 1 : -1;
  const start = longX ? (dir > 0 ? r.x0 : r.x1) : dir > 0 ? r.z0 : r.z1;
  const across = longX ? r.z0 : r.x0;
  const P = (u, v) => (longX ? { x: start + dir * u, z: across + v } : { x: across + v, z: start + dir * u });
  // (Steps up, facing back down the room.)
  const stepRot = longX ? (-dir > 0 ? 3 : 1) : -dir > 0 ? 0 : 2;
  return { longX, L, Wd, dir, P, stepRot, mid: Math.floor((Wd - 1) / 2) };
}
// A free tile something can be set on and seen: not against the wall to
// the south of it (the face of that wall, seen from above, hides the row
// in front of it).
export const shown = (ctx, H, r, x, z) => free(ctx, H, r, x, z) && ctx.plan.at(x, z + 1);
// A room's back wall, as a row, where it can be seen: in a wide room,
// always its north wall (the one whose face you see), whichever side its
// way in is; in a deep one, the side away from its way in.
export function backSeen(ctx, H, r) {
  const along = r.x1 - r.x0 >= r.z1 - r.z0;
  if (along) return { along, back: r.z0, out: 1 };
  const door = mainDoor(ctx, H, r);
  const back = door && door.x <= r.cx ? r.x1 : r.x0;
  return { along, back, out: back === r.x1 ? -1 : 1 };
}
// Something set out on a free tile of the room where it'll be seen (as
// H.placeIn, but never on a row hidden by the wall to its south).
export function place(ctx, H, r, id, meta = 0, edge = false) {
  for (let t = 0; t < 8; t++) {
    const at = H.placeIn(ctx, r, id, meta, edge);
    if (!at) return null;
    if (ctx.plan.at(at.x, at.z + 1)) return at;
    ctx.b.set(at.x, H.FY, at.z, B.air);
  }
  return null;
}
// (Round 98) The longest unbroken run of tiles along a row (a ledge is one
// run, never two either side of a doorway with a ladder to only one).
export function longestRun(tiles, along) {
  let best = [];
  let cur = [];
  for (const t of tiles) {
    const prev = cur[cur.length - 1];
    if (prev && Math.abs((along ? t.x - prev.x : t.z - prev.z)) === 1) cur.push(t);
    else cur = [t];
    if (cur.length > best.length) best = cur;
  }
  return best;
}
