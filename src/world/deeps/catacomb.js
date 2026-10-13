// (Round 103) The Imperial Catacomb, made over: the emperor laid under the
// Velmarch hills with his legion ranked round about him, sworn to guard him
// past death. Built and ordered and once polished, now decaying: the
// emperor's halls of travertine and marble (opus sectile, black-and-white
// mosaic, statues, gilt bronze, purple gone to rags) over the older
// galleries cut in the brown tufa (walls of opus reticulatum, shelf-graves
// in rows, lamp niches, frescoes faded to ochre and red). Lit warm and low
// by oil lamps, which can be put out and lit again. Large and many-roomed,
// with little verticality but some: a portico raised a step along the
// legion's hall, the tribunal at its head, the ossuary's bone pit sunk below
// the floor, a loft two up for a sarcophagus.
//
// A floor of it, beside the old rooms (the legion's ranks, the mosaic hall,
// the shrine, the pillared hall, the burial hall, the traps and the
// treasure), and what its own rooms are:
//   the galleria: a long gallery cut in the tufa, shelf-graves in its wall
//     (sealed: break one open for its grave goods, and anger the fossors),
//     one broken in with a dead arm in it, little lamps along it; a fossor
//     at work; lemures;
//   the columbarium: a chamber whose wall is all niches for urns, urns on
//     stands about an altar; lemures;
//   the basilica: the legion's hall: a nave of inlaid marble, porticoes
//     raised a step either side with their columns, the tribunal raised at
//     its head with the eagle, the decree, the standard-bearer; the shades
//     ranked down the nave;
//   the cubiculum: a family's chamber: frescoes, arched tombs, a
//     sarcophagus; the busts of the four ancestors and their tree on the
//     wall; the family tomb behind its door, which opens to whoever
//     honours them in their order;
//   the ossuary: walls of skulls, a bone pit sunk in the floor (dead hands
//     reaching up out of it), a loft two up with a sarcophagus (a ladder);
//   the triumph: the hall of the emperor's victories: the relief of the
//     Triumph, statues, a trophy of arms, the legion's banners, a floor of
//     mosaic in rings; the legion on parade.
// About the floor: its papers (see deeps/catalore.js) made from the
// catacomb's own history and its town's.
import { B, BLOCKS, META_STATE } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { cataLore } from './catalore.js';
import { key, raise, sink, put, isUp, free, near, groupOf, lore, place, pocket, backSeen, at2, longestRun } from './common.js';

const POOL = [['galleria', 3], ['columbarium', 2], ['ossuary', 1], ['triumph', 1], ['legion', 2], ['mosaic', 1], ['burial', 1], ['pillared', 1], ['trap', 1], ['treasure', 1]];
const ONCE = new Set(['basilica', 'cubiculum', 'ossuary', 'triumph', 'mosaic', 'burial', 'pillared', 'trap', 'treasure']);
export const CATA_OWN = new Set(['galleria', 'columbarium', 'basilica', 'cubiculum', 'ossuary', 'triumph']);

function kits(rng, rec, n, last, count) {
  const out = [];
  // (The master's floor: the legion's basilica at the head of the list,
  // made its hall.)
  if (last) out.push('basilica');
  // The family's chamber on the first floor (its tomb); the galleries on
  // every floor, and the legion's hall.
  if (n === 0 || rng.chance(0.5)) out.push('cubiculum');
  out.push('galleria');
  if (!out.includes('basilica')) out.push('basilica');
  if (rng.chance(0.5)) out.push(rng.pick(['ossuary', 'triumph']));
  let guard = 0;
  while (out.length < count && guard++ < 300) {
    const k = rng.weighted(POOL);
    if (ONCE.has(k) && out.includes(k)) continue;
    if (out.filter((q) => q === k).length >= 2) continue;
    out.push(k);
  }
  const head = last ? [out[0]] : [];
  return [...head, ...rng.shuffle(out.slice(head.length))].slice(0, count);
}

const SIZES = {
  galleria: [[15, 19], [5, 6]], columbarium: [[9, 11], [8, 9]], basilica: [[13, 17], [10, 12]], cubiculum: [[9, 11], [7, 9]],
  ossuary: [[10, 12], [9, 11]], triumph: [[12, 15], [9, 11]],
};
const SHAPES = { galleria: ['rect'], columbarium: ['rect', 'octagon'], basilica: ['rect'], cubiculum: ['rect'], ossuary: ['rect', 'octagon'], triumph: ['rect', 'cross'] };

