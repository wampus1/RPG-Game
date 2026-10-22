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

const add = (out, x, z, w = 1, tag) => {
  if (!out.some((t) => t.x === x && t.z === z)) out.push(tag ? { x, z, w, tag } : { x, z, w });
};

// The ground a special covers, from (x, z) facing (dx, dz) (one of the
// eight ways); `at`: whoever it's aimed at, for those that go to someone
// (a step behind them, a harpoon's line). Each tile `w`: how hard there
// (a hammer's shock weaker at the edge); `tag` 'go': where you'll be.
export function specialTiles(k, x, z, dx, dz, at = null) {
  const out = [];
  const [px, pz] = [-dz, dx];
  const line = (n, w = 1) => {
    for (let i = 1; i <= n; i++) add(out, x + dx * i, z + dz * i, w);
  };
  const ring = () => {
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) if (ox || oz) add(out, x + ox, z + oz);
  };
  switch (k) {
    case 'shove': case 'crack':
      add(out, x + dx, z + dz);
      break;
    case 'shadow': {
      if (at) {
        const [hx, hz] = heading(at.x - x, at.z - z);
        add(out, at.x, at.z);
        add(out, at.x + hx, at.z + hz, 0, 'go');
      } else line(2, 0);
      break;
    }
    case 'lunge': line(3); add(out, x + dx * 2, z + dz * 2, 1, 'go'); break;
    case 'skewer': line(3); break;
    case 'haul': line(4); break;
    case 'flurry':
      for (const s of [0, 1, -1]) add(out, x + dx + px * s, z + dz + pz * s);
      break;
    case 'sweep': case 'whirl': ring(); break;
    case 'reap':
      for (const d of [1, 2]) for (const s of [-1, 0, 1]) add(out, x + dx * d + px * s, z + dz * d + pz * s);
      break;
    case 'hew':
      for (const s of [-2, -1, 0, 1, 2]) add(out, x + dx + px * s, z + dz + pz * s);
      for (const s of [-1, 0, 1]) add(out, x + dx * 2 + px * s, z + dz * 2 + pz * s);
      break;
    case 'cleave': {
      const lx = x + dx * 2;
      const lz = z + dz * 2;
      add(out, x + dx, z + dz, 0.6);
      for (const s of [-1, 1]) add(out, lx + px * s, lz + pz * s);
      for (const s of [-1, 0, 1]) add(out, lx + dx + px * s, lz + dz + pz * s);
      add(out, lx, lz, 0, 'go');
      break;
    }
    case 'quake': {
      const cx = x + dx;
      const cz = z + dz;
      for (let ox = -2; ox <= 2; ox++) {
        for (let oz = -2; oz <= 2; oz++) {
          if (cx + ox === x && cz + oz === z) continue;
          const r = Math.max(Math.abs(ox), Math.abs(oz));
          if (r === 2 && Math.abs(ox) === 2 && Math.abs(oz) === 2) continue;
          add(out, cx + ox, cz + oz, r <= 1 ? 1 : 0.55);
        }
      }
      break;
    }
    default: line(1);
  }
  return out;
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
  const spec = { k: ch.k, a: Math.round(a * 10) / 10, dx: ch.dx, dz: ch.dz, y: p.y };
  if (at && (ch.k === 'shadow' || ch.k === 'haul')) {
    spec.tx = at.x;
    spec.tz = at.z;
  }
  const s0 = p.spec;
  if (!s0 || s0.k !== spec.k || s0.a !== spec.a || s0.dx !== spec.dx || s0.dz !== spec.dz || s0.tx !== spec.tx || s0.tz !== spec.tz) p.spec = spec;
  if (a >= 1 && !ch.ready) {
    ch.ready = true;
    game.audio?.play('sp_ready', p);
    game.renderer?.effect?.({ type: 'sp_ready', wx: p.x, wy: p.y, wz: p.z, oy: -14, pal: sp.pal, life: 0.35 });
  }
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
  const [dx, dz] = ch.target && !ch.target.dead ? heading(ch.target.x - p.x, ch.target.z - p.z) : [ch.dx, ch.dz];
  p.face(p.x + dx, p.z + dz);
  p.blocking = false;
  p.sitting = null;
  const x0 = p.x;
  const z0 = p.z;
  const target = ch.target && !ch.target.dead ? ch.target : null;
  const c = { dx, dz, x0, z0, target, fresh };
  const hits = (MOVES[ch.k] || MOVES.shove)(game, p, sp, c);
  // (Nobody there but a straw man in the practice yard: it takes it, and
  // counts as the held strike a lesson asks for.)
  if (!hits.length && game.dummyOn && game.hitDummy) {
    const dm = game.dummyOn(specialTiles(ch.k, x0, z0, dx, dz, target).filter((t) => t.w > 0), p);
    if (dm) {
      const { dmg, crit } = game.blowDamage(false, fresh, styleOf(p));
      game.hitDummy(dm, Math.max(1, Math.round(dmg * sp.mult)), crit, { heavy: true });
    }
  }
  const fx = { type: `sp_${ch.k}`, wx: x0, wy: p.y, wz: z0, dx, dz, pal: sp.pal, life: FX_LIFE[ch.k] || 0.5 };
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

