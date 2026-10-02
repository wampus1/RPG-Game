// What a set stone does depends on what it's set in: a blade, a bow or a
// piece of armour. The same effects work for anyone who carries them (you,
// or a guard who bought a jewelled sword).
import { ITEMS, GEMS } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';

export const GEM_EFFECTS = {
  ruby: {
    blade: 'each swing throws a lick of flame a few paces ahead',
    bow: 'arrows burst into flame where they land, scorching all around',
    armor: 'whoever strikes you catches fire',
  },
  sapphire: {
    blade: 'swings faster, and chills what it cuts (slowing it)',
    bow: 'arrows fly faster and frost what they hit',
    armor: 'whoever strikes you is chilled and slowed',
  },
  emerald: {
    blade: 'each hit mends you a little',
    bow: 'each arrow that strikes mends you a little',
    armor: 'your wounds slowly close on their own',
  },
  topaz: {
    blade: 'hits sometimes leap as lightning to another foe nearby',
    bow: 'arrows call down a flash of lightning that dazzles',
    armor: 'whoever strikes you may be dazzled by the glare',
  },
  amethyst: {
    blade: 'blows stagger and throw foes back',
    bow: 'arrows knock their target back and stagger it',
    armor: 'part of every blow is turned back on the one who struck',
  },
  onyx: {
    blade: 'your shade echoes every blow that lands, striking again a moment later',
    bow: 'each arrow splits in three as it leaves the string',
    armor: 'now and then a blow in close passes through you as if you were smoke',
  },
  moonstone: {
    blade: 'every third blow (and every heavy or telling one) throws a crescent of moonlight that cuts through all in its path',
    bow: 'arrows mark what they strike with moonlight: marked, it takes a third more from every blow',
    armor: 'you shed a soft moonlight, and once a day a ward of light catches the blows that would have felled you',
  },
  bloodstone: {
    blade: 'cuts bleed (up to three wounds at once), and felling a bleeding foe mends you',
    bow: 'arrows open two wounds that bleed',
    armor: 'the closer you are to death, the harder you hit (up to half again)',
  },
};

// In a shield, each stone works its own way when the shield turns a blow
// (and most of all when it parries one): nothing like it does in a blade
// or in armour.
export const SHIELD_EFFECTS = {
  ruby: 'Ember wall: a parry looses a wall of flame across the ground in front of you, burning all it catches',
  sapphire: 'Frost shell: each blow it turns ices it over; the third (or a parry) bursts and freezes the attacker solid',
  emerald: 'Living ward: what it turns is gathered as light in the shield; lower your guard and half of it mends you',
  topaz: 'Thunder guard: a parry (or every fourth blow turned) arcs lightning to up to three foes around you',
  amethyst: 'Bulwark: a parry throws every foe within two paces back two more, staggered',
  onyx: 'Void ward: a parry opens a void at the attacker\'s feet that drags everyone near into it and holds them',
  moonstone: 'Mirror: arrows, bolts and stones taken on it fly straight back at whoever loosed them (twice as hard off a parry)',
  bloodstone: 'Blood price: out of breath, it takes the cost in blood instead and never breaks; a parry opens three wounds on the attacker',
};
export const ROLL_EFFECTS = {
  ruby: 'a roll leaves a burst of flame where you were',
  sapphire: 'rolling takes less breath',
  emerald: 'your breath comes back quicker',
  topaz: 'a blow struck straight out of a roll lands hard and true',
  amethyst: 'rolling past someone knocks them aside',
  onyx: 'a roll wraps you in shadow: foes lose you a moment, and strike at the shade you leave behind',
  moonstone: 'rolling clear of a blow gives you breath back',
  bloodstone: 'rolling past someone opens a wound on them',
};

// Which way a set piece of gear works.
export function gearKind(key) {
  const it = ITEMS[key];
  if (!it) return null;
  if (it.block) return 'shield';
  if (it.kind === 'armor') return 'armor';
  if (it.ranged) return 'bow';
  return 'blade';
}

export function gemText(key) {
  const it = ITEMS[key];
  if (!it || !it.socket) return null;
  const k = gearKind(key);
  if (k === 'shield') return `Set with a ${GEMS[it.socket].name}: ${SHIELD_EFFECTS[it.socket]}`;
  return `Set with a ${GEMS[it.socket].name}: ${GEM_EFFECTS[it.socket][k]}${k === 'armor' ? `; ${ROLL_EFFECTS[it.socket]}` : ''}`;
}

// The stone in someone's shield, if it's a shield they carry.
export function shieldGem(e) {
  const k = e && (e.kind === 'player' ? e.equip && e.equip.shield : e.rec && e.rec.equipment && e.rec.equipment.shield);
  const it = k && ITEMS[k];
  return it && it.block && it.kind === 'armor' ? it.socket || null : null;
}

// The stones someone carries into a fight: in the blade they swing, the
// bow they shoot, and the armour they wear.
export function gemsOf(e) {
  if (!e) return { blade: null, bow: null, armor: [] };
  if (e.kind === 'player') {
    const held = e.heldDef ? e.heldDef() : null;
    // (A shield's stone works its own way: see onBlock.)
    const armor = Object.entries(e.equip || {}).filter(([slot]) => slot !== 'shield').map(([, k]) => k && ITEMS[k] && ITEMS[k].socket).filter(Boolean);
    return { blade: held && !held.ranged ? held.socket || null : null, bow: held && held.ranged ? held.socket || null : null, armor };
  }
  if (e.kind === 'npc') {
    const mw = e.meleeWeapon ? e.meleeWeapon() : null;
    const w = e.weapon ? e.weapon() : null;
    const armor = Object.values(e.rec.wear || {}).map((k) => ITEMS[k] && ITEMS[k].socket).filter(Boolean);
    return { blade: mw ? ITEMS[mw].socket || null : null, bow: w && ITEMS[w].ranged ? ITEMS[w].socket || null : null, armor };
  }
  return { blade: null, bow: null, armor: [] };
}

