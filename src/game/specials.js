// (Round 139) Each weapon's special. Hold the button down with it (on a
// foe, or at the air in front of you) and it winds up: the ground it will
// cover lights up under you in its own colour, filling as it comes, so
// whoever's there (and whoever else is playing) can see it coming. Let go
// once it's ready (a flash, a ping) and it's not the plain blow but the
// weapon's own move; let go before, and it's the plain blow after all.
//   The light ones are quick to wind up and some take less breath than a
// plain blow (a shove with the shoulder, a step through the shadows behind
// a foe, a staff swept round at ankle height); the heavy ones are slow and
// cost dear, and do a great deal more: a whirlwind of axe, a leap and a
// cleave, a hammer brought down so hard the ground splits round it.
//   Each special sets off the "special" trigger of a forged piece (see
// world/triggers.js); the heavy ones, the "smash" trigger too.
//   Plain data and the ground each covers here (the renderer draws the
// warning from it, on every screen: see render/specialfx.js); what each
// does, in play, below.
import { ITEMS } from '../world/items.js';
import { weaponStyle, styleOf, spend, strikeAnim, MAX_STAMINA } from './combat.js';
import { fireTrigger } from './abilities.js';
import { padded, padOf } from '../entities/footprint.js';

// name, what it does (`about`), its stamina cost beside the plain blow's
// (`cost`), how long it winds up (`charge`), how heavy (`weight`: 0 a
// fist's, 5 a war hammer's), how hard it lands (`mult`), its colour
// (`pal`: see render/abilityfx.js), and how long after before another
// blow (`recover`).
export const SPECIALS = {
  shove: { name: 'Shoulder Barge', about: 'a step in and the shoulder into them: thrown back two paces and left reeling', cost: 0.5, charge: 0.4, weight: 0, mult: 0.5, pal: 'earth', recover: 0.5 },
  shadow: { name: 'Shadowstep', about: 'gone from where you stood and behind them, the blade in their back: twice as hard, and telling', cost: 1.5, charge: 0.42, weight: 1, mult: 2.2, pal: 'violet', recover: 0.55 },
  lunge: { name: 'Lunge', about: 'two paces forward in a flash, point first, through everyone in the way', cost: 3, charge: 0.5, weight: 2, mult: 1.5, pal: 'steel', recover: 0.6 },
  flurry: { name: 'Flurry', about: 'three quick cuts across the front of you, one after another', cost: 2.5, charge: 0.45, weight: 1, mult: 0.7, pal: 'steel', recover: 0.6 },
  sweep: { name: 'Leg Sweep', about: 'the staff swung round at ankle height: everyone about you knocked off their feet', cost: 1.5, charge: 0.45, weight: 1, mult: 0.6, pal: 'wind', recover: 0.55 },
  skewer: { name: 'Skewer', about: 'a long thrust three paces out, through all of them in the line, and back they go', cost: 4, charge: 0.55, weight: 2, mult: 1.4, pal: 'steel', recover: 0.7 },
  haul: { name: 'Haul In', about: 'the harpoon flung out four paces on its line and the first one it takes dragged in to you', cost: 3.5, charge: 0.55, weight: 2, mult: 1.1, pal: 'water', recover: 0.7 },
  crack: { name: 'Skull Crack', about: 'an overhead blow on the crown of the head: they\'re stunned where they stand', cost: 4, charge: 0.62, weight: 3, mult: 1.7, pal: 'gold', recover: 0.8 },
  whirl: { name: 'Whirlwind', about: 'round and round with the axe: everyone about you hewn, through their guard, and thrown back', cost: 5, charge: 0.66, weight: 3, mult: 1.4, pal: 'steel', recover: 0.9 },
  reap: { name: 'Chain Reap', about: 'the head let out on its chain in a wide arc two paces deep, over and round shields', cost: 5, charge: 0.66, weight: 3, mult: 1.5, pal: 'blood', recover: 0.9 },
  hew: { name: 'Reaping Arc', about: 'a great hewing half-circle at full reach, five paces wide, and all of it thrown back', cost: 6, charge: 0.76, weight: 4, mult: 1.7, pal: 'storm', recover: 1.0 },
  cleave: { name: 'Leaping Cleave', about: 'a leap two paces forward and the blade brought down where you land: all before you cleft', cost: 7, charge: 0.82, weight: 4, mult: 2.0, pal: 'fire', recover: 1.1 },
  quake: { name: 'Earthshaker', about: 'the hammer brought down on the ground before you: it splits, and the shock throws down all within two paces', cost: 8, charge: 0.9, weight: 5, mult: 2.1, pal: 'earth', recover: 1.2 },
};
export const SPECIAL_KEYS = Object.keys(SPECIALS);