// The master at the bottom: chosen from the catacomb's own seed, so every
// floor's papers can speak of it.
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x6804) % list.length] : null;
};
const Lof = (ctx) => ctx.cataLore || (ctx.cataLore = cataLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

// --------------------------------------------------------------- helpers
const floorAt = (ctx, x, z, id) => ctx.b.set(x, ctx.FY - 1, z, id);
const lifted = (ctx, x, z) => (ctx.lifted ||= new Set()).add(key(ctx, x, z));
const abs = (ctx, t) => ({ x: ctx.b.x0 + t.x, z: t.z });
const clear = (ctx, H, r, x, z) => free(ctx, H, r, x, z) && !H.doorBlocked(ctx.plan, r, x, z);
// A group of them set out about a spot, waking as one when you come near.
function band(ctx, H, r, list, at, k, o = {}) {
  const g = groupOf(ctx, r, k);
  const out = [];
  for (const species of list) {
    const s0 = near(ctx, H, r, at.x + ctx.rng.int(-1, 1), at.z + ctx.rng.int(-1, 1), 3);
    if (!s0) continue;
    const s = put(ctx, species, s0.x, s0.z, r, { dormant: 5, group: g, ...o });
    if (s) out.push(s);
  }
  return out;
}
// The north wall's tiles (their faces are the ones you see).
function northWall(ctx, r) {
  const out = [];
  for (let x = r.x0; x <= r.x1; x++) {
    let z = r.z0;
    while (z <= r.z1 && ctx.plan.room[z * ctx.W + x] !== r.id) z++;
    if (z > r.z1 || ctx.plan.at(x, z - 1)) continue;
    out.push({ x, z: z - 1 });
  }
  return out;
}
// A wall tile given another face (both its rows), if it's still the
// catacomb's own wall.
function face(ctx, w, id, meta = 0) {
  const { b } = ctx;
  if (b.get(w.x, ctx.FY, w.z) !== ctx.T.wall || b.get(w.x, ctx.FY + 1, w.z) !== ctx.T.wall) return false;
  for (const y of [ctx.FY, ctx.FY + 1]) b.set(w.x, y, w.z, id, meta);
  return true;
}
// The room's floor laid in another (never where it's been raised or sunk).
function floorAll(ctx, H, r, id, test = null) {
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z) && (!test || test(x, z))) floorAt(ctx, x, z, id);
}
// The tiles of the room, free and clear of its ways in.
const tilesOf = (ctx, H, r) => {
  const out = [];
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (clear(ctx, H, r, x, z)) out.push({ x, z });
  return out;
};
// The row of tiles under the north wall (seen from the room), clear.
const underNorth = (ctx, H, r) => northWall(ctx, r).map((w) => ({ x: w.x, z: w.z + 1, w })).filter((t) => clear(ctx, H, r, t.x, t.z));
// A lamp set down (lit, as the fossors keep them).
function lamp(ctx, x, z, tall = false) {
  ctx.b.set(x, ctx.FY, z, tall ? B.cc_lamp : B.cc_lucerna, META_STATE);
  (ctx.out.lamps ||= []).push({ x: ctx.b.x0 + x, z });
}
// Lamps along the room, spaced out, against its walls.
function lampsAlong(ctx, H, r, n, tall = false) {
  const set = [];
  for (const t of ctx.rng.shuffle(tilesOf(ctx, H, r).filter((q) => H.byWall(ctx.plan, q.x, q.z) && ctx.plan.at(q.x, q.z + 1)))) {
    if (set.length >= n) break;
    if (set.some((q) => Math.abs(q.x - t.x) + Math.abs(q.z - t.z) < 4)) continue;
    if (ctx.b.get(t.x, ctx.FY, t.z) !== B.air) continue;
    lamp(ctx, t.x, t.z, tall);
    set.push(t);
  }
  return set;
}
// A broken grave in the north wall, a dead arm reaching out of it into the
// room (a hand: it grabs whoever passes).
function hand(ctx, H, r, at = null) {
  const cands = underNorth(ctx, H, r).filter((t) => !ctx.out.spawns.some((q) => q.x === ctx.b.x0 + t.x && q.z === t.z));
  const pick = at ? cands.sort((a, c) => Math.abs(a.x - at.x) - Math.abs(c.x - at.x))[0] : ctx.rng.pick(cands);
  if (!pick || !face(ctx, pick.w, B.cc_handhole)) return null;
  put(ctx, 'loculus_hand', pick.x, pick.z, r, { hole: abs(ctx, pick.w), out: { x: 0, z: 1 } });
  ctx.reserved.add(key(ctx, pick.x, pick.z));
  return pick;
}
// Shelf-graves along the north wall: sealed (each with its grave goods,
// to be broken open), now and then one already broken.
function loculi(ctx, H, r, frac = 0.7) {
  const { rng, out } = ctx;
  let n = 0;
  for (const w of northWall(ctx, r)) {
    if (!rng.chance(frac)) continue;
    if (rng.chance(0.15)) {
      face(ctx, w, B.cc_loculi_open);
      continue;
    }
    if (!face(ctx, w, B.cc_loculi, rng.int(0, 1))) continue;
    (out.loculi ||= []).push({ ...abs(ctx, w), room: r.id, goods: rng.chance(0.7) });
    n++;
  }
  return n;
}

