// (Round 137) What a forged piece's triggers set off, in play: one of the
// piece's own modifiers woken for a while, or one of its abilities cast.
// What each trigger and ability is, and how it reads: world/triggers.js;
// how each looks: render/abilityfx.js.
//   Each player keeps their own clock and their own reckoning (`_ab`,
// never sent: only `abOn`, what's working on them to be drawn, goes over
// the wire). Everything here happens at the host, as the player it's
// happening to (see party.asSeat); what's seen and heard of it goes to
// whoever's near.
//   Nothing an ability does sets off another trigger (no meteor off a
// meteor's kill).
import { ITEMS } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';
import { TRIGGERS, ABILITIES, splitTok } from '../world/triggers.js';
import { modOf } from '../world/quality.js';
import { burn, chill, stun, mend, freeze, knockBack, bleed } from './gems.js';
import { foesNear } from './dishacts.js';
import { asSeat } from './party.js';

const WORN = ['head', 'body', 'legs', 'feet'];
const cheb = (a, x, z) => Math.max(Math.abs(a.x - x), Math.abs(a.z - z));
const NONE = Object.freeze([]);
const SHARDS = ['shard_ruby', 'shard_sapphire', 'shard_emerald', 'shard_topaz', 'shard_amethyst'];
// (What a shatterstrike may break: the ground's own, never what's built.)
const NATURAL = /^(stone|dirt|gravel|sand|clay|deepslate|basalt|granite|andesite|diorite|tuff|netherrack|.*_ore)$/;

// Each player's reckoning: their clock, the abilities' waits, the
// modifiers woken (until when), what's working on them, what's still to
// come (a meteor in the air), and what's watched for (night falling...).
export function abState(p) {
  return (p._ab ||= { t: 0, cd: {}, surge: {}, on: {}, pow: {}, q: [], zones: [], seek: [], combo: 0, comboT: 0, kills: [], hp: p.hp, sta: p.stamina, aff: 0, night: null, deep: null, wet: false, wetT: 0, deathCd: 0, hitT: {}, haloT: 0, bladeT: 0, zoneT: 0, seekT: 0, key: null, armed: NONE });
}

// As that player (with others playing, the one it's happening to).
function asP(game, p, fn) {
  if (game.seats && p.seat && p !== game.player) return asSeat(game, p.seat, () => fn());
  return fn();
}

// ------------------------------------------------------------ what's armed
// What `p` has about them that a trigger can set off: [{ cls, p (the
// modifier or ability), t (its trigger), ab, stars }], from the piece in
// their hand, their shield and the armour they wear.
export function armedOf(p) {
  if (!p || p.kind !== 'player') return NONE;
  const st = abState(p);
  const held = p.heldItem ? p.heldItem() : null;
  const eq = p.equip || {};
  const key = `${held || ''}|${eq.shield || ''}|${WORN.map((k) => eq[k] || '').join('|')}`;
  if (st.key === key) return st.armed;
  const out = [];
  const add = (k, ok) => {
    const it = k && ITEMS[k];
    if (!it || !it.mods || !it.gear || !ok(it)) return;
    for (const m of it.mods) {
      const sp = splitTok(m);
      if (sp.t && TRIGGERS[sp.t]) out.push({ cls: it.gear, p: sp.p, t: sp.t, ab: sp.ab, stars: it.stars || 1 });
    }
  };
  add(held, (it) => it.gear === 'blade' || it.gear === 'bow' || it.gear === 'tool');
  add(eq.shield, (it) => it.gear === 'shield');
  for (const s of WORN) add(eq[s], (it) => it.gear === 'armor');
  st.key = key;
  st.armed = out.length ? out : NONE;
  return st.armed;
}

// Does the modifier `m` on `cls`, set off by `t`, work just now? (See
// mods.hasMod.)
export function trigLive(e, cls, m, t) {
  const T = TRIGGERS[t];
  if (!T) return false;
  const g = e.game;
  if (T.hold === 'night') return !!g && !!g.isDay && !g.isDay();
  if (T.hold === 'deep') return !!g && !!g.dungeon;
  if (T.hold === 'day') return !!g && !!g.isDay && !!g.isDay();
  if (T.hold === 'rain') return raining(g);
  const st = e._ab;
  return !!st && (st.surge[`${cls}.${m}.${t}`] || 0) > st.t;
}

// ------------------------------------------------------------ triggers
// Something's happened to `p` (or they've done it): trigger `t`. Each
// thing it's bound to on them, by its chance: a modifier woken, an
// ability cast (when it's ready). True if anything came of it.
export function fireTrigger(game, p, t, ctx = {}) {
  if (!game || !p || p.kind !== 'player' || p.dead) return false;
  const armed = armedOf(p);
  if (!armed.length) return false;
  const st = abState(p);
  if (st.firing) return false;
  const T = TRIGGERS[t];
  if (!T) return false;
  let any = false;
  const woke = [];
  for (const e of armed) {
    if (e.t !== t) continue;
    if (T.chance < 1 && Math.random() >= T.chance) continue;
    if (e.ab) {
      if ((st.cd[e.p] || 0) > st.t) continue;
      if (cast(game, p, e.p, ctx, powOf(e.stars))) {
        st.cd[e.p] = st.t + ABILITIES[e.p].cd;
        any = true;
      }
      continue;
    }
    if (T.hold) {
      woke.push(e);
      any = true;
      continue;
    }
    const k = `${e.cls}.${e.p}.${t}`;
    if (!((st.surge[k] || 0) > st.t)) woke.push(e);
    st.surge[k] = st.t + T.secs;
    any = true;
  }
  if (woke.length) surgeFx(game, p, woke);
  return any;
}

// (Stars count: a fifth more an ability's harm and mending a star.)
const powOf = (stars) => 1 + 0.12 * Math.max(0, (stars || 1) - 1);

// A modifier woken: a glint of blue about you, its name, a chime.
function surgeFx(game, p, list) {
  const r = game.renderer;
  const names = [...new Set(list.map((e) => (modOf(e.cls, e.p) || {}).name))].filter(Boolean);
  r.effect?.({ type: 'ring', wx: p.x, wy: p.y, wz: p.z, r0: 3, r1: 16, color: ['#90c8f8', '#e0f0ff'], life: 0.45, oy: 3, flat: 0.45, thick: 1 });
  r.emit(p.x, p.y + 1.2, p.z, { n: 8, color: ['#90c8f8', '#e0f0ff', '#ffffff'], up: 20, speed: 24, life: 0.6, gravity: -10, shape: 'star', glow: true });
  if (names.length) r.floatText(p.x, p.y + 2.8, p.z, `♦ ${names.join(', ')}`, '#90c8f8');
  game.audio?.play('ab_surge', p);
}

// ------------------------------------------------------------ casting
// Ability `a` cast by `p`: true if it did anything (and then a sigil
// flares under them).
export function cast(game, p, a, ctx = {}, pow = 1) {
  const fn = CAST[a];
  if (!fn || p.dead) return false;
  const st = abState(p);
  st.firing = true;
  let did = false;
  try {
    did = !!asP(game, p, () => fn(game, p, ctx, pow, st));
  } finally {
    st.firing = false;
  }
  if (did) {
    const A = ABILITIES[a];
    game.renderer.effect?.({ type: 'sigil', wx: p.x, wy: p.y, wz: p.z, pal: A.pal, life: 0.9, oy: 4 });
    game.renderer.floatText(p.x, p.y + 3, p.z, A.name, A.color);
  }
  return did;
}