// Which special each way of fighting has (and a few weapons their own).
const BY_STYLE = { fist: 'shove', dagger: 'shadow', sword: 'lunge', staff: 'sweep', spear: 'skewer', club: 'crack', axe: 'whirl', flail: 'reap', halberd: 'hew', great: 'cleave', maul: 'quake' };
const BY_BASE = { sabre: 'flurry', short_sword: 'flurry', harpoon: 'haul' };

// The special of what's in hand (bare hands too); null for a bow, a sling,
// a crossbow: holding the button down draws those.
export function specialOf(key) {
  const base = key ? String(key).split(/[+~]/)[0] : null;
  const d = base ? ITEMS[base] || ITEMS[key] : null;
  if (d && d.ranged) return null;
  if (base && BY_BASE[base]) return BY_BASE[base];
  return BY_STYLE[weaponStyle(key)] || 'shove';
}

// One of the eight ways, from any direction.
export function heading(dx, dz) {
  const a = Math.atan2(dz, dx);
  const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][k];
}

// (Round 142) The ground a special covers, as shapes, not squares: a blow
// swung on the slant used to land a square aside of whoever it was swung
// at. Each from the middle of the square you stand on, (x, z), at angle
// `ang` (the world's way round: atan2(dz, dx)), and each one of:
//   circle: { t, x, z, r }: all within `r` of (x, z);
//   cone: { t, x, z, ang, r, half, r0 }: a slice of a circle, `half` (in
//     radians) either side of its line, from `r0` out to `r`;
//   box: { t, x, z, ang, from, len, hw }: a strip along its line, from
//     `from` to `len` out, `hw` either side of it;
// each with `w`, how hard it lands there (a hammer's shock weaker at the
// edge; 0: only a way, where nothing's struck); and { t: 'go', x, z }:
// the square you'll be on (a lunge's end, a leap's landing, the step
// behind a foe). `at`: whoever it's aimed at, for those that go to someone;
// `land`: where a leap comes down, if it's not its full two paces.
export function specialShapes(k, x, z, ang, at = null, land = null) {
  const ux = Math.cos(ang);
  const uz = Math.sin(ang);
  const [hx, hz] = heading(ux, uz);
  const box = (from, len, hw, w = 1) => ({ t: 'box', x, z, ang, from, len, hw, w });
  const cone = (r, half, r0 = 0, w = 1) => ({ t: 'cone', x, z, ang, r, half, r0, w });
  const circle = (cx, cz, r, w = 1) => ({ t: 'circle', x: cx, z: cz, r, w });
  switch (k) {
    case 'shove': return [box(0.2, 1.7, 0.55)];
    case 'crack': return [box(0.2, 1.8, 0.6)];
    case 'shadow': {
      if (!at) return [box(0.3, 2.3, 0.3, 0)];
      const [bx, bz] = heading(at.x - x, at.z - z);
      return [circle(at.x, at.z, 0.7), { t: 'go', x: at.x + bx, z: at.z + bz }];
    }
    case 'lunge': return [box(0.2, 3.3, 0.6), { t: 'go', x: x + hx * 2, z: z + hz * 2 }];
    case 'skewer': return [box(0.2, 3.7, 0.55)];
    case 'haul': return [box(0.2, 4.6, 0.45)];
    case 'flurry': return [cone(1.95, 1.05)];
    case 'sweep': return [circle(x, z, 1.65)];
    case 'whirl': return [circle(x, z, 1.8)];
    case 'reap': return [cone(2.75, 0.95)];
    case 'hew': return [cone(2.9, 1.45)];
    case 'cleave': {
      const L = land || { x: x + hx * 2, z: z + hz * 2 };
      return [box(0.3, 1.5, 0.4, 0.6), circle(L.x + ux * 0.7, L.z + uz * 0.7, 1.55), { t: 'go', x: L.x, z: L.z }];
    }
    case 'quake': {
      const cx = x + ux * 1.2;
      const cz = z + uz * 1.2;
      return [circle(cx, cz, 1.55), circle(cx, cz, 2.65, 0.55)];
    }
    default: return [box(0.2, 1.6, 0.5)];
  }
}