// --------------------------------------------------------------- the rooms
// The galleria: a long gallery cut in the tufa, shelf-graves all along its
// wall, little lamps along it; a broken grave with a dead arm in it; a
// fossor at work; lemures drifting.
function galleria(ctx, H, r) {
  const { rng } = ctx;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.cc_tufafloor);
  loculi(ctx, H, r, 0.8);
  // An epitaph or two let into the wall, and leaning against it.
  const w = northWall(ctx, r).filter((q) => q.x > r.x0 + 1 && q.x < r.x1 - 1);
  const wi = rng.pick(w);
  if (wi && face(ctx, wi, B.cc_inscription)) lore(ctx, wi.x, wi.z, L.epitaph());
  lampsAlong(ctx, H, r, Math.max(2, Math.round((r.x1 - r.x0) / 5)));
  const s = place(ctx, H, r, B.cc_slab, rng.int(0, 1), true);
  if (s) lore(ctx, s.x, s.z, L.epitaph());
  // The broken graves, and the dead in them.
  const h = hand(ctx, H, r);
  if (h && rng.chance(0.5)) {
    const g = near(ctx, H, r, h.x + rng.pick([-2, 2]), h.z + 1, 2);
    if (g) {
      ctx.b.set(g.x, ctx.FY, g.z, B.cc_bones, rng.int(0, 1));
      lore(ctx, g.x, g.z, L.graffiti());
    }
  }
  if (r.x1 - r.x0 >= 16 && rng.chance(0.5)) hand(ctx, H, r);
  // The fossor at his work: his tools, his oil, the ledger.
  const t = place(ctx, H, r, B.cc_tools, rng.int(0, 1), true);
  if (t) lore(ctx, t.x, t.z, rng.chance(0.5) ? L.ledger() : L.tools());
  if (rng.chance(0.5)) place(ctx, H, r, B.cc_amphora, rng.int(0, 1), true);
  band(ctx, H, r, ['fossor'], { x: r.cx, z: r.cz }, 'fossor', { peaceful: true, dormant: 0 });
  band(ctx, H, r, rng.chance(0.5) ? ['lemur', 'lemur'] : ['lemur', 'legion_shade'], { x: r.cx + (rng.chance(0.5) ? 4 : -4), z: r.cz }, 'gallery');
}
// The columbarium: a chamber whose north wall is all niches for the urns
// of the ashes; more urns on stands about an altar in its middle; the
// little lamps at its corners; lemures.
function columbarium(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  floorAll(ctx, H, r, B.cc_mosaicnet);
  for (const w of northWall(ctx, r)) face(ctx, w, B.cc_columbarium);
  const a = near(ctx, H, r, r.cx, r.cz, 1);
  if (a) b.set(a.x, FY, a.z, B.cc_altar);
  // The urns in a ring about the altar, a space between each.
  const ring = tilesOf(ctx, H, r).filter((t) => {
    const d = Math.max(Math.abs(t.x - r.cx), Math.abs(t.z - r.cz));
    return d === 2 && (t.x + t.z) % 2 === 0 && ctx.plan.at(t.x, t.z + 1);
  });
  for (const t of rng.shuffle(ring).slice(0, 6)) b.set(t.x, FY, t.z, B.cc_urn, rng.int(0, 2));
  lampsAlong(ctx, H, r, 3);
  const e = place(ctx, H, r, B.cc_slab, rng.int(0, 1), true);
  if (e) lore(ctx, e.x, e.z, Lof(ctx).epitaph());
  band(ctx, H, r, ['lemur', 'lemur'], { x: r.cx, z: r.cz + 2 }, 'urns');
  if (rng.chance(0.5)) band(ctx, H, r, ['fossor'], { x: r.cx - 2, z: r.cz }, 'fossor', { peaceful: true, dormant: 0 });
}
// The basilica: the legion's hall. A nave of inlaid marble down its
// travertine; a portico raised a step down either side with its columns;
// the tribunal raised at its head (north) with the eagle on it and the
// decree behind; the standard-bearer on the tribunal, and the shades
// ranked down the nave.
function basilica(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  // (Travertine, the nave down its middle laid in inlaid marble.)
  const wide = r.x1 - r.x0 >= 14 ? 2 : 1;
  floorAll(ctx, H, r, B.cc_flags);
  floorAll(ctx, H, r, B.cc_sectile, (x) => Math.abs(x - r.cx) <= wide);
  // The porticoes: a strip raised a step along the west and east walls,
  // steps at either end of each, its columns along its inner edge.
  for (const side of [-1, 1]) {
    const col = side < 0 ? r.x0 : r.x1;
    const strip = [];
    for (let z = r.z0 + 2; z <= r.z1 - 1; z++) if (clear(ctx, H, r, col, z) && clear(ctx, H, r, col + (side < 0 ? 1 : -1), z) && !H.doorBlocked(ctx.plan, r, col, z + 1) && !H.doorBlocked(ctx.plan, r, col, z - 1)) strip.push({ x: col, z });
    const run = longestRun(strip, false);
    if (run.length < 4) continue;
    for (const t of run.slice(1, -1)) raise(ctx, H, t.x, t.z, B.cc_portico);
    // (Its steps, at either end, facing along it.)
    b.set(run[0].x, FY, run[0].z, B.cc_portsteps, 2);
    lifted(ctx, run[0].x, run[0].z);
    const e = run[run.length - 1];
    b.set(e.x, FY, e.z, B.cc_portsteps, 0);
    lifted(ctx, e.x, e.z);
    // Its columns, on its floor, every third tile.
    for (const [i, t] of run.slice(1, -1).entries()) if (i % 3 === 1 && b.get(t.x, FY + 1, t.z) === B.air) b.set(t.x, FY + 1, t.z, B.cc_column);
  }
  // The tribunal: three or five wide, two deep, against the north wall,
  // its steps in front of its middle.
  const trib = [];
  for (let z = r.z0; z <= r.z0 + 1; z++) for (let x = r.cx - wide; x <= r.cx + wide; x++) if (clear(ctx, H, r, x, z)) trib.push({ x, z });
  let eagle = null;
  if (trib.length >= (2 * wide + 1) * 2 - 1 && clear(ctx, H, r, r.cx, r.z0 + 2)) {
    for (const t of trib) raise(ctx, H, t.x, t.z, B.cc_tribunal);
    b.set(r.cx, FY, r.z0 + 2, B.cc_tribsteps, 0);
    lifted(ctx, r.cx, r.z0 + 2);
    // The eagle on it, and lamps either side.
    eagle = { x: r.cx - 1, z: r.z0 };
    b.set(eagle.x, FY + 1, eagle.z, B.cc_eagle);
    b.set(r.cx + wide, FY + 1, r.z0, B.cc_lamp, META_STATE);
    (out.lamps ||= []).push({ x: b.x0 + r.cx + wide, z: r.z0, y: FY + 1 });
    // The decree, cut in the wall behind it.
    const w = northWall(ctx, r).find((q) => q.x === r.cx);
    if (w && face(ctx, w, B.cc_inscription)) lore(ctx, w.x, w.z, L.decree());
    for (const q of northWall(ctx, r)) if (Math.abs(q.x - r.cx) > wide + 1 && rng.chance(0.4)) face(ctx, q, rng.chance(0.5) ? B.cc_fresco : B.cc_dove);
  }
  // Banners at the nave's foot; tall lamps down it.
  for (const ox of [-3, 3]) {
    const t = near(ctx, H, r, r.cx + ox, r.z1 - 1, 1, (x, z) => ctx.plan.at(x, z + 1));
    if (t) b.set(t.x, FY, t.z, B.cc_banner);
  }
  for (const oz of [3, 6]) {
    for (const ox of [-wide - 2, wide + 2]) {
      const t = near(ctx, H, r, r.cx + ox, r.z0 + oz, 0);
      if (t && ctx.plan.at(t.x, t.z + 1) && rng.chance(0.6)) lamp(ctx, t.x, t.z, true);
    }
  }
  // The legion: its standard-bearer on the tribunal, the shades ranked in
  // the nave in two lines, shields to the front.
  const g = groupOf(ctx, r, 'legion');
  if (eagle) put(ctx, 'aquilifer', r.cx, r.z0 + 1, r, { group: g, dormant: 5 });
  const rows = [r.cz, r.cz + 2].filter((z) => z < r.z1);
  let k = 0;
  for (const z of rows) {
    for (let x = r.cx - 2; x <= r.cx + 2; x += 2) {
      if (k >= 3 + Math.floor(ctx.n / 2) || !clear(ctx, H, r, x, z)) continue;
      put(ctx, 'legion_shade', x, z, r, { group: g, dormant: 5 });
      k++;
    }
  }
}
// The cubiculum: a family's chamber. Frescoes, arched tombs, a
// sarcophagus; the four busts of the ancestors set out before their tree
// on the wall; the family tomb behind its door, which opens to whoever
// honours them in the order of their descent.
function cubiculum(ctx, H, r) {
  const { b, rng, out } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.cc_mosaic);
  const wall = northWall(ctx, r).filter((w) => w.x > r.x0 && w.x < r.x1);
  const ws = wall[Math.floor(wall.length / 2)];
  let tree = null;
  if (ws && face(ctx, ws, B.cc_stemma)) tree = ws;
  for (const w of wall) if (w !== ws && rng.chance(0.55)) face(ctx, w, rng.pick([B.cc_fresco, B.cc_dove, B.cc_arcosolium]));
  for (const w of wall) if (b.get(w.x, FY, w.z) === B.cc_arcosolium) lore(ctx, w.x, w.z, L.epitaph());
  // The busts, in a row before the tree (in another order than the
  // house's: you'll have to read it).
  const busts = [];
  const kinds = rng.shuffle([0, 1, 2, 3]);
  for (const [i, ox] of [-3, -1, 1, 3].entries()) {
    const t = near(ctx, H, r, r.cx + ox, r.z0 + 2, 1, (x, z) => ctx.plan.at(x, z + 1) && !busts.some((q) => Math.abs(q.x - x) < 2));
    if (!t) break;
    b.set(t.x, FY, t.z, B.cc_bust, kinds[i]);
    busts.push({ ...t, kind: kinds[i] });
  }
  const pk = busts.length === 4 ? pocket(ctx, H, r, B.cc_tufa) : null;
  if (pk) {
    for (const y of [FY, FY + 1]) b.set(pk.door.x, y, pk.door.z, B.cc_tombdoor);
    const back = pk.back;
    b.set(back.x, FY, back.z, B.chest, 0);
    b.container(back.x, FY, back.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.8, ctx.T), ['old_coin', rng.int(6, 14)], [rng.pick(['gold_ingot', 'gem']), 1]], H.foundIn(ctx, false)));
    for (const c of pk.cells) {
      if (c === back || (c.x === pk.cells[0].x && c.z === pk.cells[0].z) || b.get(c.x, FY, c.z) !== B.air) continue;
      if (rng.chance(0.5)) b.set(c.x, FY, c.z, rng.chance(0.5) ? B.cc_urn : B.cc_lucerna, rng.chance(0.5) ? rng.int(0, 2) : META_STATE);
    }
    ctx.reserved.add(key(ctx, pk.door.x - pk.dir.x, pk.door.z - pk.dir.z));
    (out.busts ||= []).push({ busts: busts.map((q) => ({ ...abs(ctx, q), kind: q.kind })), order: L.house.map((h) => h.kind), names: Object.fromEntries(L.house.map((h) => [h.kind, h.name])), door: abs(ctx, pk.door), room: r.id });
    if (tree) lore(ctx, tree.x, tree.z, L.stemma());
  } else {
    // (No tomb to open: the busts only busts, and the tree its names.)
    if (tree) lore(ctx, tree.x, tree.z, L.stemma());
  }
  const s = place(ctx, H, r, B.cc_sarcophagus, 0, true);
  if (s) lore(ctx, s.x, s.z, L.sarcophagus());
  lampsAlong(ctx, H, r, 2);
  band(ctx, H, r, ['lemur'], { x: r.cx, z: r.z1 - 1 }, 'house');
}
// The ossuary: its north wall all skulls; a pit sunk in its middle, its
// floor bones, dead hands reaching up out of it; a loft two up along its
// back wall with a sarcophagus on it and a ladder up; bones heaped.
function ossuary(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.cc_tufafloor);
  for (const w of northWall(ctx, r)) face(ctx, w, B.cc_skulls, rng.int(0, 1));
  // The loft (as a flue's ledge: along the back wall, a ladder up its
  // middle), before the pit is dug, so the pit keeps clear of it.
  const S = backSeen(ctx, H, r);
  const lo = (S.along ? r.x0 : r.z0) + 1;
  const hi = (S.along ? r.x1 : r.z1) - 1;
  const row0 = [];
  for (let a = lo; a <= hi; a++) {
    const t = at2(S, a, S.back);
    if (clear(ctx, H, r, t.x, t.z)) row0.push(t);
  }
  const loft = longestRun(row0, S.along).slice(0, 5);
  const front = (t) => ({ x: t.x + (S.along ? 0 : S.out), z: t.z + (S.along ? S.out : 0) });
  const li = loft.length >= 3 ? [1, 2].find((i) => i < loft.length - 1 && clear(ctx, H, r, front(loft[i]).x, front(loft[i]).z)) : undefined;
  if (li !== undefined) {
    for (const t of loft) raise(ctx, H, t.x, t.z, B.cc_tufa, 2);
    const lt = loft[li];
    const far = li > (loft.length - 1) / 2 ? loft[0] : loft[loft.length - 1];
    b.set(far.x, FY + 2, far.z, B.chest, 0);
    b.container(far.x, FY + 2, far.z, H.fill(rng, 18, [...H.lootFor(ctx.rec.type, H.tierOf(ctx), rng, 1.5, ctx.T), ['old_coin', rng.int(3, 8)]], H.foundIn(ctx, false)));
    const sx = loft.find((t) => t !== far && t !== lt);
    if (sx) {
      b.set(sx.x, FY + 2, sx.z, B.cc_sarcophagus);
      lore(ctx, sx.x, sx.z, L.sarcophagus());
    }
    const { x: lx, z: lz } = front(lt);
    const d = S.along ? (S.out < 0 ? 0 : 2) : S.out < 0 ? 3 : 1;
    for (const y of [FY, FY + 1]) b.set(lx, y, lz, B.cc_ladder, d);
    ctx.reserved.add(key(ctx, lx, lz));
  }
  // The bone pit, in the room's middle (clear of the walls, the ways in).
  const w = r.x1 - r.x0 + 1;
  const dd = r.z1 - r.z0 + 1;
  const pit = [];
  for (const t of tilesOf(ctx, H, r)) {
    const q = Math.hypot((t.x - r.cx) / (w * 0.5), (t.z - r.cz - 1) / (dd * 0.5));
    if (q < 0.45 && !H.byWall(ctx.plan, t.x, t.z)) pit.push(t);
  }
  for (const t of pit) sink(ctx, H, t.x, t.z, B.cc_bonefloor);
  // What's in it: hands reaching up out of the bones, and skulls heaped.
  const g = groupOf(ctx, r, 'pit');
  for (const t of rng.shuffle(pit.slice()).slice(0, rng.int(1, 2))) put(ctx, 'loculus_hand', t.x, t.z, r, { group: g, pit: true, lying: true });
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.cc_skullpile, 0, true);
  const bn = place(ctx, H, r, B.cc_bones, rng.int(0, 1));
  if (bn) lore(ctx, bn.x, bn.z, L.graffiti());
  lampsAlong(ctx, H, r, 2);
  band(ctx, H, r, rng.chance(0.5) ? ['legion_shade', 'lemur'] : ['skeleton', 'legion_shade'], { x: r.cx, z: r.z1 - 1 }, 'bones');
}
// The triumph: the hall of the emperor's victories. A floor of mosaic in
// rings about a disc of inlaid marble; the relief of the Triumph along its
// north wall; statues, the trophy of arms, banners; the legion on parade.
function triumph(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  floorAll(ctx, H, r, B.cc_flags);
  floorAll(ctx, H, r, B.cc_mosaicnet, (x, z) => Math.max(Math.abs(x - r.cx), Math.abs(z - r.cz)) <= 3);
  floorAll(ctx, H, r, B.cc_sectile, (x, z) => Math.max(Math.abs(x - r.cx), Math.abs(z - r.cz)) <= 1);
  const wall = northWall(ctx, r).filter((w) => w.x > r.x0 && w.x < r.x1);
  const mid = Math.floor(wall.length / 2);
  let told = false;
  for (const [i, w] of wall.entries()) {
    if (Math.abs(i - mid) > 2) continue;
    if (face(ctx, w, B.cc_relief) && !told) {
      lore(ctx, w.x, w.z, L.relief());
      told = true;
    }
  }
  for (const ox of [-4, 4]) {
    const t = near(ctx, H, r, r.cx + ox, r.z0 + 1, 1, (x, z) => ctx.plan.at(x, z + 1));
    if (t) b.set(t.x, FY, t.z, B.cc_statue, ox < 0 ? 0 : 1);
  }
  const tp = place(ctx, H, r, B.cc_tropaeum, rng.int(0, 1), true);
  if (!tp) place(ctx, H, r, B.cc_banner, 0, true);
  place(ctx, H, r, B.cc_banner, 0, true);
  lampsAlong(ctx, H, r, 3, true);
  band(ctx, H, r, rng.chance(0.6) ? ['aquilifer', 'legion_shade', 'legion_shade'] : ['legion_shade', 'legion_shade', 'skeleton'], { x: r.cx, z: r.cz + 1 }, 'parade');
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'galleria':
      return galleria(ctx, H, r);
    case 'columbarium':
      return columbarium(ctx, H, r);
    case 'basilica':
      return basilica(ctx, H, r);
    case 'cubiculum':
      return cubiculum(ctx, H, r);
    case 'ossuary':
      return ossuary(ctx, H, r);
    case 'triumph':
      return triumph(ctx, H, r);
  }
}