// What happens as `p` (an ability's harm and the like): nothing it does
// sets off another trigger.
function quiet(game, p, fn) {
  const st = abState(p);
  const was = st.firing;
  st.firing = true;
  try {
    return asP(game, p, fn);
  } finally {
    st.firing = was;
  }
}

// The one it's aimed at: whoever's in it (who struck you, who you struck),
// if still about and near enough, or the nearest foe.
function foeFor(game, p, r, ctx) {
  const f = ctx.source && ctx.source !== p ? ctx.source : ctx.target;
  if (f && !f.dead && !f.down && f.kind !== 'player' && f.kind !== 'item' && cheb(f, p.x, p.z) <= r && foesNear(game, p, r).includes(f)) return f;
  return foesNear(game, p, r)[0] || null;
}

// Something working on `p` a while: drawn on them (abOn), and its end.
function turnOn(p, k, secs, st, pow = 1) {
  st.on[k] = st.t + secs;
  st.pow[k] = pow;
  syncOn(p, st);
}
function syncOn(p, st) {
  const s = Object.keys(st.on).filter((k) => st.on[k] > st.t).sort().join(',');
  if ((p.abOn || '') !== s) p.abOn = s || undefined;
}
export const abilityOn = (p, k) => !!(p && p._ab && (p._ab.on[k] || 0) > p._ab.t);

// Later (a meteor's fall, a star's): `secs` from now.
function later(st, secs, fn) {
  st.q.push({ at: st.t + secs, fn });
}

const fx = (game, o) => game.renderer.effect?.(o);
const emit = (game, x, y, z, o) => game.renderer.emit(x, y, z, o);
const hurt = (game, e, n, p) => game.damage(e, Math.max(1, Math.round(n)), p);

// The tile behind `f`, from where `p` stands (or beside it), free to stand on.
function behind(game, p, f) {
  const sx = Math.sign(f.x - p.x);
  const sz = Math.sign(f.z - p.z);
  const tries = [[sx, sz], [sx, 0], [0, sz], [-sz, sx], [sz, -sx], [1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dz] of tries) {
    if (!dx && !dz) continue;
    const x = f.x + dx;
    const z = f.z + dz;
    const y = game.world.stepTarget(f.x, f.y, f.z, x, z, false);
    if (y < 0 || Math.abs(y - f.y) > 1) continue;
    if (game.occupiedBySolid && game.occupiedBySolid(x, y, z, p)) continue;
    if (game.world.isWaterAt && game.world.isWaterAt(x, y, z)) continue;
    return { x, y, z };
  }
  return null;
}
const raining = (g) => !!(g && g.weather && /rain|storm/.test(g.weather.kind || ''));
const DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];
// Toward the nearest foe within `r`, or the way `p` faces: [dx, dz].
function aimOf(game, p, r) {
  const f = foesNear(game, p, r)[0];
  if (f) {
    const dx = f.x - p.x;
    const dz = f.z - p.z;
    return Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
  }
  return DIRS[p.dir] || [0, 1];
}
const DIR_OF = (dx, dz) => (Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 3 : 1) : dz > 0 ? 0 : 2);