// Is this someone the attacker's stones may hurt (the thing they're
// fighting, or any beast; never a bystander)?
function foeOf(game, attacker, e, main) {
  if (!e || e.dead || e === attacker) return false;
  if (e === main) return true;
  if (e.kind === 'creature') return true;
  if (attacker.kind === 'player') return e.kind === 'npc' && e.state === 'fight' && e.threat === attacker;
  if (attacker.kind === 'npc') return e === attacker.threat || e === attacker.prey;
  return false;
}

function around(game, x, z, r) {
  const out = [];
  for (const n of game.npcs) if (!n.dead && Math.max(Math.abs(n.x - x), Math.abs(n.z - z)) <= r) out.push(n);
  for (const c of game.creatures || []) if (!c.dead && Math.max(Math.abs(c.x - x), Math.abs(c.z - z)) <= r) out.push(c);
  const p = game.player;
  if (p && !p.dead && Math.max(Math.abs(p.x - x), Math.abs(p.z - z)) <= r) out.push(p);
  return out;
}

const FIRE = ['#ff6030', '#ffb040', '#fff0a0'];
const FROST = ['#a0d8ff', '#e0f4ff', '#60a0ff'];
const BOLT = ['#fff8a0', '#ffe040', '#ffffff'];
const LIFE = ['#60e080', '#c0ffc0'];
const FORCE = ['#c080ff', '#e0c0ff'];
const SHADOW = ['#9a6ad8', '#5a3a88', '#d8c0ff', '#2a1e3a'];
const MOON = ['#e8f0ff', '#bcd8ff', '#ffffff'];
const BLOOD = ['#e83848', '#a01828', '#ff8090'];

// Is this someone the gear's bearer is fighting (for stones that reach out
// on their own: a void, a nova)? For you: beasts, and whoever's fighting you.
function hostileTo(bearer, e, main = null) {
  if (!e || e.dead || e === bearer || e.down) return false;
  if (e === main) return true;
  if (bearer.kind === 'player') return (e.kind === 'creature' && (e.hostileNow || e.target === bearer)) || e.kind === 'monster' || (e.kind === 'npc' && ((e.state === 'fight' && e.threat === bearer) || (e.warband && e.warband.foe && e.hostileNow)));
  if (bearer.kind === 'npc') return e === bearer.threat || e === bearer.prey || (e.kind === 'creature' && e.hostileNow);
  return e.kind === 'player';
}

// Bleeding: up to three open wounds, a point of blood each a second for
// four seconds (fresh cuts start the clock again).
export function bleed(game, e, src, n = 1) {
  if (!e || e.dead || (e.S && e.S.bloodless)) return;
  e.bleedN = Math.min(3, (e.bleedN || 0) + n);
  e.bleedT = 4;
  e.bleedSrc = src;
  game.renderer.emit(e.x, e.y + 1, e.z, { n: 4 + n * 2, color: BLOOD, up: 14, speed: 30, gravity: 160, life: 0.5, oy: -6 });
  game.audio?.play('bleed', e);
}

// Frozen solid: no moving, no striking, ice all over them.
export function freeze(game, e, secs = 2) {
  if (!e || e.dead) return;
  e.frozenT = Math.max(e.frozenT || 0, secs);
  e.stunT = Math.max(e.stunT || 0, secs);
  e.slowT = Math.max(e.slowT || 0, secs + 1.5);
  if (e.windup) e.windup = null;
  if (e.swing) e.swing = null;
  frostBurst(game, e);
  game.renderer.floatText(e.x, e.y + 2.4, e.z, 'frozen!', '#c8ecff');
  game.audio?.play('freeze', e);
}

// Marked with moonlight: every blow on them lands a third harder.
export function markMoon(game, e, secs = 6) {
  if (!e || e.dead) return;
  e.markT = Math.max(e.markT || 0, secs);
  moonBurst(game, e, 10);
}

function moonBurst(game, t, r1 = 14) {
  game.renderer.effect?.({ type: 'ring', wx: t.x, wy: t.y, wz: t.z, r0: 2, r1, color: MOON, life: 0.55, oy: -6, flat: 0.55 });
  game.renderer.emit(t.x, t.y + 1.2, t.z, { n: 8, color: MOON, up: 20, speed: 24, life: 0.8, gravity: -12, shape: 'star', glow: true, oy: -8 });
}

function shadowPuff(game, t) {
  game.renderer.emit(t.x, t.y + 1, t.z, { n: 10, color: SHADOW, up: 16, speed: 26, life: 0.7, gravity: -18, shape: 'puff', grow: 2, oy: -4 });
}

export function burn(game, e, src, secs = 3) {
  if (!e || e.dead) return;
  e.burnT = Math.max(e.burnT || 0, secs);
  e.burnSrc = src;
}

export function chill(e, secs = 2) {
  if (!e || e.dead) return;
  e.slowT = Math.max(e.slowT || 0, secs);
}

export function stun(e, secs = 1) {
  if (!e || e.dead) return;
  e.stunT = Math.max(e.stunT || 0, secs);
}