// How hard a shape lands on a point, as round as `rad` (0: not at all).
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function shapeHit(s, px, pz, rad = 0) {
  const vx = px - s.x;
  const vz = pz - s.z;
  if (s.t === 'circle') return Math.hypot(vx, vz) <= s.r + rad ? s.w : 0;
  if (s.t === 'box') {
    const ux = Math.cos(s.ang);
    const uz = Math.sin(s.ang);
    const along = vx * ux + vz * uz;
    const side = Math.abs(vx * uz - vz * ux);
    return along >= s.from - rad && along <= s.len + rad && side <= s.hw + rad ? s.w : 0;
  }
  if (s.t === 'cone') {
    const d = Math.hypot(vx, vz);
    if (d - rad > s.r || d + rad < s.r0) return 0;
    // (As round as it is: a little more of the slice takes it in, the
    // nearer it is.)
    const slack = d > 0.01 ? Math.asin(Math.min(1, rad / d)) : Math.PI;
    return Math.abs(wrap(Math.atan2(vz, vx) - s.ang)) <= s.half + slack ? s.w : 0;
  }
  return 0;
}

// The most a special's shapes land on a point (0: none of them).
export function shapesAt(shapes, px, pz, rad = 0) {
  let w = 0;
  for (const s of shapes) if (s.t !== 'go') w = Math.max(w, shapeHit(s, px, pz, rad));
  return w;
}

// How hard they land on someone, by the whole of them: one standing on
// their square (a little less than a square across), a master drawn half
// as big again (to its edge), a great one filling three paces or more (any
// square of it), a worm's coils (each square of it). 0: not at all.
export function shapesOn(shapes, e) {
  if (!e) return 0;
  if (e.bodyTiles && e.bodyTiles.size) {
    let w = 0;
    for (const k of e.bodyTiles) w = Math.max(w, shapesAt(shapes, Math.floor(k / 65536), k % 65536, 0.45));
    if (w) return w;
  }
  const rad = e.foot ? e.foot + 0.45 : padded(e) ? padOf(e) : 0.42;
  return shapesAt(shapes, e.x, e.z, rad);
}

// The squares whose middles they take in (for what's not a body: a straw
// man in the practice yard).
export function shapeTiles(shapes) {
  const pts = shapes.filter((s) => s.t !== 'go');
  if (!pts.length) return [];
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const s of pts) {
    const reach = s.t === 'circle' ? s.r : s.t === 'box' ? s.len + s.hw : s.r;
    x0 = Math.min(x0, Math.floor(s.x - reach));
    x1 = Math.max(x1, Math.ceil(s.x + reach));
    z0 = Math.min(z0, Math.floor(s.z - reach));
    z1 = Math.max(z1, Math.ceil(s.z + reach));
  }
  const out = [];
  for (let tx = x0; tx <= x1; tx++) {
    for (let tz = z0; tz <= z1; tz++) {
      const w = shapesAt(pts, tx, tz);
      if (w > 0) out.push({ x: tx, z: tz, w });
    }
  }
  return out;
}

// How far out from (x, z) they reach (for the warning to fill out to).
export function shapesReach(shapes, x, z) {
  let far = 1;
  for (const s of shapes) {
    if (s.t === 'go') continue;
    const d = Math.hypot(s.x - x, s.z - z);
    far = Math.max(far, s.t === 'circle' ? d + s.r : s.t === 'box' ? d + s.len : d + s.r);
  }
  return far;
}