// Each ability: (game, p, ctx, pow, st) => true if it did anything.
export const CAST = {
  halo(game, p, ctx, pow, st) {
    turnOn(p, 'halo', 6, st, pow);
    st.haloT = 0;
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#ffe070', '#fff8d0'], r1: 34, life: 0.6, oy: 4, flat: 0.45 });
    emit(game, p.x, p.y + 1, p.z, { n: 14, color: ['#ffe070', '#fff8d0', '#a0f0a0'], up: 30, speed: 30, life: 0.9, gravity: -20, shape: 'plus', glow: true });
    game.audio?.play('ab_halo', p);
    return true;
  },
  nova(game, p, ctx, pow) {
    const foes = foesNear(game, p, 3);
    if (!foes.length) return false;
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#ff8030', '#fff0a0'], r1: 52, life: 0.55, oy: 4, flat: 0.5 });
    fx(game, { type: 'blast', wx: p.x, wy: p.y, wz: p.z, r1: 30, life: 0.6, oy: 2 });
    fx(game, { type: 'ring', wx: p.x, wy: p.y, wz: p.z, r0: 6, r1: 46, color: ['#ffe070', '#ff6020'], life: 0.5, oy: 4, flat: 0.5, thick: 2 });
    emit(game, p.x, p.y + 1, p.z, { n: 26, color: ['#ff6030', '#ffb040', '#fff0a0'], up: 30, speed: 110, life: 0.6, glow: true, gravity: 40 });
    game.renderer.flashScreen?.('#ffb060', 0.08);
    game.shake = Math.min(1.3, (game.shake || 0) + 0.4);
    game.audio?.play('ab_nova', p);
    game.audio?.play('crackle', p);
    quiet(game, p, () => {
      for (const e of foes) {
        hurt(game, e, 4 * pow, p);
        burn(game, e, p, 3);
        knockBack(game, p, e, 1);
      }
    });
    return true;
  },
  glacier(game, p, ctx, pow) {
    const foes = foesNear(game, p, 3);
    if (!foes.length) return false;
    fx(game, { type: 'spikes', wx: p.x, wy: p.y, wz: p.z, r1: 30, n: 11, life: 1.1, oy: 6 });
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#a0e0ff', '#ffffff'], r1: 44, life: 0.5, oy: 4, flat: 0.45 });
    emit(game, p.x, p.y + 1, p.z, { n: 20, color: ['#a0d8ff', '#e0f4ff', '#ffffff'], up: 30, speed: 70, life: 0.7, shape: 'star', gravity: 30 });
    game.audio?.play('ab_glacier', p);
    quiet(game, p, () => {
      foes.forEach((e, i) => {
        hurt(game, e, 2 * pow, p);
        if (i === 0) freeze(game, e, 2);
        else chill(e, 3);
        fx(game, { type: 'spikes', wx: e.x, wy: e.y, wz: e.z, r1: 9, n: 5, life: 0.8, oy: 6 });
      });
    });
    return true;
  },
  chain(game, p, ctx, pow) {
    const first = foeFor(game, p, 6, ctx);
    if (!first) return false;
    const hit = [first];
    while (hit.length < 4) {
      const last = hit[hit.length - 1];
      const next = foesNear(game, p, 9, last.x, last.z).find((e) => !hit.includes(e) && cheb(e, last.x, last.z) <= 4);
      if (!next) break;
      hit.push(next);
    }
    game.audio?.play('ab_chain', p);
    game.renderer.flashScreen?.('#e0e8ff', 0.06);
    let from = p;
    quiet(game, p, () => {
      hit.forEach((e, i) => {
        fx(game, { type: 'bolt', wx: from.x, wy: from.y + 0.8, wz: from.z, tx: e.x, ty: e.y + 0.8, tz: e.z, life: 0.4 + i * 0.05, oy: -8 });
        emit(game, e.x, e.y + 1, e.z, { n: 10, color: ['#ffffff', '#c8d8ff', '#ffe040'], up: 30, speed: 60, life: 0.4, glow: true, gravity: 60 });
        hurt(game, e, [5, 4, 3, 2][i] * pow, p);
        stun(e, 0.4);
        from = e;
      });
    });
    return true;
  },
  meteor(game, p, ctx, pow, st) {
    const f = foeFor(game, p, 8, ctx);
    if (!f) return false;
    const at = { x: f.x, y: f.y, z: f.z };
    fx(game, { type: 'meteor', wx: at.x, wy: at.y, wz: at.z, life: 0.7, oy: 4 });
    game.audio?.play('ab_meteor', at);
    later(st, 0.66, () => {
      fx(game, { type: 'shock', wx: at.x, wy: at.y, wz: at.z, color: ['#ff6020', '#ffe070'], r1: 56, life: 0.6, oy: 4, flat: 0.5 });
      fx(game, { type: 'blast', wx: at.x, wy: at.y, wz: at.z, r1: 34, life: 0.7, oy: 2 });
      emit(game, at.x, at.y + 0.6, at.z, { n: 30, color: ['#ff6030', '#ffb040', '#fff0a0', '#4a4040'], up: 70, speed: 110, life: 0.8, gravity: 140 });
      emit(game, at.x, at.y + 0.4, at.z, { n: 8, color: ['#5a5050', '#3a3434'], up: 20, speed: 30, life: 1.4, shape: 'puff', grow: 2.5, gravity: -6 });
      game.renderer.flashScreen?.('#ffa040', 0.12);
      game.shake = Math.min(1.5, (game.shake || 0) + 0.8);
      game.audio?.play('ab_impact', at);
      quiet(game, p, () => {
        for (const e of foesNear(game, p, 12, at.x, at.z)) {
          if (cheb(e, at.x, at.z) > 2) continue;
          hurt(game, e, 9 * pow, p);
          burn(game, e, p, 3);
          knockBack(game, at, e, 2);
        }
      });
    });
    return true;
  },
  blades(game, p, ctx, pow, st) {
    turnOn(p, 'blades', 6, st, pow);
    st.bladeT = 0;
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#c0d0ff', '#ffffff'], r1: 30, life: 0.45, oy: -4, flat: 0.45 });
    emit(game, p.x, p.y + 1, p.z, { n: 12, color: ['#ffffff', '#c0d0ff'], up: 10, speed: 70, life: 0.4, shape: 'shard', glow: true });
    game.audio?.play('ab_blades', p);
    return true;
  },
  aegis(game, p, ctx, pow, st) {
    turnOn(p, 'aegis', 10, st, pow);
    st.shield = Math.round(8 * pow);
    fx(game, { type: 'dome', wx: p.x, wy: p.y, wz: p.z, color: ['#80c8ff', '#ffffff'], life: 0.8, oy: 4, big: 1.4 });
    emit(game, p.x, p.y + 1, p.z, { n: 12, color: ['#80c8ff', '#ffffff'], up: 20, speed: 40, life: 0.6, shape: 'star', glow: true });
    game.audio?.play('ab_aegis', p);
    return true;
  },
  shade(game, p, ctx, pow, st) {
    const f = foeFor(game, p, 6, ctx);
    if (!f) return false;
    const at = behind(game, p, f);
    if (!at) return false;
    const from = { x: p.x, y: p.y, z: p.z };
    if (p.look) fx(game, { type: 'ghost', wx: from.x, wy: from.y, wz: from.z, look: p.look, dir: p.dir, life: 0.6, oy: -6 });
    fx(game, { type: 'void', wx: from.x, wy: from.y, wz: from.z, life: 0.5, oy: 4 });
    emit(game, from.x, from.y + 1, from.z, { n: 14, color: ['#9a6ad8', '#e0d0ff', '#3a2060'], up: 20, speed: 40, life: 0.6, shape: 'star', glow: true });
    game.teleportPlayer(at.x, at.y, at.z);
    p.dir = DIR_OF(f.x - at.x, f.z - at.z);
    fx(game, { type: 'void', wx: at.x, wy: at.y, wz: at.z, life: 0.45, oy: 4 });
    emit(game, at.x, at.y + 1, at.z, { n: 14, color: ['#9a6ad8', '#e0d0ff', '#ffffff'], up: 20, speed: 40, life: 0.6, shape: 'star', glow: true });
    st.critT = st.t + 3;
    game.audio?.play('ab_shade', p);
    return true;
  },
  rend(game, p, ctx, pow) {
    const f = foeFor(game, p, 5, ctx);
    if (!f) return false;
    const len = Math.max(1, Math.hypot(f.x - p.x, f.z - p.z));
    const ux = (f.x - p.x) / len;
    const uz = (f.z - p.z) / len;
    const end = { x: Math.round(p.x + ux * 5), y: p.y, z: Math.round(p.z + uz * 5) };
    fx(game, { type: 'fissure', wx: p.x, wy: p.y, wz: p.z, tx: end.x, ty: end.y, tz: end.z, life: 1.4, oy: 4 });
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#c8a070', '#ffe0a0'], r1: 26, life: 0.4, oy: 4, flat: 0.45 });
    for (let i = 1; i <= 5; i++) emit(game, p.x + ux * i, p.y + 0.3, p.z + uz * i, { n: 4, color: ['#a89878', '#8a7a5a', '#ffb040'], up: 40, speed: 30, life: 0.6, gravity: 140 });
    game.shake = Math.min(1.4, (game.shake || 0) + 0.6);
    game.audio?.play('ab_rend', p);
    quiet(game, p, () => {
      for (const e of foesNear(game, p, 6)) {
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const along = dx * ux + dz * uz;
        const off = Math.abs(dx * uz - dz * ux);
        if (along < 0.5 || along > 5.5 || off > 0.9) continue;
        hurt(game, e, 4 * pow, p);
        stun(e, 1.5);
      }
    });
    return true;
  },
  roots(game, p, ctx, pow) {
    const foes = foesNear(game, p, 4);
    if (!foes.length) return false;
    game.audio?.play('ab_roots', p);
    quiet(game, p, () => {
      for (const e of foes) {
        fx(game, { type: 'roots', wx: e.x, wy: e.y, wz: e.z, life: 2.6, oy: 6 });
        emit(game, e.x, e.y + 0.2, e.z, { n: 8, color: ['#5a8a30', '#3a2a18', '#90d060'], up: 20, speed: 30, life: 0.6, gravity: 80 });
        hurt(game, e, 1 * pow, p);
        stun(e, 2.5);
        e.slowT = Math.max(e.slowT || 0, 3.5);
      }
    });
    return true;
  },
  siphon(game, p, ctx, pow) {
    const foes = foesNear(game, p, 4).slice(0, 5);
    if (!foes.length) return false;
    let got = 0;
    game.audio?.play('ab_siphon', p);
    quiet(game, p, () => {
      for (const e of foes) {
        fx(game, { type: 'siphon', wx: e.x, wy: e.y + 0.8, wz: e.z, tx: p.x, ty: p.y + 0.8, tz: p.z, life: 0.9, oy: -8, n: 20, color: ['#e060c0', '#ff90e0', '#ffffff'], amp: 6 });
        const before = e.hp;
        hurt(game, e, 2 * pow, p);
        got += Math.max(0, before - (e.dead ? 0 : e.hp));
      }
    });
    const heal = Math.min(6, Math.max(1, got));
    const was = p.hp;
    mend(game, p, heal);
    if (p.hp > was) game.renderer.floatText(p.x, p.y + 2.4, p.z, `+${p.hp - was} ♥`, '#ff90e0');
    return true;
  },
  wisps(game, p, ctx, pow, st) {
    const foes = foesNear(game, p, 7);
    if (!foes.length) return false;
    game.audio?.play('ab_wisps', p);
    for (let i = 0; i < 3; i++) {
      const e = foes[i % foes.length];
      const life = 0.7 + i * 0.15;
      fx(game, { type: 'wisp', wx: p.x, wy: p.y + 1.2, wz: p.z, tx: e.x, ty: e.y + 0.8, tz: e.z, life, oy: -8, color: ['#80ffe0'], bend: i - 1 });
      later(st, life, () => {
        if (e.dead) return;
        emit(game, e.x, e.y + 1, e.z, { n: 10, color: ['#80ffe0', '#ffffff'], up: 20, speed: 40, life: 0.5, shape: 'star', glow: true });
        game.audio?.play('chime', e);
        quiet(game, p, () => hurt(game, e, 3 * pow, p));
        e.markT = Math.max(e.markT || 0, 4);
      });
    }
    return true;
  },
  smite(game, p, ctx, pow) {
    const f = foeFor(game, p, 8, ctx);
    if (!f) return false;
    fx(game, { type: 'pillar', wx: f.x, wy: f.y, wz: f.z, color: ['#ffe070'], life: 0.8, oy: 4, w: 8 });
    fx(game, { type: 'shock', wx: f.x, wy: f.y, wz: f.z, color: ['#ffe070', '#ffffff'], r1: 36, life: 0.5, oy: 4, flat: 0.45 });
    emit(game, f.x, f.y + 1, f.z, { n: 18, color: ['#ffffff', '#fff8c0', '#ffe070'], up: 50, speed: 60, life: 0.7, glow: true, shape: 'star', gravity: 20 });
    game.renderer.flashScreen?.('#fff8d0', 0.1);
    game.audio?.play('ab_smite', f);
    const undead = !!(f.S && f.S.undead);
    quiet(game, p, () => {
      hurt(game, f, 6 * pow * (undead ? 2 : 1), p);
      stun(f, 1);
    });
    return true;
  },
  quicken(game, p, ctx, pow, st) {
    turnOn(p, 'quicken', 6, st, pow);
    (p.dishTemp ||= {}).speed = { n: 0.4, until: (p.dishClock || 0) + 6 };
    p._dishFx = null;
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#ffe060', '#ffffff'], r1: 30, life: 0.4, oy: 4, flat: 0.45 });
    emit(game, p.x, p.y + 0.6, p.z, { n: 12, color: ['#ffe060', '#ffffff'], up: 8, speed: 60, life: 0.4, shape: 'puff' });
    game.audio?.play('ab_quicken', p);
    return true;
  },
  rage(game, p, ctx, pow, st) {
    turnOn(p, 'rage', 8, st, pow);
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#ff3020', '#ffb040'], r1: 34, life: 0.5, oy: 4, flat: 0.45 });
    emit(game, p.x, p.y + 1, p.z, { n: 18, color: ['#ff3020', '#ff8040', '#ffd060'], up: 40, speed: 50, life: 0.6, glow: true, gravity: -10 });
    game.renderer.flashScreen?.('#ff2010', 0.08);
    game.shake = Math.min(1.2, (game.shake || 0) + 0.3);
    game.audio?.play('ab_rage', p);
    return true;
  },
  bramble(game, p, ctx, pow, st) {
    turnOn(p, 'bramble', 8, st, pow);
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, pal: 'green', r1: 24, life: 0.45, oy: 4 });
    emit(game, p.x, p.y + 0.5, p.z, { n: 14, color: ['#3a6a20', '#70b040', '#c8e8a0'], up: 20, speed: 40, life: 0.6, gravity: 60, shape: 'shard' });
    game.audio?.play('ab_bramble', p);
    return true;
  },
  cyclone(game, p, ctx, pow, st) {
    const foes = foesNear(game, p, 4);
    if (!foes.length) return false;
    fx(game, { type: 'vortex', wx: p.x, wy: p.y, wz: p.z, r1: 56, life: 1.1, oy: 4 });
    game.audio?.play('ab_cyclone', p);
    // In, toward you...
    for (const e of foes) knockBack(game, { x: 2 * e.x - p.x, z: 2 * e.z - p.z }, e, 2);
    // ...and out again, hard.
    later(st, 0.65, () => {
      fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#d0f0e8', '#ffffff'], r1: 50, life: 0.45, oy: 4, flat: 0.45 });
      game.audio?.play('gust', p);
      quiet(game, p, () => {
        for (const e of foesNear(game, p, 4)) {
          hurt(game, e, 2 * pow, p);
          knockBack(game, p, e, 3);
          stun(e, 0.8);
        }
      });
    });
    return true;
  },
  plague(game, p, ctx, pow, st) {
    const f = foeFor(game, p, 6, ctx);
    if (!f) return false;
    const z = { x: f.x, y: f.y, z: f.z, until: st.t + 5, pow };
    st.zones.push(z);
    fx(game, { type: 'cloud', wx: z.x, wy: z.y, wz: z.z, r1: 30, life: 5, oy: 2 });
    emit(game, z.x, z.y + 1, z.z, { n: 14, color: ['#90c040', '#c8f070', '#5a7a20'], up: 14, speed: 30, life: 1.2, shape: 'puff', grow: 2, gravity: -4 });
    game.audio?.play('ab_plague', z);
    return true;
  },
  stasis(game, p, ctx, pow, st) {
    const foes = foesNear(game, p, 6);
    if (!foes.length) return false;
    turnOn(p, 'stasis', 5, st, pow);
    fx(game, { type: 'clock', wx: p.x, wy: p.y, wz: p.z, pal: 'violet', r1: 60, life: 5, oy: 4 });
    game.renderer.flashScreen?.('#c0a0ff', 0.08);
    game.audio?.play('ab_stasis', p);
    for (const e of foes) {
      e.slowT = Math.max(e.slowT || 0, 5);
      if (!(e.isBoss || e.S?.boss)) e.attackCd = Math.max(e.attackCd || 0, 1.5);
      emit(game, e.x, e.y + 1, e.z, { n: 6, color: ['#c0a0ff', '#ffffff'], up: 6, speed: 10, life: 1, shape: 'star' });
    }
    return true;
  },
  starfall(game, p, ctx, pow, st) {
    if (!foesNear(game, p, 5).length) return false;
    game.audio?.play('ab_starfall', p);
    for (let i = 0; i < 6; i++) {
      later(st, i * 0.32, () => {
        const foes = foesNear(game, p, 5);
        const e = foes.length ? foes[Math.floor(Math.random() * foes.length)] : null;
        const at = e ? { x: e.x, y: e.y, z: e.z } : { x: p.x + Math.round((Math.random() - 0.5) * 6), y: p.y, z: p.z + Math.round((Math.random() - 0.5) * 6) };
        fx(game, { type: 'star', wx: at.x, wy: at.y, wz: at.z, life: 0.6, oy: 4 });
        later(st, 0.33, () => {
          emit(game, at.x, at.y + 0.6, at.z, { n: 10, color: ['#ffffff', '#fff8c0', '#c8d8ff'], up: 30, speed: 50, life: 0.5, shape: 'star', glow: true, gravity: 40 });
          game.audio?.play('ab_star', at);
          quiet(game, p, () => {
            for (const q of foesNear(game, p, 9, at.x, at.z)) if (cheb(q, at.x, at.z) <= 0) hurt(game, q, 3 * pow, p);
          });
        });
      });
    }
    return true;
  },
  phantom(game, p, ctx, pow) {
    const f = foeFor(game, p, 3, ctx);
    if (!f) return false;
    const def = p.heldDef ? p.heldDef() : null;
    const dmg = Math.max(3, ((def && def.damage && !def.ranged ? def.damage : 3) * 0.7)) * pow;
    if (p.look) fx(game, { type: 'ghost', wx: p.x, wy: p.y, wz: p.z, look: p.look, dir: DIR_OF(f.x - p.x, f.z - p.z), strike: true, life: 0.5, oy: -6, filter: 'brightness(0.6) sepia(1) hue-rotate(200deg) saturate(3)', glow: '#b8a8ff' });
    fx(game, { type: 'slash', wx: f.x, wy: f.y, wz: f.z, color: ['#b8a8ff', '#ffffff'], ang: Math.atan2(f.z - p.z, f.x - p.x) - 0.6, life: 0.4, oy: 0 });
    emit(game, f.x, f.y + 1, f.z, { n: 10, color: ['#b8a8ff', '#ffffff'], up: 20, speed: 50, life: 0.4, glow: true });
    game.audio?.play('ab_phantom', f);
    quiet(game, p, () => hurt(game, f, dmg, p));
    return true;
  },
  thunder(game, p, ctx, pow) {
    const foes = foesNear(game, p, 2);
    if (!foes.length) return false;
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#e8f0ff', '#ffffff'], r1: 60, life: 0.5, oy: 4, flat: 0.5 });
    fx(game, { type: 'ring', wx: p.x, wy: p.y, wz: p.z, r0: 4, r1: 40, color: ['#c8d8ff', '#ffffff'], life: 0.35, oy: 4, flat: 0.5, thick: 2 });
    fx(game, { type: 'bolt', from: 'sky', wx: p.x, wy: p.y, wz: p.z, tx: p.x, ty: p.y, tz: p.z, life: 0.35, oy: -4 });
    emit(game, p.x, p.y + 0.3, p.z, { n: 16, color: ['#a89878', '#e8f0ff'], up: 20, speed: 90, life: 0.5, shape: 'puff' });
    game.renderer.flashScreen?.('#ffffff', 0.14);
    game.shake = Math.min(1.5, (game.shake || 0) + 1);
    game.audio?.play('ab_thunder', p);
    quiet(game, p, () => {
      for (const e of foes) {
        hurt(game, e, 2 * pow, p);
        knockBack(game, p, e, 2);
        stun(e, 1.5);
      }
    });
    return true;
  },
  beacon(game, p, ctx, pow) {
    const near = (game.everyone ? game.everyone() : [p]).filter((e) => !e.dead && cheb(e, p.x, p.z) <= 6);
    fx(game, { type: 'pillar', wx: p.x, wy: p.y, wz: p.z, color: ['#ffd080'], life: 1, oy: 4, w: 6 });
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#ffd080', '#ffffff'], r1: 80, life: 0.8, oy: 4, flat: 0.45 });
    game.audio?.play('ab_beacon', p);
    for (const e of near) {
      e.stamina = e.maxStamina || e.stamina;
      mend(game, e, Math.round(2 * pow));
      emit(game, e.x, e.y + 1.4, e.z, { n: 8, color: ['#ffd080', '#ffffff'], up: 20, speed: 20, life: 0.8, shape: 'plus', gravity: -10 });
    }
    return true;
  },
  shatter(game, p, ctx, pow) {
    const at = ctx.at;
    if (!at || ctx.id === undefined) return false;
    const b = BLOCKS[ctx.id];
    if (!b || !NATURAL.test(b.name)) return false;
    const w = game.world;
    if (w.ow && w.ow.settlementAt && w.ow.settlementAt(at.x, at.z)) return false;
    const got = [];
    for (let dy = -1; dy <= 1 && got.length < Math.round(4 * pow); dy++) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [0, 0]]) {
        if (!dx && !dz && !dy) continue;
        const x = at.x + dx;
        const y = at.y + dy;
        const z = at.z + dz;
        if (w.getBlock(x, y, z) !== ctx.id) continue;
        got.push([x, y, z]);
        if (got.length >= Math.round(4 * pow)) break;
      }
    }
    if (!got.length) return false;
    fx(game, { type: 'shock', wx: at.x, wy: at.y, wz: at.z, color: ['#d8d0c0', '#ffffff'], r1: 30, life: 0.4, oy: 4, flat: 0.5 });
    game.audio?.play('ab_shatter', at);
    for (const [x, y, z] of got) {
      emit(game, x, y + 0.5, z, { n: 6, color: ['#a8a098', '#d8d0c0', '#ffffff'], up: 30, speed: 50, life: 0.5, shape: 'shard', gravity: 120 });
      game.breakBlock(x, y, z, true);
    }
    return true;
  },
  midas(game, p, ctx) {
    const at = ctx.at || p;
    const n = 1 + Math.floor(Math.random() * 4);
    game.spawnDrop?.('coin', n, at.x, (at.y ?? p.y) + 1, at.z, true);
    if (Math.random() < 0.1) game.spawnDrop?.(SHARDS[Math.floor(Math.random() * SHARDS.length)], 1, at.x, (at.y ?? p.y) + 1, at.z, true);
    fx(game, { type: 'shock', wx: at.x, wy: at.y ?? p.y, wz: at.z, color: ['#ffd040', '#fff8c0'], r1: 30, life: 0.5, oy: 4, flat: 0.45 });
    emit(game, at.x, (at.y ?? p.y) + 1, at.z, { n: 16, color: ['#ffd040', '#fff8c0', '#c89020'], up: 40, speed: 50, life: 0.7, shape: 'star', glow: true, gravity: 60 });
    game.audio?.play('ab_midas', at);
    game.audio?.play('coin', at);
    return true;
  },
  seek(game, p, ctx, pow, st) {
    const w = game.world;
    const found = [];
    for (let dy = -4; dy <= 4 && found.length < 24; dy++) {
      for (let dz = -8; dz <= 8 && found.length < 24; dz++) {
        for (let dx = -8; dx <= 8 && found.length < 24; dx++) {
          const b = BLOCKS[w.getBlock(p.x + dx, p.y + dy, p.z + dz)];
          if (b && /_ore$/.test(b.name)) found.push({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
        }
      }
    }
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, color: ['#80f0ff', '#ffffff'], r1: 110, life: 0.9, oy: 4, flat: 0.45 });
    game.audio?.play('ab_seek', p);
    st.seek = found.map((q) => ({ ...q, until: st.t + 10 }));
    if (!found.length) game.renderer.floatText(p.x, p.y + 2.4, p.z, 'no ore near', '#80f0ff');
    return true;
  },
};