export function mend(game, e, n = 1) {
  if (!e || e.dead || e.hp >= e.maxHp) return;
  e.hp = Math.min(e.maxHp, e.hp + n);
  if (e.rec) e.rec.hp = e.hp;
  // Little green crosses rising, and a glow at their feet.
  game.renderer.emit(e.x, e.y + 1, e.z, { n: 4, color: LIFE, up: 16, speed: 14, life: 0.8, gravity: -14, shape: 'plus', oy: -4 });
  game.renderer.effect?.({ type: 'ring', wx: e.x, wy: e.y, wz: e.z, r0: 2, r1: 9, color: LIFE, life: 0.6, oy: 4, flat: 0.45 });
}

// Frost: a ring of rime spreading out, and glinting ice.
function frostBurst(game, t) {
  game.renderer.effect?.({ type: 'ring', wx: t.x, wy: t.y, wz: t.z, r0: 3, r1: 13, color: FROST, life: 0.5, oy: 3, flat: 0.5 });
  game.renderer.emit(t.x, t.y + 1, t.z, { n: 7, color: FROST, up: 18, speed: 36, life: 0.55, oy: -6, shape: 'star', gravity: 20 });
}

// Force: a violet shock ring and dust thrown up.
function forceBurst(game, t) {
  game.renderer.effect?.({ type: 'ring', wx: t.x, wy: t.y, wz: t.z, r0: 2, r1: 16, color: FORCE, life: 0.4, oy: -6, flat: 0.8, thick: 2 });
  game.renderer.emit(t.x, t.y, t.z, { n: 6, color: ['#a89880', '#c8b8a0'], up: 10, speed: 40, life: 0.4, oy: 2 });
}

export function knockBack(game, attacker, t, tiles = 1) {
  const kx = Math.sign(t.x - attacker.x);
  const kz = Math.sign(t.z - attacker.z);
  if (t.moving || t.dead || t.sleeping || (!kx && !kz)) return;
  let x = t.x;
  let z = t.z;
  let y = t.y;
  for (let i = 0; i < tiles; i++) {
    const nx = x + (Math.abs(kx) >= Math.abs(kz) ? kx : 0);
    const nz = z + (Math.abs(kx) >= Math.abs(kz) ? 0 : kz);
    const ny = game.world.stepTarget(x, y, z, nx, nz, false);
    if (ny < 0 || game.occupiedBySolid(nx, ny, nz, t)) break;
    x = nx;
    z = nz;
    y = ny;
  }
  if (x !== t.x || z !== t.z) t.startMove(x, y, z, 0.14);
}

// How much quicker a sapphire blade swings.
export function swingMult(e) {
  return gemsOf(e).blade === 'sapphire' ? 0.8 : 1;
}

// A swing, whether or not it lands: a ruby blade throws an arc of flame
// the way it's swung (toward the mouse, for you; at their foe, for anyone
// else). It sweeps out a few paces, and whoever it catches is set alight.
export function onSwing(game, attacker, main = null) {
  const g = gemsOf(attacker);
  if (g.blade !== 'ruby') return;
  let ang = null;
  if (attacker.kind === 'player' && game.aimAngle) ang = game.aimAngle();
  if (ang === null && main && !main.dead) ang = Math.atan2(main.z - attacker.z, main.x - attacker.x);
  if (ang === null) {
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    ang = Math.atan2(DZ[attacker.dir] ?? 1, DX[attacker.dir] ?? 0);
  }
  const dx = Math.cos(ang);
  const dz = Math.sin(ang);
  // As far as it can go before a wall stops it.
  let range = 3.4;
  for (let d = 1; d <= 3; d++) {
    const x = Math.round(attacker.x + dx * d);
    const z = Math.round(attacker.z + dz * d);
    // (A step up it licks over; a wall stops it.)
    if (BLOCKS[game.world.getBlock(x, attacker.y, z)]?.solid && BLOCKS[game.world.getBlock(x, attacker.y + 1, z)]?.solid) {
      range = d - 0.3;
      break;
    }
  }
  (game.flames ||= []).push({ from: attacker, main, x: attacker.x, y: attacker.y, z: attacker.z, ang, r: 0.4, range, hit: new Set() });
  game.renderer.effect?.({ type: 'arc', wx: attacker.x, wy: attacker.y, wz: attacker.z, dx, dz, range, life: 0.5, oy: -8 });
  game.audio?.play('fire', attacker);
}

// Who a ruby's flame may catch: for you, anyone in its path (so mind where
// you swing it in town); for anyone else, only what they're fighting.
function flameCatches(game, attacker, e, main) {
  if (!e || e.dead || e === attacker || e.hired || e.kind === 'item') return false;
  if (attacker.kind === 'player') return e.kind === 'creature' || e.kind === 'monster' || e.kind === 'npc';
  return foeOf(game, attacker, e, main);
}

// The arc spreads out a pace at a time, catching whoever is in its sweep.
export function updateFlames(game, dt) {
  if (!game.flames || !game.flames.length) return;
  for (const f of game.flames) {
    f.r += dt * 9;
    const R = Math.min(f.r, f.range);
    for (const e of around(game, f.x, f.z, Math.ceil(R))) {
      if (f.hit.has(e) || !flameCatches(game, f.from, e, f.main)) continue;
      const d = Math.hypot(e.x - f.x, e.z - f.z);
      if (d > R || d < 0.5) continue;
      let da = Math.abs(Math.atan2(e.z - f.z, e.x - f.x) - f.ang);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da > (f.span || 1.0)) continue;
      f.hit.add(e);
      game.damage(e, 2, f.from);
      burn(game, e, f.from, 3);
      game.renderer.emit(e.x, e.y + 1, e.z, { n: 8, color: FIRE, up: 30, speed: 30, life: 0.45, oy: -6 });
    }
    if (f.r >= f.range) f.done = true;
  }
  game.flames = game.flames.filter((f) => !f.done);
}

