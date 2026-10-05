// What a dish makes happen (round 53): its triggers, and its acts. A dish
// with a trigger (each time you break a block, are struck, land a blow...)
// has its effects come on for a few seconds each time (see condHolds in
// cooking.js), and its acts happen then; one without, now and then while
// it works (and its condition holds). What each is, and how it reads: see
// TRIGS and ACTS in world/dishes.js.
import { ACTS, TRIG_SECS } from '../world/dishes.js';
import { dishBuffs, condHolds } from './cooking.js';
import { burn, chill, stun, mend, freeze, knockBack, bleed } from './gems.js';
import { groundFire } from '../entities/monsters.js';
import { B } from '../world/blocks.js';
import { asSeat } from './party.js';

const BOLT = ['#fff8a0', '#ffe040', '#ffffff'];
const FIRE = ['#ff6030', '#ffb040', '#fff0a0'];
const FROST = ['#a0d8ff', '#e0f4ff', '#60a0ff'];
const STICKY = ['#e8d8a0', '#f8f0c8', '#c8b070'];
const VINE = ['#4a9a40', '#78c860', '#2e6a2a'];
const STINK = ['#a0c060', '#c8d880', '#7a9a40'];
const FLOWERS = ['flower_red', 'flower_yellow', 'flower_blue', 'flower_white', 'flower_purple'];

// Each player's own clock for this, in seconds (it runs while they play).
export const clockOf = (p) => p.dishClock || 0;
const cheb = (a, x, z) => Math.max(Math.abs(a.x - x), Math.abs(a.z - z));

// As that player (with others playing, the one it's happening to).
function asP(game, p, fn) {
  if (game.seats && p.seat && p !== game.player) return asSeat(game, p.seat, () => fn());
  return fn();
}

// Who's fighting `p` (beasts after them, the night's things, those come to
// blows with them), nearest first.
export function foesNear(game, p, r, x = p.x, z = p.z) {
  const out = [];
  const hostile = (e) => {
    if (!e || e.dead || e.down || e === p) return false;
    if (e.kind === 'creature') return !!(e.hostileNow || e.target === p);
    if (e.kind === 'monster') return true;
    if (e.kind === 'npc') return (e.state === 'fight' && e.threat === p) || !!(e.warband && e.warband.foe && e.hostileNow);
    return false;
  };
  for (const e of game.npcs || []) if (hostile(e) && cheb(e, x, z) <= r && Math.abs(e.y - p.y) <= 3) out.push(e);
  for (const e of game.creatures || []) if (hostile(e) && cheb(e, x, z) <= r && Math.abs(e.y - p.y) <= 3) out.push(e);
  return out.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
}

// The one it's aimed at: whoever's in it (the one who struck you, the one
// you struck) if still about and near enough, or the nearest foe.
function foeFor(game, p, r, ctx) {
  const f = ctx.source && ctx.source !== p ? ctx.source : ctx.target;
  if (f && !f.dead && !f.down && f.kind !== 'player' && f.kind !== 'item' && cheb(f, p.x, p.z) <= r && (f.kind !== 'npc' || foesNear(game, p, r).includes(f))) return f;
  return foesNear(game, p, r)[0] || null;
}

// Lightning out of the sky onto `x, z` (`e`, if it's someone).
function skyBolt(game, x, y, z) {
  const r = game.renderer;
  r.effect?.({ type: 'bolt', from: 'sky', wx: x, wy: y, wz: z, tx: x, ty: y, tz: z, life: 0.45, oy: -4 });
  r.emit(x, y + 0.3, z, { n: 16, color: [...BOLT, '#c8e0ff'], up: 50, speed: 60, gravity: 140, life: 0.6, glow: true });
  r.flashScreen?.('#e8f0ff', 0.12);
  game.audio?.play('thunder', { x, z });
  game.shake = Math.min(1.2, (game.shake || 0) + 0.2);
}