// (Round 138) More abilities.
Object.assign(CAST, {
  firewall(game, p, ctx, pow, st) {
    const [dx, dz] = aimOf(game, p, 6);
    const cx = p.x + dx * 2;
    const cz = p.z + dz * 2;
    const tiles = [];
    for (let i = -2; i <= 2; i++) tiles.push([cx + (dz ? i : 0), cz + (dx ? i : 0)]);
    st.zones.push({ k: 'fire', tiles, y: p.y, until: st.t + 4, pow });
    const [a, b] = [tiles[0], tiles[tiles.length - 1]];
    fx(game, { type: 'firewall', wx: a[0], wy: p.y, wz: a[1], tx: b[0], ty: p.y, tz: b[1], life: 4, oy: 6 });
    emit(game, cx, p.y + 0.5, cz, { n: 18, color: ['#ff6030', '#ffb040', '#fff0a0'], up: 40, speed: 50, life: 0.6, glow: true });
    game.audio?.play('ab_firewall', p);
    game.audio?.play('crackle', p);
    return true;
  },
  geyser(game, p, ctx, pow) {
    const f = foeFor(game, p, 6, ctx);
    if (!f) return false;
    fx(game, { type: 'geyser', wx: f.x, wy: f.y, wz: f.z, life: 1.2, oy: 6 });
    fx(game, { type: 'shock', wx: f.x, wy: f.y, wz: f.z, pal: 'water', r1: 26, life: 0.45, oy: 4 });
    emit(game, f.x, f.y + 1.5, f.z, { n: 20, color: ['#a0d4ff', '#ffffff', '#4c98dc'], up: 70, speed: 40, life: 0.8, gravity: 160, shape: 'drop' });
    game.audio?.play('ab_geyser', f);
    quiet(game, p, () => {
      hurt(game, f, 5 * pow, p);
      stun(f, 1.5);
      if (f.burnT > 0) f.burnT = 0;
    });
    return true;
  },
  ironskin(game, p, ctx, pow, st) {
    turnOn(p, 'ironskin', 8, st, pow);
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, pal: 'steel', r1: 26, life: 0.45, oy: 4 });
    emit(game, p.x, p.y + 1, p.z, { n: 12, color: ['#c4ccd8', '#ffffff', '#8490a2'], up: 30, speed: 50, life: 0.4, shape: 'shard', gravity: 100 });
    game.audio?.play('ab_ironskin', p);
    return true;
  },
  pact(game, p, ctx, pow, st) {
    turnOn(p, 'pact', 8, st, pow);
    fx(game, { type: 'shock', wx: p.x, wy: p.y, wz: p.z, pal: 'blood', r1: 28, life: 0.5, oy: 4 });
    emit(game, p.x, p.y + 1.2, p.z, { n: 12, color: ['#c82830', '#ff6858', '#7a1020'], up: 20, speed: 30, life: 0.7, gravity: 120, shape: 'drop' });
    game.audio?.play('ab_pact', p);
    return true;
  },
  hook(game, p, ctx, pow, st) {
    const foes = foesNear(game, p, 7).filter((e) => cheb(e, p.x, p.z) >= 2);
    const f = ctx.source && foes.includes(ctx.source) ? ctx.source : foes[foes.length - 1];
    if (!f) return false;
    fx(game, { type: 'chain', wx: p.x, wy: p.y + 0.6, wz: p.z, tx: f.x, ty: f.y + 0.6, tz: f.z, life: 0.6, oy: -6 });
    game.audio?.play('ab_hook', p);
    later(st, 0.28, () => {
      if (f.dead) return;
      const n = cheb(f, p.x, p.z) - 1;
      if (n > 0) knockBack(game, { x: 2 * f.x - p.x, z: 2 * f.z - p.z }, f, n);
      emit(game, f.x, f.y + 1, f.z, { n: 8, color: ['#c4ccd8', '#ffffff'], up: 20, speed: 40, life: 0.3 });
      game.audio?.play('clang', f);
      quiet(game, p, () => {
        hurt(game, f, 2 * pow, p);
        stun(f, 1.2);
      });
    });
    return true;
  },
  lance(game, p, ctx, pow, st) {
    const f = foeFor(game, p, 8, ctx);
    if (!f) return false;
    fx(game, { type: 'lance', wx: p.x, wy: p.y + 0.8, wz: p.z, tx: f.x, ty: f.y + 0.8, tz: f.z, life: 0.32, oy: -6 });
    game.audio?.play('ab_lance', p);
    later(st, 0.3, () => {
      if (f.dead) return;
      fx(game, { type: 'spikes', wx: f.x, wy: f.y, wz: f.z, r1: 9, n: 5, life: 0.9, oy: 6 });
      game.audio?.play('freeze', f);
      quiet(game, p, () => {
        hurt(game, f, 5 * pow, p);
        freeze(game, f, 1.5);
      });
    });
    return true;
  },
  swarm(game, p, ctx, pow, st) {
    const f = foeFor(game, p, 6, ctx);
    if (!f) return false;
    game.audio?.play('ab_swarm', f);
    for (let i = 0; i < 10; i++) {
      later(st, i * 0.5, () => {
        if (f.dead) return;
        fx(game, { type: 'swarm', wx: f.x, wy: f.y, wz: f.z, life: 0.55, oy: 2 });
        if (i % 4 === 3) game.audio?.play('ab_swarm', f);
        quiet(game, p, () => hurt(game, f, pow, p));
      });
    }
    return true;
  },
  well(game, p, ctx, pow, st) {
    const f = foeFor(game, p, 6, ctx);
    if (!f) return false;
    const at = { x: f.x, y: f.y, z: f.z };
    fx(game, { type: 'well', wx: at.x, wy: at.y, wz: at.z, life: 2.2, oy: 4 });
    game.audio?.play('ab_well', at);
    for (const t of [0.5, 1, 1.5]) {
      later(st, t, () => {
        for (const e of foesNear(game, p, 14, at.x, at.z)) if (cheb(e, at.x, at.z) <= 4 && cheb(e, at.x, at.z) > 0) knockBack(game, { x: 2 * e.x - at.x, z: 2 * e.z - at.z }, e, 1);
      });
    }
    later(st, 2, () => {
      fx(game, { type: 'shock', wx: at.x, wy: at.y, wz: at.z, pal: 'violet', r1: 40, life: 0.5, oy: 4 });
      emit(game, at.x, at.y + 0.6, at.z, { n: 20, color: ['#cab4ff', '#8a64d8', '#ffffff'], up: 40, speed: 80, life: 0.5, shape: 'star', glow: true });
      game.renderer.flashScreen?.('#8a64d8', 0.08);
      game.shake = Math.min(1.3, (game.shake || 0) + 0.5);
      game.audio?.play('ab_impact', at);
      quiet(game, p, () => {
        for (const e of foesNear(game, p, 14, at.x, at.z)) {
          if (cheb(e, at.x, at.z) > 2) continue;
          hurt(game, e, 6 * pow, p);
          stun(e, 1);
        }
      });
    });
    return true;
  },
  renew(game, p, ctx, pow) {
    for (const k of ['burnT', 'poisonT', 'bleedT', 'frozenT', 'slowT']) if (p[k] > 0) p[k] = 0;
    p.bleedN = 0;
    const was = p.hp;
    mend(game, p, Math.round(3 * pow));
    if (p.hp > was) game.renderer.floatText(p.x, p.y + 2.4, p.z, `+${p.hp - was} ♥`, '#a0d860');
    fx(game, { type: 'bloom', wx: p.x, wy: p.y, wz: p.z, life: 1.6, oy: 4 });
    emit(game, p.x, p.y + 1, p.z, { n: 14, color: ['#ff7090', '#a0c8ff', '#ffffff', '#c890ff', '#a0d860'], up: 20, speed: 30, life: 1, gravity: 20, shape: 'star' });
    game.audio?.play('ab_renew', p);
    return true;
  },
  veil(game, p, ctx, pow, st) {
    turnOn(p, 'veil', 5, st, pow);
    fx(game, { type: 'smoke', wx: p.x, wy: p.y, wz: p.z, r1: 34, life: 5, oy: 4 });
    game.audio?.play('ab_veil', p);
    for (const e of foesNear(game, p, 5)) {
      if (e.target === p) e.target = null;
      stun(e, 0.8);
    }
    return true;
  },
  spirit(game, p, ctx, pow, st) {
    const f = foeFor(game, p, 8, ctx);
    if (!f) return false;
    fx(game, { type: 'spirit', wx: p.x, wy: p.y, wz: p.z, tx: f.x, ty: f.y, tz: f.z, life: 1.4, oy: 6 });
    game.audio?.play('ab_spirit', p);
    for (const t of [0.6, 0.9, 1.2]) {
      later(st, t, () => {
        if (f.dead) return;
        fx(game, { type: 'bite', wx: f.x, wy: f.y, wz: f.z, life: 0.3, oy: 4 });
        emit(game, f.x, f.y + 1, f.z, { n: 6, color: ['#a0ffe4', '#ffffff'], up: 20, speed: 40, life: 0.3, glow: true });
        game.audio?.play('bite', f);
        quiet(game, p, () => hurt(game, f, 3 * pow, p));
      });
    }
    return true;
  },
  gale(game, p, ctx, pow) {
    const [dx, dz] = aimOf(game, p, 6);
    const w = game.world;
    let x = p.x;
    let y = p.y;
    let z = p.z;
    let land = null;
    const passed = new Set();
    for (let i = 0; i < 5; i++) {
      const ny = w.stepTarget(x, y, z, x + dx, z + dz, false);
      if (ny < 0 || (w.isWaterAt && w.isWaterAt(x + dx, ny, z + dz))) break;
      x += dx;
      z += dz;
      y = ny;
      for (const e of foesNear(game, p, 8)) if (cheb(e, x, z) <= 1) passed.add(e);
      if (!(game.occupiedBySolid && game.occupiedBySolid(x, y, z, p))) land = { x, y, z };
      if (i >= 3 && land && land.x === x && land.z === z) break;
    }
    if (!land) return false;
    const from = { x: p.x, y: p.y, z: p.z };
    fx(game, { type: 'gust', wx: from.x, wy: from.y, wz: from.z, tx: land.x, ty: land.y, tz: land.z, life: 0.6, oy: 4 });
    if (p.look) fx(game, { type: 'ghost', wx: from.x, wy: from.y, wz: from.z, look: p.look, dir: p.dir, life: 0.4, oy: -6, filter: 'brightness(1.4) sepia(1) hue-rotate(120deg) saturate(1.5)', glow: '#e0f4ee' });
    game.teleportPlayer(land.x, land.y, land.z);
    game.audio?.play('ab_gale', p);
    quiet(game, p, () => {
      for (const e of passed) {
        hurt(game, e, 3 * pow, p);
        stun(e, 0.5);
        emit(game, e.x, e.y + 1, e.z, { n: 6, color: ['#e0f4ee', '#ffffff'], up: 20, speed: 50, life: 0.3 });
      }
    });
    return true;
  },
});