// The other stones' work that plays out over a moment: shades echoing
// blows, crescents of moonlight flying, voids pulling.
export function updateGemFx(game, dt) {
  updateFlames(game, dt);
  const r = game.renderer;
  if (game.echoes && game.echoes.length) {
    for (const q of game.echoes) {
      q.at -= dt;
      if (q.at > 0) continue;
      q.done = true;
      const { a, t } = q;
      if (a.dead || t.dead || t.down || Math.max(Math.abs(t.x - a.x), Math.abs(t.z - a.z)) > 2) continue;
      // The shade, lunging in beside you.
      const mx = a.x + (t.x - a.x) * 0.45;
      const mz = a.z + (t.z - a.z) * 0.45;
      if (a.look) r.effect?.({ type: 'ghost', wx: mx, wy: a.y, wz: mz, look: a.look, dir: a.dir, life: 0.45, oy: 0, strike: true });
      r.effect?.({ type: 'siphon', wx: a.x, wy: a.y + 1, wz: a.z, tx: t.x, ty: t.y + 1, tz: t.z, life: 0.3, oy: -6, n: 10, amp: 2, color: SHADOW });
      game.damage(t, q.dmg, a);
      shadowPuff(game, t);
      game.audio?.play('void', t);
    }
    game.echoes = game.echoes.filter((q) => !q.done);
  }
  if (game.crescents && game.crescents.length) {
    for (const c of game.crescents) {
      c.d += dt * 12;
      const d = Math.min(c.d, c.range);
      for (const e of around(game, Math.round(c.x + Math.cos(c.ang) * d), Math.round(c.z + Math.sin(c.ang) * d), 1)) {
        if (c.hit.has(e) || !hostileTo(c.from, e, c.main)) continue;
        // (Only what's really in its path: within a pace of its line.)
        const ex = e.x - c.x;
        const ez = e.z - c.z;
        const along = ex * Math.cos(c.ang) + ez * Math.sin(c.ang);
        const off = Math.abs(-ex * Math.sin(c.ang) + ez * Math.cos(c.ang));
        if (along < 0.5 || along > d + 0.6 || off > 0.9) continue;
        c.hit.add(e);
        game.damage(e, 3, c.from);
        moonBurst(game, e, 8);
      }
      if (c.d >= c.range) c.done = true;
    }
    game.crescents = game.crescents.filter((c) => !c.done);
  }
  if (game.voids && game.voids.length) {
    for (const v of game.voids) {
      v.t += dt;
      v.tick -= dt;
      if (Math.random() < dt * 20) r.emit(v.x + (Math.random() - 0.5) * 3, v.y + 0.3, v.z + (Math.random() - 0.5) * 3, { n: 1, color: SHADOW, up: 2, speed: 4, gravity: 0, life: 0.5, shape: 'puff', oy: 4 });
      if (v.tick <= 0) {
        v.tick = 0.3;
        for (const e of around(game, v.x, v.z, 3)) {
          if (!hostileTo(v.from, e, v.main)) continue;
          e.slowT = Math.max(e.slowT || 0, 0.8);
          if (e.windup) e.windup = null;
          if (e.moving || (e.x === v.x && e.z === v.z)) continue;
          // One pace toward the heart of it.
          const dx = Math.sign(v.x - e.x);
          const dz = Math.sign(v.z - e.z);
          const nx = e.x + (Math.abs(v.x - e.x) >= Math.abs(v.z - e.z) ? dx : 0);
          const nz = e.z + (Math.abs(v.x - e.x) >= Math.abs(v.z - e.z) ? 0 : dz);
          const ny = game.world.stepTarget(e.x, e.y, e.z, nx, nz, false);
          if (ny >= 0 && !game.occupiedBySolid(nx, ny, nz, e)) e.startMove(nx, ny, nz, 0.2);
        }
      }
      if (v.t >= v.dur) {
        v.done = true;
        // It closes with a snap: whoever's in the heart of it is hurt.
        for (const e of around(game, v.x, v.z, 1)) if (hostileTo(v.from, e, v.main)) game.damage(e, 3, v.from);
        r.effect?.({ type: 'ring', wx: v.x, wy: v.y, wz: v.z, r0: 18, r1: 2, color: SHADOW, life: 0.3, oy: 4, flat: 0.5, thick: 2 });
      }
    }
    game.voids = game.voids.filter((v) => !v.done);
  }
}

// A blade's blow has landed (`o`: { dmg, heavy, crit } when known).
export function onBladeHit(game, attacker, target, o = {}) {
  const g = gemsOf(attacker).blade;
  if (!g || target.dead) return;
  if (g === 'onyx') {
    // Your shade, a breath behind you, strikes the same blow again.
    (game.echoes ||= []).push({ a: attacker, t: target, at: 0.3, dmg: Math.max(1, Math.round((o.dmg || 3) * 0.5)) });
    return;
  }
  if (g === 'moonstone') {
    attacker.moonN = (attacker.moonN || 0) + 1;
    if (attacker.moonN >= 3 || o.heavy || o.crit) {
      attacker.moonN = 0;
      crescent(game, attacker, Math.atan2(target.z - attacker.z, target.x - attacker.x), target);
    }
    return;
  }
  if (g === 'bloodstone') {
    bleed(game, target, attacker, 1);
    return;
  }
  if (g === 'sapphire') {
    chill(target, 2);
    frostBurst(game, target);
  } else if (g === 'emerald') mend(game, attacker, 1);
  else if (g === 'topaz' && Math.random() < 0.35) {
    const next = around(game, target.x, target.z, 3).find((e) => e !== target && foeOf(game, attacker, e, null));
    if (next) {
      game.renderer.effect?.({ type: 'bolt', wx: target.x, wy: target.y, wz: target.z, tx: next.x, ty: next.y, tz: next.z, life: 0.35, oy: -10 });
      game.renderer.emit(next.x, next.y + 1, next.z, { n: 8, color: BOLT, up: 40, life: 0.3, oy: -10 });
      game.damage(next, 2, attacker);
      stun(next, 0.6);
    }
  } else if (g === 'amethyst') {
    stun(target, 1.2);
    knockBack(game, attacker, target, 2);
    forceBurst(game, target);
  }
}