// ------------------------------------------------------------ in play
// Winding up: whoever's watching sees it on you (`spec`: its kind, how far
// wound up, which way, who at), every screen alike (it goes over the wire
// with you: see net/wire.js).
export function windSpecial(game, p, ch, dt) {
  const sp = SPECIALS[ch.k];
  if (!sp) return;
  ch.t += dt;
  const a = Math.min(1, ch.t / sp.charge);
  const at = ch.target && !ch.target.dead ? { x: Math.round(ch.target.x), z: Math.round(ch.target.z) } : null;
  // (Round 142: and which way exactly, not only the nearest of eight.)
  const ang = Math.round(aimOf(ch) * 100) / 100;
  const spec = { k: ch.k, a: Math.round(a * 10) / 10, dx: ch.dx, dz: ch.dz, ang, y: p.y };
  if (at && (ch.k === 'shadow' || ch.k === 'haul')) {
    spec.tx = at.x;
    spec.tz = at.z;
  }
  const s0 = p.spec;
  if (!s0 || s0.k !== spec.k || s0.a !== spec.a || s0.dx !== spec.dx || s0.dz !== spec.dz || s0.ang !== spec.ang || s0.tx !== spec.tx || s0.tz !== spec.tz) p.spec = spec;
  if (a >= 1 && !ch.ready) {
    ch.ready = true;
    game.audio?.play('sp_ready', p);
    game.renderer?.effect?.({ type: 'sp_ready', wx: p.x, wy: p.y, wz: p.z, oy: -14, pal: sp.pal, life: 0.35 });
  }
}

// (Round 142) The way a special's wound up toward, exactly: at whoever it's
// aimed at, else where the pointer was (`ang`), else the nearest of the
// eight ways it was given.
export function aimOf(ch, from = null) {
  const t = ch.target && !ch.target.dead ? ch.target : null;
  if (t && from) return Math.atan2(t.z - from.z, t.x - from.x);
  if (typeof ch.ang === 'number') return ch.ang;
  return Math.atan2(ch.dz ?? 1, ch.dx ?? 0);
}

// Let go before it's ready, or thought better of (a roll, a stun).
export function dropSpecial(p) {
  if (p.spec) p.spec = undefined;
}

// Can a special go off just now?
export function specialReady(p) {
  return !(p.dead || p.down || p.stunT > 0 || p.rollT > 0 || p.guardBroken > 0 || p.swing || p.commitT > 0 || p.tunnel || p.swallowed || p.mount || p.raft || p.sleeping || p.restrained);
}

// Let go, wound up: the weapon's special. `ch`: { k, dx, dz, target }.
// What it struck (an array), or null if it couldn't go off.
export function doSpecial(game, p, ch) {
  const sp = SPECIALS[ch.k];
  dropSpecial(p);
  if (!sp || !specialReady(p)) return null;
  if ((p.stamina ?? MAX_STAMINA) < Math.min(1, sp.cost)) {
    game.ui?.msg?.('Too winded for that.', '#c8c8c8', true);
    return null;
  }
  const fresh = spend(p, sp.cost);
  // (Round 142) Struck the way it was aimed, exactly; stepped (a lunge, a
  // leap) the nearest of the eight ways to it, as you walk.
  const ang = aimOf(ch, p);
  const [dx, dz] = heading(Math.cos(ang), Math.sin(ang));
  p.face(p.x + dx, p.z + dz);
  p.blocking = false;
  p.sitting = null;
  const x0 = p.x;
  const z0 = p.z;
  const target = ch.target && !ch.target.dead ? ch.target : null;
  const c = { dx, dz, ang, x0, z0, target, fresh };
  const hits = (MOVES[ch.k] || MOVES.shove)(game, p, sp, c);
  // (Nobody there but a straw man in the practice yard: it takes it, and
  // counts as the held strike a lesson asks for.)
  if (!hits.length && game.dummyOn && game.hitDummy) {
    const dm = game.dummyOn(shapeTiles(specialShapes(ch.k, x0, z0, ang, target)), p);
    if (dm) {
      const { dmg, crit } = game.blowDamage(false, fresh, styleOf(p));
      game.hitDummy(dm, Math.max(1, Math.round(dmg * sp.mult)), crit, { heavy: true });
    }
  }
  // (Its look along the way it was aimed, too.)
  const fx = { type: `sp_${ch.k}`, wx: x0, wy: p.y, wz: z0, dx: Math.round(Math.cos(ang) * 100) / 100, dz: Math.round(Math.sin(ang) * 100) / 100, pal: sp.pal, life: FX_LIFE[ch.k] || 0.5 };
  if (ch.k === 'shadow' || ch.k === 'haul' || ch.k === 'cleave' || ch.k === 'lunge') {
    fx.tx = p.x;
    fx.tz = p.z;
    // (The line out to where it took them, before they were dragged in.)
    if (ch.k === 'haul') [fx.tx, fx.tz] = c.took ? [c.took.x, c.took.z] : [x0 + dx * 4, z0 + dz * 4];
  }
  game.renderer?.effect?.(fx);
  game.audio?.play(`sp_${ch.k}`, p);
  strikeAnim(p, { ...styleOf(p), heavy: sp.weight >= 3 });
  p.doAction?.(sp.weight >= 3 ? 0.4 : 0.28);
  game.shake = Math.min(1.4, (game.shake || 0) + 0.06 * (sp.weight + 1));
  p.attackCd = Math.max(p.attackCd || 0, sp.recover * (fresh ? 1 : 1.6));
  p.commitT = Math.max(p.commitT || 0, 0.12 + sp.weight * 0.05);
  // (Round 139: a forged piece's trigger; a heavy one's a heavy blow, too.)
  fireTrigger(game, p, 'special', { target: hits[0] || target, special: ch.k });
  if (sp.weight >= 3 && hits.length) fireTrigger(game, p, 'smash', { target: hits[0] });
  return hits;
}