function blastFx(game, x, y, z, big = 1) {
  const r = game.renderer;
  r.effect?.({ type: 'blast', wx: x, wy: y, wz: z, r1: 18 * big, life: 0.5, oy: 2 });
  r.effect?.({ type: 'ring', wx: x, wy: y, wz: z, r0: 4, r1: 22 * big, color: ['#ffe070', '#ff9030'], life: 0.4, oy: 4, flat: 0.5, thick: 2 });
  r.emit(x, y + 1, z, { n: 14, color: ['#ff9030', '#ffe070', '#5a5048'], up: 40, speed: 70, gravity: 120, life: 0.7 });
  r.emit(x, y + 0.5, z, { n: 5, color: ['#6a6058', '#4a4440'], up: 16, speed: 24, life: 1, shape: 'puff', grow: 2 });
  game.audio?.play('boom', { x, z });
  game.shake = Math.min(1.4, (game.shake || 0) + 0.4 * big);
}

function ring(game, at, color, r1 = 20, thick = 2) {
  game.renderer.effect?.({ type: 'ring', wx: at.x, wy: at.y, wz: at.z, r0: 3, r1, color, life: 0.45, oy: 3, flat: 0.5, thick });
}

function say(game, p, text, color) {
  game.renderer.floatText(p.x, p.y + 2.5, p.z, text, color);
}

// A few paces from where `p` stands, by the ground's own way (no walking
// through walls): toward [dx, dz], `n` paces at most. Where they'd land.
function pacesFrom(game, p, dx, dz, n) {
  let x = p.x;
  let y = p.y;
  let z = p.z;
  for (let i = 0; i < n; i++) {
    const ny = game.world.stepTarget(x, y, z, x + dx, z + dz, false);
    if (ny < 0 || (game.occupiedBySolid && game.occupiedBySolid(x + dx, ny, z + dz, p))) break;
    x += dx;
    z += dz;
    y = ny;
  }
  return x === p.x && z === p.z ? null : { x, y, z };
}

function hop(game, p, at) {
  const r = game.renderer;
  r.emit(p.x, p.y + 1, p.z, { n: 10, color: ['#c8a0ff', '#e0d0ff', '#ffffff'], up: 20, speed: 30, life: 0.5, glow: true, shape: 'star' });
  asP(game, p, () => game.teleportPlayer(at.x, at.y, at.z));
  r.emit(at.x, at.y + 1, at.z, { n: 10, color: ['#c8a0ff', '#e0d0ff', '#ffffff'], up: 20, speed: 30, life: 0.5, glow: true, shape: 'star' });
  game.audio?.play('whoosh', p);
}

// A stretch of something on you that comes and goes of itself (a burst of
// speed, heavy legs): `k` (an effect of FX's) by `n`, for `secs`.
function temp(p, k, n, secs) {
  (p.dishTemp ||= {})[k] = { n, until: clockOf(p) + secs };
  p._dishFx = null;
}