// How fast an arrow flies (sapphire: quicker).
export function arrowSpeed(shooter) {
  return gemsOf(shooter).bow === 'sapphire' ? 0.6 : 1;
}

// An arrow has come down (on its target, if it hit).
export function onArrowLand(game, a, hit) {
  const g = a.gem;
  if (!g) return;
  const shooter = a.from;
  const t = a.target;
  if (g === 'ruby') {
    game.renderer.effect?.({ type: 'blast', wx: Math.round(a.tx), wy: a.ty, wz: Math.round(a.tz), r1: 18, life: 0.6, oy: 2 });
    game.renderer.emit(a.tx, a.ty, a.tz, { n: 14, color: FIRE, up: 40, speed: 50, life: 0.6, oy: -6 });
    for (const e of around(game, Math.round(a.tx), Math.round(a.tz), 1)) {
      if (!foeOf(game, shooter, e, t)) continue;
      if (e !== t || !hit) game.damage(e, 2, shooter);
      burn(game, e, shooter, 3);
    }
    game.audio?.play('fire', t);
  } else if (!hit || t.dead) return;
  else if (g === 'sapphire') {
    chill(t, 3);
    frostBurst(game, t);
  } else if (g === 'emerald') mend(game, shooter, 1);
  else if (g === 'topaz') {
    game.renderer.effect?.({ type: 'bolt', from: 'sky', wx: t.x, wy: t.y, wz: t.z, tx: t.x, ty: t.y, tz: t.z, life: 0.4, oy: -4 });
    game.renderer.emit(t.x, t.y + 2, t.z, { n: 10, color: BOLT, up: 50, life: 0.3, oy: -14 });
    game.damage(t, 2, shooter);
    stun(t, 1);
  } else if (g === 'amethyst') {
    knockBack(game, shooter, t, 2);
    stun(t, 0.6);
    forceBurst(game, t);
  } else if (g === 'moonstone') markMoon(game, t, 6);
  else if (g === 'bloodstone') bleed(game, t, shooter, 2);
}

// A crescent of moonlight thrown from someone along `ang`: it flies five
// paces (a wall stops it), cutting every foe it passes through.
export function crescent(game, from, ang, main = null) {
  const range = 5;
  let reach = range;
  for (let d = 1; d <= range; d++) {
    const x = Math.round(from.x + Math.cos(ang) * d);
    const z = Math.round(from.z + Math.sin(ang) * d);
    if (BLOCKS[game.world.getBlock(x, from.y, z)]?.solid && BLOCKS[game.world.getBlock(x, from.y + 1, z)]?.solid) {
      reach = d - 0.5;
      break;
    }
  }
  (game.crescents ||= []).push({ from, main, x: from.x, y: from.y, z: from.z, ang, d: 0, range: reach, hit: new Set() });
  game.renderer.effect?.({ type: 'wave', wx: from.x, wy: from.y, wz: from.z, dx: Math.cos(ang), dz: Math.sin(ang), range: reach * 16, life: Math.max(0.15, reach / 12), oy: -8, color: MOON });
  game.audio?.play('moon', from);
}

// An onyx bow: each arrow loosed splits in three (the other two a shade's,
// half as hard, fanned out either side).
export function splitShot(game, from, aim, o, shoot) {
  if (o.split || gemsOf(from).bow !== 'onyx') return;
  const ang = Math.atan2(aim.z - from.z, aim.x - from.x);
  const d = Math.max(3, Math.hypot(aim.x - from.x, aim.z - from.z));
  for (const s of [-0.24, 0.24]) {
    const a = shoot(game, from, { x: from.x + Math.cos(ang + s) * d, z: from.z + Math.sin(ang + s) * d }, { ...o, split: true, dmg: Math.max(1, Math.round(o.dmg * 0.5)) });
    if (a) a.shadow = true;
  }
  shadowPuff(game, from);
}