// ------------------------------------------------------------ in a fight
// A blow on `p` turned by an aegis, or one that would have killed them
// held off (once in five minutes, by an undying piece): what's left of it.
export function abSoak(game, p, source, amount) {
  const st = p._ab;
  if (!st || amount <= 0) return amount;
  // (Round 138) Lost in the smoke; skin like iron.
  if (abilityOn(p, 'veil') && source && source !== p && Math.random() < 0.5) {
    game.renderer.floatText(p.x, p.y + 2.2, p.z, 'lost in the smoke', '#c0c0c8');
    return 0;
  }
  if (abilityOn(p, 'ironskin')) {
    const was = amount;
    amount = Math.max(1, Math.round(amount * 0.67));
    if (amount < was) emit(game, p.x, p.y + 1, p.z, { n: 4, color: ['#c4ccd8', '#ffffff'], up: 20, speed: 40, life: 0.25, glow: true });
  }
  if (abilityOn(p, 'aegis') && st.shield > 0) {
    const s = Math.min(st.shield, amount);
    st.shield -= s;
    amount -= s;
    fx(game, { type: 'dome', wx: p.x, wy: p.y, wz: p.z, color: ['#80c8ff', '#ffffff'], life: 0.35, oy: 4 });
    game.renderer.floatText(p.x, p.y + 2.2, p.z, amount > 0 ? `-${s} aegis` : 'absorbed', '#80c8ff');
    game.audio?.play('parry', p);
    if (st.shield <= 0) {
      delete st.on.aegis;
      syncOn(p, st);
      emit(game, p.x, p.y + 1, p.z, { n: 16, color: ['#80c8ff', '#ffffff'], up: 30, speed: 70, life: 0.5, shape: 'shard', gravity: 120 });
    }
  }
  if (amount >= p.hp && p.hp > 1 && st.deathCd <= st.t && armedOf(p).some((e) => e.t === 'deathblow')) {
    st.deathCd = st.t + 300;
    amount = p.hp - 1;
    game.renderer.floatText(p.x, p.y + 2.8, p.z, 'undying!', '#ffe070');
    fx(game, { type: 'pillar', wx: p.x, wy: p.y, wz: p.z, color: ['#ffe070'], life: 0.7, oy: 4, w: 5 });
    fireTrigger(game, p, 'deathblow', { source });
  }
  return amount;
}