// What the old rooms set about, the catacomb's own instead: its bones,
// statues, banners, urns, candles and braziers (lamps now, the fossors'),
// and the pillars of the pillared hall (columns).
const OWN_OF = new Map([[B.bones, B.cc_bones], [B.statue, B.cc_statue], [B.war_banner, B.cc_banner], [B.urn, B.cc_urn], [B.candles, B.cc_lucerna], [B.rubble, B.cc_rubble], [B.skull_pile, B.cc_skullpile]].filter(([a, c]) => a !== undefined && c !== undefined));
function ownThings(ctx, H, r) {
  const { b, out } = ctx;
  const puzzle = new Set((out.braziers || []).flatMap((q) => q.set.map((s) => `${s.x - b.x0},${s.z}`)));
  for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const id = b.get(x, H.FY, z);
      if (id === B.brazier && !puzzle.has(`${x},${z}`)) {
        lamp(ctx, x, z, true);
        continue;
      }
      // (The pillared hall's pillars: columns standing free.)
      if (r.kit === 'pillared' && id === ctx.T.wall && H.own(ctx.plan, r, x, z)) {
        b.set(x, H.FY, z, B.cc_column);
        b.set(x, H.FY + 1, z, B.air);
        continue;
      }
      const to = OWN_OF.get(id);
      if (!to) continue;
      if (to === B.cc_lucerna) lamp(ctx, x, z);
      else b.set(x, H.FY, z, to, to === B.cc_urn ? (x * 7 + z * 3) % 3 : (x + z) % 2);
    }
  }
}