// A blow turned on a shield (`parry`: at the last instant; `turned`: how
// much of it the shield took): its stone at work.
export function onBlock(game, v, a, parry = false, turned = 1) {
  const g = shieldGem(v);
  if (!g || !a || a.dead) return;
  const r = game.renderer;
  if (g === 'ruby') {
    if (parry) emberWall(game, v, a);
    else r.emit(v.x, v.y + 1.1, v.z, { n: 4, color: FIRE, up: 16, speed: 20, life: 0.4, gravity: -20, oy: -6 });
  } else if (g === 'sapphire') {
    const now = game.sim ? game.sim.abs : 0;
    v.iceN = (now - (v.iceAt ?? -99) < 10 ? v.iceN || 0 : 0) + 1;
    v.iceAt = now;
    if (parry || v.iceN >= 3) {
      v.iceN = 0;
      freeze(game, a, parry ? 2.6 : 1.8);
    } else {
      chill(a, 1);
      r.emit(v.x, v.y + 1.1, v.z, { n: 5, color: FROST, up: 10, speed: 16, life: 0.6, shape: 'star', oy: -8 });
      r.floatText(v.x, v.y + 2.4, v.z, v.iceN === 2 ? 'ice ▪▪' : 'ice ▪', '#c8ecff');
    }
  } else if (g === 'emerald') {
    // Gathered as light in the shield (see tickGuard): half of it mends you
    // when the guard comes down.
    v.wardStore = Math.min(10, (v.wardStore || 0) + Math.max(1, turned) * (parry ? 1.5 : 1));
    r.effect?.({ type: 'siphon', wx: a.x, wy: a.y + 1, wz: a.z, tx: v.x, ty: v.y + 1, tz: v.z, life: 0.5, oy: -6, n: 10, amp: 3, color: LIFE });
    if (v.kind !== 'player') releaseWard(game, v);
  } else if (g === 'topaz') {
    v.thunderN = (v.thunderN || 0) + 1;
    if (parry || v.thunderN >= 4) {
      v.thunderN = 0;
      thunderNova(game, v, a);
    } else r.emit(v.x, v.y + 1.1, v.z, { n: 3, color: BOLT, up: 20, speed: 30, life: 0.25, glow: true, oy: -8 });
  } else if (g === 'amethyst') {
    if (parry) bulwark(game, v, a);
    else {
      forceBurst(game, a);
      knockBack(game, v, a, 1);
    }
  } else if (g === 'onyx') {
    if (parry) openVoid(game, v, a);
    else shadowPuff(game, a);
  } else if (g === 'moonstone') {
    if (parry) markMoon(game, a, 6);
  } else if (g === 'bloodstone') {
    if (parry) {
      bleed(game, a, v, 3);
      r.effect?.({ type: 'siphon', wx: a.x, wy: a.y + 1, wz: a.z, tx: v.x, ty: v.y + 1, tz: v.z, life: 0.55, oy: -6, n: 12, amp: 4, color: BLOOD });
      mend(game, v, 1);
    }
  }
}

// A ruby shield's parry: a wall of flame thrown across the ground ahead.
function emberWall(game, v, a) {
  const ang = Math.atan2(a.z - v.z, a.x - v.x);
  (game.flames ||= []).push({ from: v, main: a, x: v.x, y: v.y, z: v.z, ang, r: 0.4, range: 3.4, hit: new Set(), span: 1.25 });
  game.renderer.effect?.({ type: 'arc', wx: v.x, wy: v.y, wz: v.z, dx: Math.cos(ang), dz: Math.sin(ang), range: 3.4, span: 1.3, life: 0.75, oy: -6 });
  game.renderer.floatText(v.x, v.y + 2.6, v.z, 'ember wall!', '#ffb040');
  game.audio?.play('fire', v);
}

// A topaz shield: lightning out to the nearest three foes.
function thunderNova(game, v, a) {
  const r = game.renderer;
  const foes = around(game, v.x, v.z, 4).filter((e) => hostileTo(v, e, a)).sort((p, q) => Math.hypot(p.x - v.x, p.z - v.z) - Math.hypot(q.x - v.x, q.z - v.z)).slice(0, 3);
  r.effect?.({ type: 'ring', wx: v.x, wy: v.y, wz: v.z, r0: 3, r1: 22, color: BOLT, life: 0.4, oy: -8, flat: 0.6, thick: 2 });
  for (const e of foes) {
    r.effect?.({ type: 'bolt', wx: v.x, wy: v.y, wz: v.z, tx: e.x, ty: e.y, tz: e.z, life: 0.4, oy: -10 });
    r.emit(e.x, e.y + 1, e.z, { n: 8, color: BOLT, up: 40, life: 0.3, oy: -10 });
    game.damage(e, 2, v);
    stun(e, 1.2);
  }
  game.audio?.play('thunder', v);
  r.flashScreen?.('#fff8c0', 0.12);
}

// An amethyst shield's parry: everyone hostile within two paces thrown back.
function bulwark(game, v, a) {
  game.renderer.effect?.({ type: 'ring', wx: v.x, wy: v.y, wz: v.z, r0: 3, r1: 30, color: FORCE, life: 0.5, oy: -6, flat: 0.7, thick: 2 });
  for (const e of around(game, v.x, v.z, 2)) {
    if (!hostileTo(v, e, a)) continue;
    knockBack(game, v, e, 2);
    stun(e, 1);
    forceBurst(game, e);
  }
  game.audio?.play('boom', v);
}

// An onyx shield's parry: a void opens where they stand, dragging in
// everyone near and holding them.
function openVoid(game, v, a) {
  (game.voids ||= []).push({ x: a.x, y: a.y, z: a.z, t: 0, dur: 1.8, tick: 0, from: v, main: a });
  game.renderer.effect?.({ type: 'void', wx: a.x, wy: a.y, wz: a.z, life: 1.8, oy: 4 });
  game.renderer.floatText(a.x, a.y + 2.6, a.z, 'void!', '#c8a0ff');
  game.audio?.play('void', a);
}

// An emerald shield's gathered light, let out into you.
function releaseWard(game, v) {
  const n = Math.floor((v.wardStore || 0) / 2);
  v.wardStore = 0;
  if (n <= 0) return;
  mend(game, v, n);
  game.renderer.floatText(v.x, v.y + 2.4, v.z, `+${n}`, '#80f0a0');
}