// How much harder `p`'s blows land just now (in a bloodrage).
export function abOutgoing(p, amount) {
  return abilityOn(p, 'rage') ? Math.round(amount * 1.5) : amount;
}

// A telling blow owed (out of a shadow step): true once, then spent.
export function takeAbCrit(p) {
  const st = p && p._ab;
  if (!st || !(st.critT > st.t)) return false;
  st.critT = 0;
  return true;
}

// A blow landed (`amount`) on `target` by `source`; `full`: was it unhurt
// before it. Each that's a trigger, on either.
export function abBlow(game, target, source, amount, crit = false, full = false) {
  if (amount <= 0) return;
  if (target.kind === 'player' && !target.dead) {
    const st = abState(target);
    st.combo = 0;
    if (source && source !== target && !st.firing) {
      // (Thorns, on whoever struck.)
      if (abilityOn(target, 'bramble') && source.kind !== 'player' && !source.dead) {
        fx(game, { type: 'beam', wx: target.x, wy: target.y + 0.5, wz: target.z, tx: source.x, ty: source.y + 0.6, tz: source.z, life: 0.35, oy: -6, color: '#90d060', halo: '#2e6a2a', width: 2 });
        quiet(game, target, () => {
          hurt(game, source, 3 * (st.pow.bramble || 1), target);
          bleed(game, source, target, 1);
        });
      }
      if (armedOf(target).length) {
        fireTrigger(game, target, 'struck', { source });
        if (foesNear(game, target, 4).length >= 3) fireTrigger(game, target, 'mob', { source });
        // (Round 138) From afar; from behind.
        if (Math.hypot(source.x - target.x, source.z - target.z) >= 3) fireTrigger(game, target, 'shotat', { source });
        const [fx0, fz0] = DIRS[target.dir] || [0, 1];
        if ((source.x - target.x) * fx0 + (source.z - target.z) * fz0 < 0) fireTrigger(game, target, 'back', { source });
      }
    }
    const max = target.maxHp || 1;
    const was = target.hp + amount;
    if (was >= max / 2 && target.hp < max / 2 && target.hp > 0) fireTrigger(game, target, 'bloodied', { source });
    if (was >= max / 5 && target.hp < max / 5 && target.hp > 0) fireTrigger(game, target, 'brink', { source });
  }
  if (source && source.kind === 'player' && source !== target && target.kind !== 'player' && !source.dead) {
    const st = abState(source);
    if (st.firing) return;
    if (abilityOn(source, 'pact') && source.hp < source.maxHp && !((st.pactT || 0) > st.t)) {
      st.pactT = st.t + 0.4;
      mend(game, source, 1);
      fx(game, { type: 'siphon', wx: target.x, wy: target.y + 0.8, wz: target.z, tx: source.x, ty: source.y + 0.8, tz: source.z, life: 0.5, oy: -8, n: 8, color: ['#c82830', '#ff6858'], amp: 3 });
    }
    if (!armedOf(source).length) return;
    const ctx = { target };
    fireTrigger(game, source, 'hit', ctx);
    if (crit) fireTrigger(game, source, 'crit', ctx);
    if (full) fireTrigger(game, source, 'first', ctx);
    if (target.isBoss || target.S?.boss) fireTrigger(game, source, 'boss', ctx);
    // (Round 138) One of the dead; an unhurt foe felled at a blow; a blood
    // pact's mending.
    if (target.S?.undead) fireTrigger(game, source, 'undead', ctx);
    if (full && target.hp <= 0) fireTrigger(game, source, 'oneshot', ctx);
    const held = source.heldDef ? source.heldDef() : null;
    if (held && held.ranged && Math.hypot(target.x - source.x, target.z - source.z) >= 8) fireTrigger(game, source, 'shot', ctx);
    if (!held || !held.ranged) {
      if (st.t - st.comboT > 8) st.combo = 0;
      if (!st.combo) st.comboT = st.t;
      if (++st.combo >= 5) {
        st.combo = 0;
        fireTrigger(game, source, 'combo', ctx);
      }
    }
  }
}