// The old rooms, dressed as they were (see dungeongen.dressBase), and the
// catacomb's own about them.
function extra(ctx, r, H) {
  const { b, rng } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  const L = Lof(ctx);
  ownThings(ctx, H, r);
  switch (r.kit) {
    case 'entry': {
      // On the first floor, the dedication over the way in.
      if (ctx.n === 0) {
        const w = northWall(ctx, r).filter((q) => q.x > r.x0 && q.x < r.x1);
        const c = w[Math.floor(w.length / 2)];
        if (c && face(ctx, c, B.cc_inscription)) lore(ctx, c.x, c.z, L.dedication());
      }
      lampsAlong(ctx, H, r, 2);
      break;
    }
    case 'legion':
      // The legion's ranks: their standard-bearer at the head of the line.
      floorAll(ctx, H, r, B.cc_flags);
      if (rng.chance(0.6)) band(ctx, H, r, ['aquilifer'], { x: r.cx, z: r.z0 + 1 }, 'ranks');
      break;
    case 'mosaic':
      // The floor laid as a carpet: a field of the black net, framed in
      // travertine along the walls; at its heart a panel of inlaid marble
      // in a frame of its own.
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
        if (!H.own(ctx.plan, r, x, z) || isUp(ctx, x, z)) continue;
        const ring = Math.max(Math.abs(x - r.cx), Math.abs(z - r.cz));
        const edge = x === r.x0 || x === r.x1 || z === r.z0 || z === r.z1;
        floorAt(ctx, x, z, edge || ring === 2 ? B.cc_flags : ring <= 1 ? B.cc_sectile : B.cc_mosaicnet);
      }
      break;
    case 'burial':
      floorAll(ctx, H, r, B.cc_tufafloor);
      loculi(ctx, H, r, 0.5);
      if (rng.chance(0.5)) hand(ctx, H, r);
      break;
    case 'shrine': {
      floorAll(ctx, H, r, B.cc_mosaic);
      for (const w of northWall(ctx, r)) if (rng.chance(0.4)) face(ctx, w, rng.pick([B.cc_fresco, B.cc_dove]));
      break;
    }
    case 'treasure':
      floorAll(ctx, H, r, B.cc_sectile);
      break;
    case 'boss': {
      // The master's hall is the legion's own: a nave of inlaid marble,
      // banners, tall lamps, frescoes; and the hall's own word, cut by it.
      floorAll(ctx, H, r, B.cc_sectile);
      floorAll(ctx, H, r, B.cc_porphyry, (x, z) => Math.abs(x - r.cx) <= 1 && Math.abs(z - r.cz) <= 1);
      for (const q of northWall(ctx, r)) if (rng.chance(0.3)) face(ctx, q, rng.chance(0.5) ? B.cc_fresco : B.cc_relief);
      for (const ox of [-4, 4]) {
        const t = near(ctx, H, r, r.cx + ox, r.z0 + 1, 1, (x, z) => ctx.plan.at(x, z + 1));
        if (t) b.set(t.x, FY, t.z, B.cc_banner);
      }
      const w = northWall(ctx, r).filter((q) => Math.abs(q.x - r.cx) >= 2 && b.get(q.x, FY, q.z) === ctx.T.wall);
      const c = rng.pick(w);
      if (c && face(ctx, c, B.cc_inscription)) lore(ctx, c.x, c.z, L.last());
      break;
    }
  }
}