// Foes on these tiles (else anyone at all there: a special swung at a
// passer-by is an assault, as any blow).
function struck(game, p, tiles) {
  const t = tiles.filter((q) => q.w > 0);
  return game.struckOn ? game.struckOn(t, p) : [];
}
const weightAt = (tiles, e) => {
  let w = 0;
  for (const t of tiles) if (t.x === Math.round(e.x) && t.z === Math.round(e.z)) w = Math.max(w, t.w);
  return w || 1;
};
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
const MOVES = {
  // A step in and the shoulder: two paces back, reeling.
  shove(game, p, sp, c) {
    const tiles = specialTiles('shove', c.x0, c.z0, c.dx, c.dz);
    const out = [];
    for (const e of struck(game, p, tiles)) if (blow(game, p, e, sp, c.fresh, 1, { knock: 2, stun: 0.9, word: 'reeling' })) out.push(e);
    return out;
  },
  // Behind them, and the blade in.
  shadow(game, p, sp, c) {
    let t = c.target;
    if (!t || Math.max(Math.abs(t.x - p.x), Math.abs(t.z - p.z)) > 3) {
      t = null;
      for (let i = 1; i <= 3 && !t; i++) t = struck(game, p, [{ x: p.x + c.dx * i, z: p.z + c.dz * i, w: 1 }])[0] || null;
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
    const tiles = specialTiles('lunge', c.x0, c.z0, c.dx, c.dz);
    const foes = struck(game, p, tiles);
    go(game, p, along(game, p, c.dx, c.dz, 2), 0.09, 'lin');
    const out = [];
    for (const e of foes) if (blow(game, p, e, sp, c.fresh, 1, { knock: 1 })) out.push(e);
    return out;
  },
  // Three cuts, one after the other.
  flurry(game, p, sp, c) {
    const tiles = specialTiles('flurry', c.x0, c.z0, c.dx, c.dz);
    const out = [];
    const cut = (i) => {
      for (const e of struck(game, p, tiles)) {
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
    for (const e of struck(game, p, specialTiles('sweep', c.x0, c.z0, c.dx, c.dz))) if (blow(game, p, e, sp, c.fresh, 1, { stun: 1.3, word: 'knocked down' })) out.push(e);
    return out;
  },
  // Three paces of spear, and back they go.
  skewer(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, specialTiles('skewer', c.x0, c.z0, c.dx, c.dz))) if (blow(game, p, e, sp, c.fresh, 1, { knock: 1 })) out.push(e);
    return out;
  },
  // Out on its line; the first it takes, dragged in.
  haul(game, p, sp, c) {
    let t = null;
    for (let i = 1; i <= 4 && !t; i++) t = struck(game, p, [{ x: p.x + c.dx * i, z: p.z + c.dz * i, w: 1 }])[0] || null;
    if (!t) return [];
    c.took = { x: t.x, z: t.z };
    if (!blow(game, p, t, sp, c.fresh, 1, { stun: 0.6 })) return [];
    if (!t.dead && !t.foot && !(t.isBoss || t.S?.boss) && !t.moving) {
      const d = Math.max(Math.abs(t.x - p.x), Math.abs(t.z - p.z));
      let land = null;
      let x = t.x;
      let z = t.z;
      let y = t.y;
      for (let i = 1; i < d; i++) {
        const ny = game.world.stepTarget(x, y, z, x - c.dx, z - c.dz, false);
        if (ny < 0 || game.occupiedBySolid(x - c.dx, ny, z - c.dz, t)) break;
        x -= c.dx;
        z -= c.dz;
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
    for (const e of struck(game, p, specialTiles('crack', c.x0, c.z0, c.dx, c.dz))) if (blow(game, p, e, sp, c.fresh, 1, { stun: 1.8, word: 'stunned!' })) out.push(e);
    return out;
  },
  // Round and round: through their guard, and back they go.
  whirl(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, specialTiles('whirl', c.x0, c.z0, c.dx, c.dz))) if (blow(game, p, e, sp, c.fresh, 1, { knock: 1, pierce: 0.5 })) out.push(e);
    return out;
  },
  // Over and round their shields, two paces deep.
  reap(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, specialTiles('reap', c.x0, c.z0, c.dx, c.dz))) if (blow(game, p, e, sp, c.fresh, 1, { pierce: 0.8, stun: 0.5 })) out.push(e);
    return out;
  },
  // Five paces wide at full reach: back they all go.
  hew(game, p, sp, c) {
    const out = [];
    for (const e of struck(game, p, specialTiles('hew', c.x0, c.z0, c.dx, c.dz))) if (blow(game, p, e, sp, c.fresh, 1, { knock: 2 })) out.push(e);
    return out;
  },
  // A leap, and the blade down where you land.
  cleave(game, p, sp, c) {
    const land = along(game, p, c.dx, c.dz, 2, true);
    const out = [];
    const fall = () => {
      const tiles = specialTiles('cleave', c.x0, c.z0, c.dx, c.dz);
      // (Landed short of it: the blow falls round where you came down.)
      const shift = land ? 2 - land.n : 2;
      const at = shift ? tiles.map((t) => ({ ...t, x: t.x - c.dx * shift, z: t.z - c.dz * shift })) : tiles;
      for (const e of struck(game, p, at)) if (blow(game, p, e, sp, c.fresh, weightAt(at, e), { knock: 1 }) && !out.includes(e)) out.push(e);
      game.shake = Math.min(1.5, (game.shake || 0) + 0.5);
      game.hitStop = Math.max(game.hitStop || 0, 0.08);
      game.renderer?.emit?.(p.x + c.dx, p.y, p.z + c.dz, { n: 14, color: ['#a89878', '#8a7a5a', '#c8b898'], up: 14, speed: 50, life: 0.6, oy: 6, shape: 'puff' });
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
    const tiles = specialTiles('quake', c.x0, c.z0, c.dx, c.dz);
    const out = [];
    const cx = c.x0 + c.dx;
    const cz = c.z0 + c.dz;
    for (const e of struck(game, p, tiles)) {
      const w = weightAt(tiles, e);
      if (blow(game, p, e, sp, c.fresh, w, { stun: w >= 1 ? 1.4 : 0.8, knock: 1, from: { x: cx, z: cz }, word: w >= 1 ? 'thrown down!' : null })) out.push(e);
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