// Each frame (yours): an emerald shield's gathered light shows, and comes
// out into you when you lower it.
export function tickGuard(game, p) {
  if (!(p.wardStore > 0)) return;
  if (p.blocking) {
    if (Math.random() < 0.15) game.renderer.emit(p.x, p.y + 1.1, p.z, { n: 1, color: LIFE, up: 10, speed: 6, gravity: -14, life: 0.6, shape: 'plus', glow: true, oy: -8 });
    return;
  }
  releaseWard(game, p);
}

// A bloodstone shield, out of breath: the blow's cost paid in blood (true if
// it was; the guard holds).
export function bloodPrice(game, v) {
  if (shieldGem(v) !== 'bloodstone' || v.hp <= 2) return false;
  v.hp -= 1;
  if (v.rec) v.rec.hp = v.hp;
  game.renderer.floatText(v.x, v.y + 2.2, v.z, 'blood price -1', '#ff6070');
  game.renderer.emit(v.x, v.y + 1.1, v.z, { n: 6, color: BLOOD, up: 16, speed: 24, gravity: 140, life: 0.5, oy: -6 });
  return true;
}

// A moonstone shield turns an arrow (bolt, stone) straight back at whoever
// loosed it (twice as hard off a parry). True if it was sent back.
export function mirrorShot(game, v, a, parry = false) {
  const src = a.from;
  if (shieldGem(v) !== 'moonstone' || !src || src.dead || src === v || a.reflected) return false;
  const dist = Math.hypot(src.x - v.x, src.z - v.z);
  game.projectiles.push({ from: v, target: src, x0: v.x, y0: v.y + 1, z0: v.z, tx: src.x, ty: src.y + 1, tz: src.z, t: 0, dur: 0.08 + dist * 0.04, dmg: Math.max(1, Math.round((a.dmg || 2) * (parry ? 2 : 1))), kind: a.kind === 'javelin' ? 'javelin' : a.kind || 'arrow', reflected: true, gem: null });
  moonBurst(game, v, 12);
  game.renderer.floatText(v.x, v.y + 2.6, v.z, parry ? 'MIRRORED!' : 'mirrored', '#e8f0ff');
  game.audio?.play('reflect', v);
  return true;
}

// What a parry window gains from a stone (none now: each shield stone has
// its own way; see SHIELD_EFFECTS).
export function parryBonus() {
  return 0;
}

// How much breath turning a blow costs.
export function blockCostMult() {
  return 1;
}

// A roll's cost, and how fast breath comes back, by the armour's stones.
export function rollCostMult(e) {
  return gemsOf(e).armor.includes('sapphire') ? 0.7 : 1;
}
export function breathMult(e) {
  return gemsOf(e).armor.includes('emerald') ? 1.25 : 1;
}

// A roll, done (from where to where, past whom): the armour's stones.
export function onRoll(game, p, from, past) {
  const g = gemsOf(p).armor;
  if (g.includes('ruby')) {
    game.renderer.effect?.({ type: 'blast', wx: from.x, wy: from.y, wz: from.z, r1: 14, life: 0.5, oy: 2 });
    game.renderer.emit(from.x, from.y + 0.5, from.z, { n: 12, color: FIRE, up: 30, speed: 30, life: 0.5, oy: -4 });
    for (const e of around(game, from.x, from.z, 1)) {
      if (e === p || !(e.kind === 'creature' || e.kind === 'monster' || (e.kind === 'npc' && e.state === 'fight' && e.threat === p) || (e.warband && e.hostileNow))) continue;
      burn(game, e, p, 2);
    }
  }
  if (g.includes('amethyst')) {
    for (const e of past) {
      if (e.dead || e === p) continue;
      knockBack(game, p, e, 1);
      stun(e, 0.4);
      forceBurst(game, e);
    }
  }
  // (A blow straight out of it: hard and true.)
  if (g.includes('topaz')) p.rollStrike = 1.1;
  // Onyx: gone into shadow. Whoever was about to strike you loses you, and
  // the shade you leave behind takes their eye.
  if (g.includes('onyx')) {
    p.shadeT = 1.4;
    game.renderer.effect?.({ type: 'ghost', wx: from.x, wy: from.y, wz: from.z, look: p.look, dir: p.dir, life: 1.4, oy: 0 });
    shadowPuff(game, from);
    for (const e of [...game.npcs, ...(game.creatures || [])]) {
      if (e.dead || Math.max(Math.abs(e.x - from.x), Math.abs(e.z - from.z)) > 8) continue;
      const on = (e.windup && e.windup.target === p) || e.target === p || e.threat === p;
      if (!on) continue;
      e.windup = null;
      e.attackCd = Math.max(e.attackCd || 0, 1.2);
      e.lostT = 1.4;
      game.renderer.floatText(e.x, e.y + 2.2, e.z, '?', '#c8a0ff');
    }
    game.audio?.play('void', p);
  }
  if (g.includes('bloodstone')) for (const e of past) if (!e.dead && e !== p) bleed(game, e, p, 1);
}

// Rolled clear of a blow: a moonstone gives breath back for it.
export function onDodge(game, v) {
  if (v.kind !== 'player' || !gemsOf(v).armor.includes('moonstone')) return;
  v.stamina = Math.min(v.maxStamina || 10, (v.stamina || 0) + 1.5);
  moonBurst(game, v, 9);
}

// Before a blow lands on someone in jewelled armour: onyx may let it pass
// through them like smoke (true: no blow at all).
export function evade(game, target, source) {
  if (!source || source === target || !gemsOf(target).armor.includes('onyx')) return false;
  if (Math.max(Math.abs(source.x - target.x), Math.abs(source.z - target.z)) > 2 || Math.random() >= 0.2) return false;
  shadowPuff(game, target);
  game.renderer.floatText(target.x, target.y + 2.2, target.z, 'through!', '#c8a0ff');
  return true;
}