// Each room set about with the catacomb's things, by what it is, spaced
// out, the solid ones against the walls; its walls given their faces (the
// galleries' graves, a fresco now and then); its floor as it was laid.
const DECOR = {
  entry: [['cc_urn', 1], ['cc_statue', 1], ['cc_banner', 1]],
  exit: [['cc_urn', 1], ['cc_bones', 1]],
  legion: [['cc_banner', 1], ['cc_bones', 1]],
  mosaic: [['cc_urn', 1], ['cc_statue', 1]],
  pillared: [['cc_urn', 1], ['cc_rubble', 1]],
  burial: [['cc_urn', 1], ['cc_bones', 1]],
  shrine: [['cc_urn', 1], ['cc_altar', 1]],
  collapsed: [['cc_rubble', 2], ['cc_bones', 1]],
  trap: [['cc_bones', 1]],
  treasure: [['cc_urn', 2], ['cc_amphora', 1]],
  guard: [['cc_banner', 1], ['cc_rubble', 1]],
  galleria: [['cc_urn', 1], ['cc_bones', 1]],
  columbarium: [['cc_amphora', 1]],
  basilica: [['cc_urn', 1]],
  cubiculum: [['cc_urn', 1]],
  ossuary: [['cc_bones', 2]],
  triumph: [['cc_urn', 1]],
};
const SOLID = new Set(['cc_urn', 'cc_statue', 'cc_banner', 'cc_rubble', 'cc_amphora', 'cc_altar', 'cc_skullpile']);
const ROT = new Set(['cc_urn', 'cc_bones', 'cc_rubble', 'cc_amphora']);
// The old rooms' own floors, as the emperor's builders laid them.
const OLD_FLOOR = { entry: B.cc_flags, exit: B.cc_flags, legion: B.cc_flags, pillared: B.cc_sectile, guard: B.cc_flags, collapsed: B.cc_tufafloor, trap: B.cc_tufafloor };
function crowd(ctx, H, r) {
  let n = 0;
  let solid = 0;
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(ctx.plan, r, x, z)) continue;
      n++;
      if (BLOCKS[ctx.b.get(x, H.FY, z)].solid) solid++;
    }
  }
  return n ? solid / n : 1;
}
function decorate(ctx, r, H) {
  const { rng, plan, b } = ctx;
  const FY = H.FY;
  ctx.FY = FY;
  if (r.sealed && r.kit !== 'treasure') return;
  let area = 0;
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(plan, r, x, z)) area++;
  if (OLD_FLOOR[r.kit]) floorAll(ctx, H, r, OLD_FLOOR[r.kit], (x, z) => b.get(x, FY - 1, z) === ctx.T.floor);
  // Its walls: the net, now and then a fresco or a grave in it.
  if (!CATA_OWN.has(r.kit)) {
    for (const w of northWall(ctx, r)) {
      const p = rng.float(0, 1);
      if (p < 0.08) face(ctx, w, B.cc_fresco);
      else if (p < 0.12) face(ctx, w, B.cc_dove);
      else if (p < 0.2) face(ctx, w, B.cc_loculi_open);
    }
  }
  // And its things, spaced out.
  const list = DECOR[r.kit];
  if (!list) return;
  const n = Math.max(1, Math.round((area / 30) * rng.float(0.7, 1.2)));
  const set = [];
  for (let i = 0; i < n; i++) {
    if (crowd(ctx, H, r) > 0.2) break;
    const k = rng.weighted(list);
    for (let t = 0; t < 12; t++) {
      const at = place(ctx, H, r, B[k], ROT.has(k) ? rng.int(0, 2) : 0, SOLID.has(k));
      if (!at) break;
      let close = set.some((q) => Math.max(Math.abs(q.x - at.x), Math.abs(q.z - at.z)) < 2);
      for (let oz = -1; oz <= 1 && !close; oz++) for (let ox = -1; ox <= 1; ox++) if ((ox || oz) && plan.at(at.x + ox, at.z + oz) && b.get(at.x + ox, FY, at.z + oz) !== B.air) close = true;
      if (close) {
        b.set(at.x, FY, at.z, B.air);
        continue;
      }
      set.push(at);
      break;
    }
  }
}