// ------------------------------------------------------------ the acts
// Each: (game, p, ctx) => true if it happened. `ctx`: { trigger, source
// (who struck you), target (who you struck), at (a block, where) }.
export const DO = {
  bolt(game, p, ctx) {
    const f = foeFor(game, p, 8, ctx);
    if (!f) return false;
    skyBolt(game, f.x, f.y, f.z);
    game.damage(f, 5, p);
    stun(f, 1);
    return true;
  },
  blast(game, p, ctx) {
    const at = ctx.at || p;
    const foes = foesNear(game, p, 2, at.x, at.z);
    if (!foes.length && !ctx.trigger) return false;
    blastFx(game, at.x, at.y ?? p.y, at.z, 0.8);
    for (const e of foes) {
      game.damage(e, 4, p);
      knockBack(game, at, e, 2);
    }
    return true;
  },
  flame(game, p, ctx) {
    const f = foeFor(game, p, 6, ctx);
    if (!f) return false;
    const r = game.renderer;
    r.effect?.({ type: 'blast', wx: f.x, wy: f.y, wz: f.z, r1: 16, life: 0.5, oy: 2 });
    r.emit(f.x, f.y + 1, f.z, { n: 14, color: FIRE, up: 40, speed: 40, life: 0.6, glow: true });
    game.audio?.play('crackle', f);
    game.damage(f, 2, p);
    burn(game, f, p, 4);
    // (And the ground about them alight, out where nobody lives.)
    const town = game.world.ow.settlementAt && game.world.ow.settlementAt(f.x, f.z);
    if (!town) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (Math.random() < 0.5) groundFire(game, f.x + dx, f.z + dz, f.y, p);
    }
    return true;
  },
  heart(game, p) {
    if (p.hp >= p.maxHp) return false;
    const before = p.hp;
    mend(game, p, 2);
    say(game, p, `+${p.hp - before} ♥`, '#80f0a0');
    return true;
  },
  frost(game, p, ctx) {
    const foes = foesNear(game, p, 3);
    if (!foes.length && !ctx.trigger) return false;
    ring(game, p, FROST, 26);
    game.renderer.emit(p.x, p.y + 1, p.z, { n: 12, color: FROST, up: 18, speed: 50, life: 0.6, shape: 'star', gravity: 20 });
    game.audio?.play('freeze', p);
    foes.forEach((e, i) => (i === 0 ? freeze(game, e, 1.5) : chill(e, 3)));
    return true;
  },
  gust(game, p, ctx) {
    const near = [...foesNear(game, p, 3), ...(game.creatures || []).filter((c) => !c.dead && !c.hostileNow && cheb(c, p.x, p.z) <= 2)];
    if (!foesNear(game, p, 3).length && !ctx.trigger) return false;
    ring(game, p, ['#e8f0f0', '#c8d8d8', '#ffffff'], 30, 1);
    game.renderer.emit(p.x, p.y + 1, p.z, { n: 12, color: ['#a8c890', '#c8d8a0', '#e8f0e0'], up: 10, speed: 70, life: 0.6, shape: 'puff' });
    game.audio?.play('whoosh', p);
    for (const e of new Set(near)) {
      knockBack(game, p, e, 2);
      if (foesNear(game, p, 4).includes(e)) stun(e, 0.5);
    }
    return true;
  },
  quake(game, p, ctx) {
    const foes = foesNear(game, p, 4);
    if (!foes.length && !ctx.trigger) return false;
    ring(game, p, ['#a89878', '#8a7a5a', '#d8c8a0'], 34, 2);
    for (let i = 0; i < 10; i++) game.renderer.emit(p.x + (Math.random() - 0.5) * 7, p.y, p.z + (Math.random() - 0.5) * 7, { n: 2, color: ['#a89878', '#8a7a5a'], up: 14, speed: 20, life: 0.5, shape: 'puff' });
    game.shake = Math.min(1.4, (game.shake || 0) + 0.7);
    game.audio?.play('crumble', p);
    for (const e of foes) {
      game.damage(e, 2, p);
      stun(e, 1.5);
    }
    return true;
  },
  snare(game, p, ctx) {
    const foes = foesNear(game, p, 4);
    if (!foes.length && !ctx.trigger) return false;
    for (const e of foes) {
      game.renderer.effect?.({ type: 'beam', wx: p.x, wy: p.y + 0.6, wz: p.z, tx: e.x, ty: e.y + 0.6, tz: e.z, life: 0.5, oy: -6, color: '#f8f0c8', halo: '#c8b070', width: 1 });
      game.renderer.emit(e.x, e.y + 0.6, e.z, { n: 6, color: STICKY, up: 6, speed: 14, life: 0.8, gravity: 40 });
      chill(e, 4);
      stun(e, 1);
    }
    game.audio?.play('splash', p);
    return true;
  },
  flash(game, p, ctx) {
    const foes = foesNear(game, p, 5);
    if (!foes.length && !ctx.trigger) return false;
    game.renderer.flashScreen?.('#ffffff', 0.18);
    game.renderer.emit(p.x, p.y + 1.2, p.z, { n: 16, color: ['#ffffff', '#fff8c0', '#c0fff0'], up: 30, speed: 60, life: 0.5, glow: true, shape: 'star' });
    game.audio?.play('chime', p);
    for (const e of foes) {
      stun(e, 2);
      game.renderer.floatText(e.x, e.y + 2.2, e.z, 'dazzled', '#fff8c0');
    }
    return true;
  },
  thorns(game, p, ctx) {
    const f = foeFor(game, p, 4, ctx);
    if (!f) return false;
    game.renderer.effect?.({ type: 'beam', wx: p.x, wy: p.y + 0.5, wz: p.z, tx: f.x, ty: f.y + 0.6, tz: f.z, life: 0.4, oy: -6, color: '#78c860', halo: '#2e6a2a', width: 2 });
    game.renderer.emit(f.x, f.y + 0.8, f.z, { n: 8, color: VINE, up: 16, speed: 30, life: 0.5 });
    game.damage(f, 3, p);
    bleed(game, f, p, 1);
    return true;
  },
  blink(game, p) {
    const [dx, dz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.dir] || [0, 1];
    const at = pacesFrom(game, p, dx, dz, 5);
    if (!at) return false;
    hop(game, p, at);
    return true;
  },
  wind(game, p, ctx) {
    const full = p.maxStamina || 10;
    if (!ctx.trigger && (p.stamina ?? full) > full * 0.5) return false;
    p.stamina = full;
    ring(game, p, ['#e8d060', '#fff0a0'], 18, 1);
    say(game, p, 'second wind!', '#ffe070');
    return true;
  },
  bloom(game, p, ctx) {
    const near = [...(game.everyone ? game.everyone() : [p]), ...(game.npcs || []).filter((n) => !n.dead && !(n.warband && n.warband.foe) && n.state !== 'fight')].filter((e) => !e.dead && cheb(e, p.x, p.z) <= 3);
    const hurt = near.filter((e) => e.hp < e.maxHp);
    if (!hurt.length && !ctx.trigger) return false;
    for (const e of hurt) mend(game, e, 1);
    game.renderer.emit(p.x, p.y + 0.5, p.z, { n: 18, color: ['#ff7090', '#ffe070', '#a0c8ff', '#ffffff', '#c890ff'], up: 14, speed: 30, life: 1.1, gravity: 10, shape: 'star' });
    game.audio?.play('chime', p);
    // (Out in the wilds, flowers come up out of the grass about you.)
    const w = game.world;
    const town = w.ow.settlementAt && w.ow.settlementAt(p.x, p.z);
    if (!town && !game.dungeon) {
      let n = 0;
      for (let i = 0; i < 12 && n < 3; i++) {
        const x = p.x + Math.round((Math.random() - 0.5) * 6);
        const z = p.z + Math.round((Math.random() - 0.5) * 6);
        if (w.getBlock(x, p.y - 1, z) !== B.grass || w.getBlock(x, p.y, z) !== B.air) continue;
        const k = FLOWERS[Math.floor(Math.random() * FLOWERS.length)];
        if (B[k] === undefined) continue;
        game.sim.setBlocks ? game.sim.setBlocks([[x, p.y, z, B[k], 0]]) : w.setBlock(x, p.y, z, B[k]);
        n++;
      }
    }
    return true;
  },
  fishrain(game, p) {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const x = p.x + Math.round((Math.random() - 0.5) * 4);
      const z = p.z + Math.round((Math.random() - 0.5) * 4);
      const d = game.spawnDrop('fish', 1, x, p.y + 4, z, false, { x: 0, y: -2, z: 0 }, 0.6);
      if (d) game.renderer.emit(x, p.y + 4, z, { n: 3, color: ['#a0c8e0', '#ffffff'], shape: 'drop', up: -10, speed: 6, gravity: 160, life: 0.6 });
    }
    say(game, p, 'it\'s raining fish!', '#a0d8ff');
    game.audio?.play('splash', p);
    return true;
  },
  tempest(game, p, ctx) {
    if (!foesNear(game, p, 8).length && !ctx.trigger) return false;
    callStorm(game, p, 4);
    p.dishTempest = clockOf(p) + 30;
    p.dishTempestT = 1;
    return true;
  },
  ward(game, p) {
    p.dishWard = clockOf(p) + 20;
    ring(game, p, ['#c0e8ff', '#ffffff', '#80c0ff'], 16, 1);
    say(game, p, 'warded', '#c0e8ff');
    game.audio?.play('chime', p);
    return true;
  },
  dash(game, p) {
    temp(p, 'speed', 0.4, 5);
    game.renderer.emit(p.x, p.y + 0.4, p.z, { n: 8, color: ['#ffe070', '#ffffff'], up: 6, speed: 30, life: 0.4, shape: 'puff' });
    say(game, p, 'quick!', '#ffe070');
    return true;
  },
  // ---------------------------------------------------------- the bad
  zap(game, p) {
    skyBolt(game, p.x, p.y, p.z);
    game.damage(p, 3, null);
    stun(p, 0.5);
    say(game, p, 'zapped!', '#fff8a0');
    return true;
  },
  boom(game, p) {
    blastFx(game, p.x, p.y, p.z, 0.7);
    game.damage(p, 2, null);
    for (const e of foesNear(game, p, 2)) {
      game.damage(e, 2, null);
      knockBack(game, p, e, 2);
    }
    say(game, p, 'BANG', '#ffb040');
    return true;
  },
  burn(game, p) {
    burn(game, p, null, 3);
    game.renderer.emit(p.x, p.y + 1, p.z, { n: 12, color: FIRE, up: 30, speed: 20, life: 0.6, glow: true });
    game.audio?.play('crackle', p);
    say(game, p, 'on fire!', '#ff9040');
    return true;
  },
  chill(game, p) {
    freeze(game, p, 1.5);
    return true;
  },
  sheep(game, p) {
    p.sheepT = 15;
    p.baaT = 1.5;
    temp(p, 'speed', -0.15, 15);
    game.renderer.emit(p.x, p.y + 1, p.z, { n: 16, color: ['#ffffff', '#f0ece0', '#d8d0c0'], up: 16, speed: 30, life: 0.8, shape: 'puff', grow: 1.5 });
    game.audio?.play('whoosh', p);
    asP(game, p, () => {
      game.mining = null;
      game.charging = null;
      game.ui.msg('You\'ve turned into a sheep! (It\'ll wear off.)', '#f0e8d0');
    });
    say(game, p, 'Baa!', '#ffffff');
    return true;
  },
  stumble(game, p) {
    p.stamina = 0;
    stun(p, 0.6);
    say(game, p, 'oof!', '#ffb080');
    game.renderer.emit(p.x, p.y + 0.2, p.z, { n: 6, color: ['#a89878', '#8a7a5a'], up: 8, speed: 20, life: 0.5, shape: 'puff' });
    return true;
  },
  stuck(game, p) {
    p.rootT = 2.5;
    game.renderer.emit(p.x, p.y + 0.2, p.z, { n: 10, color: STICKY, up: 4, speed: 10, life: 1, gravity: 30 });
    say(game, p, 'stuck!', '#e8d8a0');
    return true;
  },
  hiccup(game, p) {
    p.hiccups = 4;
    p.hiccupT = 0.5;
    return true;
  },
  sneeze(game, p) {
    say(game, p, 'ACHOO!', '#ffffff');
    game.renderer.emit(p.x, p.y + 1.5, p.z, { n: 8, color: ['#ffffff', '#e8f0f0'], up: 4, speed: 40, life: 0.4, shape: 'drop' });
    const s = p.inv[p.selected];
    if (!s) return true;
    asP(game, p, () => {
      const [dx, dz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.dir] || [0, 1];
      const item = s.item;
      s.count--;
      if (s.count <= 0) p.inv[p.selected] = null;
      game.tossItem(item, 1, dx, dz);
      game.mining = null;
      game.ui.msg('You sneeze and drop what you were holding.', '#c8c8c8', true);
    });
    return true;
  },
  stink(game, p) {
    game.renderer.emit(p.x, p.y + 1, p.z, { n: 14, color: STINK, up: 10, speed: 16, life: 1.6, shape: 'puff', grow: 1.8, gravity: -6 });
    for (const n of game.npcs || []) {
      if (n.dead || n.sleeping || n.state === 'fight' || cheb(n, p.x, p.z) > 6) continue;
      n.say?.(['Ugh! What IS that?', 'Phew! Stand off!', 'Who let that out?', 'Gods, the smell!'][Math.floor(Math.random() * 4)], 2.5);
      if (n.rec && game.sim && game.sim.changeRep) asP(game, p, () => game.sim.changeRep(n, -1));
    }
    say(game, p, 'pee-yew', '#a0c060');
    return true;
  },
  storm(game, p) {
    callStorm(game, p, 5);
    p.dishStormBad = clockOf(p) + 60;
    p.dishStormT = 6;
    asP(game, p, () => game.ui.msg('The sky darkens over you, and a storm breaks.', '#a0b8d0'));
    return true;
  },
  lurch(game, p) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
    for (const [dx, dz] of dirs) {
      const at = pacesFrom(game, p, dx, dz, 3 + Math.floor(Math.random() * 3));
      if (!at) continue;
      hop(game, p, at);
      say(game, p, 'whoa!', '#c8a0ff');
      return true;
    }
    return false;
  },
  heavy(game, p) {
    temp(p, 'speed', -0.35, 8);
    say(game, p, 'heavy legs', '#c0a060');
    return true;
  },
};