// How long each one's look lasts.
const FX_LIFE = { shove: 0.45, shadow: 0.6, lunge: 0.5, flurry: 0.55, sweep: 0.55, skewer: 0.5, haul: 0.6, crack: 0.7, whirl: 0.65, reap: 0.6, hew: 0.65, cleave: 0.8, quake: 1.1 };

// Foes the shapes take in (else anyone at all there: a special swung at a
// passer-by is an assault, as any blow).
function struck(game, p, shapes) {
  const hit = (e) => shapesOn(shapes, e) > 0;
  return game.struckOn ? game.struckOn(hit, p) : [];
}
// A blow of the special's on one of them.
function blow(game, p, e, sp, fresh, mult, o = {}) {
  if (game.specialBlow) return game.specialBlow(e, mult * sp.mult, sp, fresh, o);
  e.hp -= Math.max(1, Math.round(mult * sp.mult * 3));
  return true;
}
// Up to `n` paces along (dx, dz), stopping short of anyone or anything in
// the way; where you'd end up (or null).
function along(game, p, dx, dz, n, over = false) {
  let x = p.x;
  let z = p.z;
  let y = p.y;
  let land = null;
  for (let i = 0; i < n; i++) {
    const ny = game.world.stepTarget(x, y, z, x + dx, z + dz, false);
    if (ny < 0 || game.world.isWaterAt(x + dx, ny, z + dz)) break;
    x += dx;
    z += dz;
    y = ny;
    if (!game.occupiedBySolid(x, y, z, p)) land = { x, y, z, n: i + 1 };
    else if (!over) break;
  }
  return land;
}
function go(game, p, land, dur, ease = 'out') {
  if (!land) return;
  p.startMove(land.x, land.y, land.z, dur);
  p.moveEase = ease;
  game.onPlayerStep?.(land.x, land.y, land.z, false);
}