// Its architect's last word: the lamps still standing (their place on the
// floor, for the lemures and the fossors), the graves still sealed, the
// busts still in their places.
function after(ctx) {
  const { out, b } = ctx;
  const FY = ctx.FY;
  const isLamp = (q) => {
    const id = b.get(q.x - b.x0, q.y || FY, q.z);
    return id === B.cc_lamp || id === B.cc_lucerna;
  };
  out.lamps = (out.lamps || []).filter(isLamp);
  out.loculi = (out.loculi || []).filter((q) => b.get(q.x - b.x0, FY, q.z) === B.cc_loculi);
  out.busts = (out.busts || []).filter((q) => q.busts.every((t) => b.get(t.x - b.x0, FY, t.z) === B.cc_bust) && b.get(q.door.x - b.x0, FY, q.door.z) === B.cc_tombdoor);
}

export const CATA_ARCH = {
  own: CATA_OWN,
  kits,
  // (The family's chamber and its galleries never lost to the way down.)
  keep: new Set(['cubiculum', 'galleria', 'basilica']),
  spare: (rng, n, have = []) => {
    const pool = [['galleria', 2], ['columbarium', 1], ['legion', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'legion';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
// (What a catacomb's own things are, for those who count them.)
export const CATA_THINGS = ['cc_lamp', 'cc_lucerna', 'cc_urn', 'cc_sarcophagus', 'cc_bust', 'cc_statue', 'cc_eagle', 'cc_column', 'cc_tropaeum', 'cc_altar', 'cc_bones', 'cc_skullpile', 'cc_amphora', 'cc_tools', 'cc_slab', 'cc_rubble', 'cc_ladder', 'cc_banner'].filter((k) => BLOCKS[B[k]]);