// A storm called down over `p` (for `mins` game minutes): see
// Game.updateWeather.
function callStorm(game, p, mins) {
  const until = game.sim.abs + mins * 60;
  game.dishStorm = { until: Math.max(until, game.dishStorm ? game.dishStorm.until : 0) };
  game.renderer.flashScreen?.('#c8d8ff', 0.1);
  game.audio?.play('thunder', p);
}

// It happens (as `p`, with others playing). True if it did.
export function fireAct(game, p, k, ctx = {}) {
  const fn = DO[k];
  if (!fn || p.dead) return false;
  // (Nothing an act does sets off another: no lightning off lightning.)
  if (p.dishFiring) return false;
  p.dishFiring = true;
  try {
    return !!asP(game, p, () => fn(game, p, ctx));
  } finally {
    p.dishFiring = false;
  }
}

// ------------------------------------------------------------ triggers
// Something `p` did (or had done to them): `kind` one of TRIGS. Each dish
// on them with that trigger comes on for a while, and its acts happen
// (each when it's ready again).
export function dishTrigger(game, p, kind, ctx = {}) {
  if (!p || p.dead || p.dishFiring || !p.buffs || !p.buffs.length) return;
  const now = clockOf(p);
  let any = false;
  for (const q of dishBuffs(p)) {
    const D = q.def.dish;
    if (D.trigger !== kind) continue;
    const st = ((p.dishState ||= {})[q.dish] ||= {});
    st.burst = now + TRIG_SECS;
    any = true;
    for (const e of D.effects) {
      if (!e.act) continue;
      st.cd ||= {};
      if (st.cd[e.k] > now) continue;
      if (fireAct(game, p, e.k, { ...ctx, trigger: kind })) st.cd[e.k] = now + (ACTS[e.k].cd || 8);
    }
  }
  if (any) p._dishFx = null;
}