// A blow on you, in moonstone armour: once a day, when it would bring you
// under a quarter of your health, a ward of moonlight forms and catches it
// (and the next two). Returns what's left of the blow.
export function moonWard(game, t, amount) {
  if (t.kind !== 'player') return amount;
  const w = t.moonWard;
  if (w && w.hits > 0 && w.t > 0) {
    w.hits--;
    moonBurst(game, t, 16);
    game.renderer.floatText(t.x, t.y + 2.4, t.z, 'warded', '#e8f0ff');
    if (w.hits <= 0) t.moonWard = null;
    return 0;
  }
  if (!gemsOf(t).armor.includes('moonstone') || t.hp - amount >= t.maxHp / 4 || t.moonWardDay === game.day) return amount;
  t.moonWardDay = game.day;
  t.moonWard = { hits: 2, t: 8 };
  moonBurst(game, t, 24);
  game.renderer.flashScreen?.('#e8f0ff', 0.2);
  game.ui?.msg('A ward of moonlight closes round you!', '#e8f0ff');
  game.audio?.play('moon', t);
  return 0;
}

// How much harder a blow lands for the wounded in bloodstone armour.
export function rageMult(e) {
  if (!e || !gemsOf(e).armor.includes('bloodstone')) return 1;
  const hurt = 1 - Math.max(0, e.hp) / Math.max(1, e.maxHp);
  return 1 + 0.5 * Math.max(0, Math.min(1, hurt / 0.75));
}

// Someone's fallen: a bloodstone blade feeds on a bleeding foe's end.
export function onKill(game, e, source) {
  if (!source || source.dead || !(e.bleedN > 0) || gemsOf(source).blade !== 'bloodstone') return;
  game.renderer.effect?.({ type: 'siphon', wx: e.x, wy: e.y + 1, wz: e.z, tx: source.x, ty: source.y + 1, tz: source.z, life: 0.6, oy: -6, n: 14, amp: 4, color: BLOOD });
  mend(game, source, 2);
}

// Someone wearing jewelled armour has been struck (in close).
export function onStruck(game, wearer, attacker, amount) {
  if (!attacker || attacker.dead || attacker === wearer) return;
  const close = Math.max(Math.abs(attacker.x - wearer.x), Math.abs(attacker.z - wearer.z)) <= 2;
  if (!close) return;
  for (const g of gemsOf(wearer).armor) {
    if (g === 'ruby') {
      burn(game, attacker, wearer, 2);
      game.renderer.emit(attacker.x, attacker.y + 1, attacker.z, { n: 8, color: FIRE, up: 30, speed: 30, life: 0.45, oy: -6 });
    } else if (g === 'sapphire') {
      chill(attacker, 2);
      frostBurst(game, attacker);
    } else if (g === 'topaz' && Math.random() < 0.25) {
      stun(attacker, 1);
      game.renderer.effect?.({ type: 'bolt', wx: wearer.x, wy: wearer.y, wz: wearer.z, tx: attacker.x, ty: attacker.y, tz: attacker.z, life: 0.3, oy: -10 });
    } else if (g === 'amethyst' && !attacker.thorned) {
      forceBurst(game, attacker);
      // (No endless back-and-forth between two thorny coats.)
      attacker.thorned = true;
      game.damage(attacker, Math.max(1, Math.round(amount * 0.3)), wearer);
      attacker.thorned = false;
    }
  }
}

// Every so often: fire burns, frost wears off, and an emerald in armour
// closes a wound.
export function tickStatus(game, e, dt) {
  if (e.dead) return;
  if (e.slowT > 0) e.slowT -= dt;
  if (e.kind !== 'creature' && e.stunT > 0) e.stunT -= dt;
  if (e.burnT > 0) {
    e.burnT -= dt;
    e.burnTick = (e.burnTick || 0) - dt;
    if (e.burnTick <= 0) {
      e.burnTick = 1;
      // (Water puts it out.)
      if (e.inWater) e.burnT = 0;
      else game.damage(e, 1, e.burnSrc || null);
    }
  }
  if (e.frozenT > 0) e.frozenT -= dt;
  if (e.markT > 0) e.markT -= dt;
  if (e.shadeT > 0) e.shadeT -= dt;
  if (e.lostT > 0) e.lostT -= dt;
  if (e.moonWard && (e.moonWard.t -= dt) <= 0) e.moonWard = null;
  if (e.bleedT > 0) {
    e.bleedT -= dt;
    e.bleedTick = (e.bleedTick || 0) - dt;
    if (e.bleedTick <= 0) {
      e.bleedTick = 1;
      game.damage(e, e.bleedN || 1, e.bleedSrc || null);
    }
    if (e.bleedT <= 0) e.bleedN = 0;
  }
  if (e.kind === 'player' || e.kind === 'npc') {
    // (Its own clock.)
    e.gemMendT = (e.gemMendT || 0) - dt;
    if (e.gemMendT <= 0) {
      e.gemMendT = 10;
      if (gemsOf(e).armor.includes('emerald')) mend(game, e, 1);
    }
  }
}

// Whether an NPC is carrying anything jewelled (for talk).
export function jewelled(rec) {
  const all = [rec.equipment && rec.equipment.tool, ...Object.values(rec.wear || {}), ...((rec.equipment && rec.equipment.items) || []).map((i) => i.item)];
  return all.filter((k) => k && ITEMS[k] && ITEMS[k].socket);
}