// What each one does.
const shapesOf = (k, c, o = {}) => specialShapes(k, o.x ?? c.x0, o.z ?? c.z0, c.ang, o.at ?? null, o.land ?? null);
const MOVES = {
  // A step in and the shoulder: two paces back, reeling.
  shove(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, shapesOf('shove', c))) if (blow(game, p, e, sp, c.fresh, 1, { knock: 2, stun: 0.9, word: 'reeling' })) out.push(e);
    return out;
  },
  // Behind them, and the blade in.
  shadow(game, p, sp, c) {
    let t = c.target;
    if (!t || Math.hypot(t.x - p.x, t.z - p.z) > 3.6) {
      // (No one aimed at: the nearest in front of you, three paces off at
      // most, a little either side of the way you're facing.)
      const near = struck(game, p, [{ t: 'cone', x: p.x, z: p.z, ang: c.ang, r: 3.3, half: 0.5, r0: 0, w: 1 }]);
      t = near.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] || null;
    }
    if (!t) {
      go(game, p, along(game, p, c.dx, c.dz, 2), 0.1, 'lin');
      return [];
    }
    const [hx, hz] = heading(t.x - p.x, t.z - p.z);
    const spots = [[t.x + hx, t.z + hz], [t.x + hz, t.z - hx], [t.x - hz, t.z + hx]];
    for (const [x, z] of spots) {
      const y = game.world.findStandY ? game.world.findStandY(x, z, p.y) : p.y;
      if (y < 0 || Math.abs(y - p.y) > 1 || game.occupiedBySolid(x, y, z, p) || game.world.isWaterAt(x, y, z)) continue;
      p.teleport(x, y, z);
      game.onPlayerStep?.(x, y, z, false);
      break;
    }
    p.face(t.x, t.z);
    return blow(game, p, t, sp, c.fresh, 1, { crit: true, word: 'from the shadows!' }) ? [t] : [];
  },
  // Two paces in a flash, through the line.
  lunge(game, p, sp, c) {
    const foes = struck(game, p, shapesOf('lunge', c));
    go(game, p, along(game, p, c.dx, c.dz, 2), 0.09, 'lin');
    const out = [];
    for (const e of foes) if (blow(game, p, e, sp, c.fresh, 1, { knock: 1 })) out.push(e);
    return out;
  },
  // Three cuts, one after the other, across the front of you (where you
  // are when each falls).
  flurry(game, p, sp, c) {
    const out = [];
    const cut = (i) => {
      for (const e of struck(game, p, shapesOf('flurry', c, { x: p.x, z: p.z }))) {
        if (blow(game, p, e, sp, c.fresh, 1, { quiet: i > 0 }) && !out.includes(e)) out.push(e);
      }
      strikeAnim(p, styleOf(p), i === 1);
      game.audio?.play('swing', p);
    };
    cut(0);
    later(p, 0.13, () => cut(1));
    later(p, 0.26, () => cut(2));
    return out;
  },
  // Round at ankle height: off their feet.
  sweep(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, shapesOf('sweep', c))) if (blow(game, p, e, sp, c.fresh, 1, { stun: 1.3, word: 'knocked down' })) out.push(e);
    return out;
  },
  // Three paces of spear, and back they go.
  skewer(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, shapesOf('skewer', c))) if (blow(game, p, e, sp, c.fresh, 1, { knock: 1 })) out.push(e);
    return out;
  },
  // Out on its line; the first it takes (the nearest along it), dragged in.
  haul(game, p, sp, c) {
    const ux = Math.cos(c.ang);
    const uz = Math.sin(c.ang);
    const t = struck(game, p, shapesOf('haul', c)).sort((a, b) => ((a.x - p.x) * ux + (a.z - p.z) * uz) - ((b.x - p.x) * ux + (b.z - p.z) * uz))[0] || null;
    if (!t) return [];
    c.took = { x: t.x, z: t.z };
    if (!blow(game, p, t, sp, c.fresh, 1, { stun: 0.6 })) return [];
    if (!t.dead && !t.foot && !(t.isBoss || t.S?.boss) && !t.moving) {
      // (Drawn in square by square toward you, the nearest of the eight
      // ways from them to you.)
      const [bx, bz] = heading(p.x - t.x, p.z - t.z);
      const d = Math.max(Math.abs(t.x - p.x), Math.abs(t.z - p.z));
      let land = null;
      let x = t.x;
      let z = t.z;
      let y = t.y;
      for (let i = 1; i < d; i++) {
        const ny = game.world.stepTarget(x, y, z, x + bx, z + bz, false);
        if (ny < 0 || game.occupiedBySolid(x + bx, ny, z + bz, t) || (x + bx === p.x && z + bz === p.z)) break;
        x += bx;
        z += bz;
        y = ny;
        land = { x, y, z };
      }
      if (land) t.startMove(land.x, land.y, land.z, 0.1 * d);
    }
    return [t];
  },
  // On the crown of the head: stunned.
  crack(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, shapesOf('crack', c))) if (blow(game, p, e, sp, c.fresh, 1, { stun: 1.8, word: 'stunned!' })) out.push(e);
    return out;
  },
  // Round and round: through their guard, and back they go.
  whirl(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, shapesOf('whirl', c))) if (blow(game, p, e, sp, c.fresh, 1, { knock: 1, pierce: 0.5 })) out.push(e);
    return out;
  },
  // Over and round their shields, two paces deep.
  reap(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, shapesOf('reap', c))) if (blow(game, p, e, sp, c.fresh, 1, { pierce: 0.8, stun: 0.5 })) out.push(e);
    return out;
  },
  // A great half-circle at full reach: back they all go.
  hew(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, shapesOf('hew', c))) if (blow(game, p, e, sp, c.fresh, 1, { knock: 2 })) out.push(e);
    return out;
  },
  // A leap, and the blade down where you land.
  cleave(game, p, sp, c) {
    const land = along(game, p, c.dx, c.dz, 2, true);
    const out = [];
    const fall = () => {
      // (Landed short of it, or not at all: the blow falls round where you
      // came down.)
      const shapes = shapesOf('cleave', c, { land: { x: p.x, z: p.z } });
      for (const e of struck(game, p, shapes)) if (blow(game, p, e, sp, c.fresh, shapesOn(shapes, e), { knock: 1 }) && !out.includes(e)) out.push(e);
      game.shake = Math.min(1.5, (game.shake || 0) + 0.5);
      game.hitStop = Math.max(game.hitStop || 0, 0.08);
      game.renderer?.emit?.(p.x + Math.cos(c.ang), p.y, p.z + Math.sin(c.ang), { n: 14, color: ['#a89878', '#8a7a5a', '#c8b898'], up: 14, speed: 50, life: 0.6, oy: 6, shape: 'puff' });
    };
    if (land) {
      go(game, p, land, 0.26, 'lin');
      p.leap = { t: 0, dur: 0.26 };
      later(p, 0.24, fall);
    } else fall();
    return out;
  },
  // The ground split before you: all thrown down within two paces.
  quake(game, p, sp, c) {
    const shapes = shapesOf('quake', c);
    const out = [];
    const cx = c.x0 + Math.cos(c.ang) * 1.2;
    const cz = c.z0 + Math.sin(c.ang) * 1.2;
    for (const e of struck(game, p, shapes)) {
      const w = shapesOn(shapes, e);
      if (blow(game, p, e, sp, c.fresh, w, { stun: w >= 1 ? 1.4 : 0.8, knock: 1, from: { x: Math.round(cx), z: Math.round(cz) }, word: w >= 1 ? 'thrown down!' : null })) out.push(e);
    }
    game.shake = Math.min(1.6, (game.shake || 0) + 0.7);
    game.hitStop = Math.max(game.hitStop || 0, 0.1);
    game.renderer?.emit?.(cx, p.y, cz, { n: 20, color: ['#86643c', '#523620', '#c4a070'], up: 40, speed: 70, life: 0.9, gravity: 140, oy: 2 });
    return out;
  },
};