// ------------------------------------------------------------ each moment
// The clock, acts that come now and then, and what's still going on from
// one (a spell as a sheep, hiccups, a storm's lightning, a ward fading).
export function tickDishActs(game, p, dt) {
  p.dishClock = clockOf(p) + dt;
  const now = p.dishClock;
  // Now and then: the acts of a dish with no trigger.
  if (p.buffs && p.buffs.length && !p.dead) {
    for (const q of dishBuffs(p)) {
      const D = q.def.dish;
      if (D.trigger) continue;
      const acts = D.effects.filter((e) => e.act);
      if (!acts.length) continue;
      const st = ((p.dishState ||= {})[q.dish] ||= {});
      st.next ??= now + 5 + Math.random() * 10;
      if (now < st.next || !condHolds(game, p, D, q.dish)) continue;
      let did = false;
      for (const e of acts) if (fireAct(game, p, e.k, {})) did = true;
      // (Nothing for it to do yet: it waits a moment; done, a good while.
      // The bad ones keep the longer.)
      const bad = acts.every((e) => !e.good);
      // (Each act's own wait counts too: the longest of them.)
      const own = Math.max(...acts.map((e) => ACTS[e.k].cd || 8));
      st.next = now + (did ? Math.max(own, bad ? 40 + Math.random() * 30 : 15 + Math.random() * 15) : 3);
    }
  }
  // As a sheep: bleating, and back to yourself in a puff when it's over.
  if (p.sheepT > 0) {
    p.sheepT -= dt;
    p.baaT = (p.baaT || 0) - dt;
    if (p.baaT <= 0) {
      p.baaT = 3 + Math.random() * 4;
      say(game, p, Math.random() < 0.5 ? 'Baa!' : 'Baaaa...', '#ffffff');
      game.audio?.play('baa', p);
    }
    if (p.sheepT <= 0) {
      p.sheepT = 0;
      game.renderer.emit(p.x, p.y + 1, p.z, { n: 14, color: ['#ffffff', '#f0ece0'], up: 16, speed: 30, life: 0.7, shape: 'puff', grow: 1.5 });
      asP(game, p, () => game.ui.msg('You\'re yourself again.', '#f0e8d0', true));
    }
  }
  if (p.rootT > 0) p.rootT -= dt;
  // Hiccups: a hop and a gasp, a few times over.
  if (p.hiccups > 0) {
    p.hiccupT -= dt;
    if (p.hiccupT <= 0) {
      p.hiccups--;
      p.hiccupT = 2.5 + Math.random() * 2;
      p.hop = 3;
      p.stamina = Math.max(0, (p.stamina || 0) - 1);
      say(game, p, 'hic!', '#ffd0e0');
    }
  }
  if (p.hop > 0) p.hop = Math.max(0, p.hop - dt * 20);
  // A storm you called down on your foes: its lightning, on them.
  if (p.dishTempest > now) {
    p.dishTempestT -= dt;
    if (p.dishTempestT <= 0) {
      p.dishTempestT = 3 + Math.random() * 2;
      const f = foesNear(game, p, 8)[Math.floor(Math.random() * 2)] || foesNear(game, p, 8)[0];
      if (f) {
        p.dishFiring = true;
        try {
          skyBolt(game, f.x, f.y, f.z);
          game.damage(f, 4, p);
        } finally {
          p.dishFiring = false;
        }
      }
    }
  }
  // A storm that came for you: lightning comes down about you, now and
  // then on you.
  if (p.dishStormBad > now) {
    p.dishStormT -= dt;
    if (p.dishStormT <= 0) {
      p.dishStormT = 6 + Math.random() * 7;
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() < 0.25 ? 0 : 3 + Math.random() * 5;
      const x = Math.round(p.x + Math.cos(a) * d);
      const z = Math.round(p.z + Math.sin(a) * d);
      const y = game.world.findStandY ? Math.max(0, game.world.findStandY(x, z, p.y)) : p.y;
      skyBolt(game, x, y, z);
      if (cheb(p, x, z) <= 0) {
        game.damage(p, 2, null);
        say(game, p, 'struck!', '#fff8a0');
      }
    }
  }
  // (A burst of speed, heavy legs: gone when their time's up.)
  if (p.dishTemp) {
    for (const [k, t] of Object.entries(p.dishTemp)) {
      if (t.until <= now) {
        delete p.dishTemp[k];
        p._dishFx = null;
      }
    }
  }
}

// A blow on `p` turned aside by a ward (true if it was).
export function dishWarded(game, p) {
  if (!(p.dishWard > clockOf(p))) return false;
  p.dishWard = 0;
  ring(game, p, ['#c0e8ff', '#ffffff'], 18, 2);
  game.renderer.floatText(p.x, p.y + 2.2, p.z, 'warded!', '#c0e8ff');
  game.audio?.play('parry', p);
  return true;
}

// (The keys a sheep can still press: the camera and the belt. The rest, a
// bleat.)
export function sheepFilter(game, p, pressed) {
  const ok = (c) => c === 'KeyQ' || c === 'KeyE' || c === 'KeyZ' || c === 'KeyX' || c === 'KeyV' || c.startsWith('Digit') || c.startsWith('Arrow') || ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(c);
  const out = pressed.filter((k) => ok(k.code));
  if (out.length < pressed.length && !(p.baaSaid > clockOf(p))) {
    p.baaSaid = clockOf(p) + 1;
    say(game, p, 'Baa!', '#ffffff');
    game.audio?.play('baa', p);
  }
  return out;
}