// Something brought down by `p`.
export function abKill(game, p, e) {
  if (!p || p.kind !== 'player' || !e || e.kind === 'player' || e.kind === 'item') return;
  const st = abState(p);
  if (st.firing || !armedOf(p).length) return;
  fireTrigger(game, p, 'kill', { target: e });
  // (Round 138) The last of them.
  if (!foesNear(game, p, 10).some((q) => q !== e)) fireTrigger(game, p, 'victory', { target: e });
  st.kills = st.kills.filter((t) => st.t - t <= 12);
  st.kills.push(st.t);
  if (st.kills.length >= 3) {
    st.kills = [];
    fireTrigger(game, p, 'streak', { target: e });
  }
}

// ------------------------------------------------------------ each moment
// The clock, what's working on `p` (a healing ring, blades circling, a
// cloud of rot), what's still to come, and the triggers that are watched
// for rather than told of (night falling, going down into an old place,
// into water, your breath running out, being mended, an ailment taking
// you).
export function tickAbilities(game, p, dt) {
  if (!game || !p || p.kind !== 'player') return;
  const st = abState(p);
  st.t += dt;
  const armed = armedOf(p);
  if (!armed.length && !st.q.length && !st.zones.length && !st.seek.length && !p.abOn) {
    // (Nothing to set off: only kept up to date.)
    st.hp = p.hp;
    st.sta = p.stamina;
    st.night = null;
    st.deep = null;
    st.rain = null;
    return;
  }
  if (p.dead) return;
  // What's watched for.
  if (armed.length) {
    const night = game.isDay ? !game.isDay() : false;
    if (st.night === false && night) fireTrigger(game, p, 'dusk', {});
    if (st.night === true && !night) fireTrigger(game, p, 'dawn', {});
    st.night = night;
    const rain = raining(game);
    if (st.rain === false && rain) fireTrigger(game, p, 'rain', {});
    st.rain = rain;
    const deep = !!game.dungeon;
    if (st.deep === false && deep) fireTrigger(game, p, 'delve', {});
    st.deep = deep;
    const wet = !!p.inWater;
    if (wet && !st.wet && st.wetT <= st.t) {
      st.wetT = st.t + 20;
      fireTrigger(game, p, 'soak', {});
    }
    st.wet = wet;
    const sta = p.stamina ?? 10;
    if (sta <= 0.05 && (st.sta ?? 10) > 0.5) fireTrigger(game, p, 'winded', {});
    st.sta = sta;
    if (p.hp - (st.hp ?? p.hp) >= 3) fireTrigger(game, p, 'mend', {});
    const aff = (p.burnT > 0 ? 1 : 0) | (p.poisonT > 0 ? 2 : 0) | (p.frozenT > 0 ? 4 : 0) | (p.bleedT > 0 ? 8 : 0);
    if (aff & ~st.aff) fireTrigger(game, p, 'afflicted', {});
    st.aff = aff;
  }
  st.hp = p.hp;
  // What's still to come.
  if (st.q.length) {
    const due = st.q.filter((q) => q.at <= st.t);
    if (due.length) {
      st.q = st.q.filter((q) => q.at > st.t);
      for (const q of due) {
        try {
          q.fn();
        } catch {
          // (Whatever it was meant for, gone.)
        }
      }
    }
  }
  // What's working on them.
  if (p.abOn) {
    if (abilityOn(p, 'halo')) {
      st.haloT -= dt;
      if (st.haloT <= 0) {
        st.haloT = 1;
        const n = Math.max(1, Math.round(st.pow.halo || 1));
        for (const e of game.everyone ? game.everyone() : [p]) if (!e.dead && cheb(e, p.x, p.z) <= 3 && e.hp < e.maxHp) mend(game, e, n);
      }
    }
    if (abilityOn(p, 'blades')) {
      st.bladeT -= dt;
      if (st.bladeT <= 0) {
        st.bladeT = 0.3;
        quiet(game, p, () => {
          for (const e of foesNear(game, p, 1)) {
            if ((st.hitT[e.id] || 0) > st.t) continue;
            st.hitT[e.id] = st.t + 0.6;
            emit(game, e.x, e.y + 1, e.z, { n: 6, color: ['#ffffff', '#c0d0ff'], up: 20, speed: 50, life: 0.3, glow: true });
            game.audio?.play('swing', e);
            hurt(game, e, 2 * (st.pow.blades || 1), p);
          }
        });
      }
    }
    // (Its time up: gone. And anything drawn on them that isn't working,
    // from before a load, say: gone too.)
    for (const k of Object.keys(st.on)) {
      if (st.on[k] <= st.t) {
        delete st.on[k];
        if (k === 'aegis') st.shield = 0;
      }
    }
    syncOn(p, st);
  }
  // A cloud of rot, hanging where it was called.
  if (st.zones.length) {
    st.zoneT -= dt;
    if (st.zoneT <= 0) {
      st.zoneT = 0.5;
      st.zones = st.zones.filter((z) => z.until > st.t);
      for (const z of st.zones) {
        // (Round 138) A wall of fire: whatever's on it, burning.
        if (z.k === 'fire') {
          const [cx, cz] = z.tiles[2];
          quiet(game, p, () => {
            for (const e of foesNear(game, p, 16, cx, cz)) {
              if (!z.tiles.some(([tx, tz]) => cheb(e, tx, tz) === 0)) continue;
              burn(game, e, p, 2);
              hurt(game, e, z.pow || 1, p);
            }
          });
          continue;
        }
        for (const e of foesNear(game, p, 14, z.x, z.z)) {
          if (cheb(e, z.x, z.z) > 2) continue;
          e.poisonT = Math.max(e.poisonT || 0, 3);
          e.poisonSrc = p;
        }
      }
    }
  }
  // Ore glowing through the rock.
  if (st.seek.length) {
    st.seekT -= dt;
    if (st.seekT <= 0) {
      st.seekT = 0.4;
      st.seek = st.seek.filter((q) => q.until > st.t);
      for (const q of st.seek) emit(game, q.x, q.y + 0.6, q.z, { n: 2, color: ['#80f0ff', '#ffffff', '#c0fff8'], up: 8, speed: 10, life: 0.6, gravity: -4, shape: 'star', glow: true });
    }
  }
}

// Swings quicker, quickened.
export function abSwingMult(p) {
  return abilityOn(p, 'quicken') ? 0.75 : 1;
}