// Something of a special's a moment after (a flurry's next cut, the
// cleave as you land): kept on you (not over the wire).
function later(p, t, fn) {
  (p._spq ||= []).push({ t, fn });
}

// Each frame: what's to come of a special, and a leap's arc.
export function specialTick(game, p, dt) {
  if (p.leap) {
    p.leap.t += dt;
    const k = Math.min(1, p.leap.t / p.leap.dur);
    p.hop = Math.round(Math.sin(k * Math.PI) * 12);
    if (k >= 1) {
      p.leap = null;
      p.hop = 0;
    }
  }
  const q = p._spq;
  if (!q || !q.length) return;
  for (let i = q.length - 1; i >= 0; i--) {
    q[i].t -= dt;
    if (q[i].t > 0) continue;
    const it = q.splice(i, 1)[0];
    if (!p.dead) it.fn();
  }
}

// In words, for what's in hand: "Hold: Whirlwind (5 stamina)".
export function specialLine(key) {
  const k = specialOf(key);
  if (!k) return null;
  const sp = SPECIALS[k];
  return `Hold: ${sp.name} (${sp.cost} stamina): ${sp.about}.`;
}

// The cost against the plain blow's: 'less', 'more' or 'the same'.
export function costWord(k, plain) {
  const c = SPECIALS[k].cost;
  return c < plain ? 'less' : c > plain ? 'more' : 'the same';
}
