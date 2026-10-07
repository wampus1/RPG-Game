// (Round 71) The Hero, in the Hall of the Last Champion (see world/
// ancient.js): the greatest of them, twice the height of a man in his
// battered plate, his red cloak in tatters, his greatsword and his shield,
// and cursed: the thing he killed last cursed him as it died, and the
// curse is in him still, turning his body into its own a piece at a time.
// Every five to eight seconds something of him changes (drawn: see
// render/forge_evolved.js): his chest splits into a mouth; his sword-arm
// becomes a great claw, or a blade of bone; his shield-arm a tentacle; his
// legs a mass of them; his head a cluster of stalked eyes like a bug's;
// dragon's wings tear out of his back. What he can do is what he is just
// now:
//   as himself: the sword in combinations, the shield driven into you, a
//     hero's leap down on you, his war-cry (his old companions come back to
//     him, shades);
//   a mouth in his chest: it draws you in and bites, or it spews;
//   a claw: rending, raking;
//   a blade of bone: whirling, impaling;
//   a tentacle arm: lashed out to take you and drag you in;
//   tentacle legs: tentacles up out of the floor all round him, holding;
//   stalked eyes: their gaze, burning in lines; and a swarm out of him;
//   dragon's wings: a buffet of wind, a dive from above, fire.
// One of his parts goes over at a time while he's whole; two once he's
// worn; three, then four; all of them risen (and quicker).
//   And once, the first time he'd kill one of you, he can't: he fights it,
// the man in him, for a breath (everyone down there sees it), and you roll
// clear. He won't hold back again.
import { BRAINS, addHazard, lineTiles, areaTiles, summon, groundFire, BOSS_TITLES } from './monsters.js';
import { roll } from '../game/combat.js';
import { dist, dmgOf, openFloor, drag, proc, spotIn, coneTiles, ringTiles } from './bosskit.js';
import { evoFight, evoTick, evoPhase, grab, release, preyIn } from './evolved.js';
import { startLaser } from '../game/laser.js';
import { fits } from './footprint.js';
import { cue } from './cue.js';

const later = (c, secs, fn) => proc(c.game, c, 1, 1, fn, secs);
const say = (c, line, col = '#ffe0a0') => c.say?.(line, 2.4, col);
const BLOOD = [200, 60, 50];
const STEEL = [220, 220, 230];
const CURSE = [150, 220, 90];

// ------------------------------------------------------------ his parts
// Each slot of him, what it is as himself, and what the curse makes of it.
export const SLOTS = {
  chest: { base: 'plate', curse: ['maw'], words: { maw: 'His breastplate splits, and a MOUTH opens in his chest!' } },
  arm: { base: 'sword', curse: ['claw', 'blade'], words: { claw: 'His sword-arm swells and splits into a great CLAW!', blade: 'His sword-arm hardens into a BLADE of bone!' } },
  off: { base: 'shield', curse: ['tentacle'], words: { tentacle: 'His shield falls away: his arm is a TENTACLE!' } },
  legs: { base: 'legs', curse: ['tentacles'], words: { tentacles: 'His legs come apart into a mass of TENTACLES!' } },
  head: { base: 'helm', curse: ['stalks'], words: { stalks: 'His helm cracks open on a cluster of stalked EYES!' } },
  back: { base: 'none', curse: ['wings'], words: { wings: 'DRAGON\'S WINGS tear out of his back!' } },
};
const SLOT_KEYS = Object.keys(SLOTS);
export const formOf = (c) => (c.form ||= Object.fromEntries(SLOT_KEYS.map((k) => [k, SLOTS[k].base])));
const is = (c, slot, f) => formOf(c)[slot] === f;
const human = (c, slot) => formOf(c)[slot] === SLOTS[slot].base;

// How many of him go over at once, by phase (all of him, risen).
const CURSED = [0, 1, 2, 3, 4, 6];
// The curse moves in him: some parts go back, others turn.
function morph(c, first = false) {
  const game = c.game;
  const F = formOf(c);
  const ph = evoPhase(c);
  const n = Math.min(SLOT_KEYS.length, CURSED[Math.min(ph, 5)] + (c.enraged ? 6 : 0));
  const was = { ...F };
  const now = SLOT_KEYS.filter((k) => F[k] !== SLOTS[k].base);
  // (Something always changes: one of what's turned goes back, or turns
  // to something else, and the rest made up from what's still him.)
  let keep = now.slice().sort(() => Math.random() - 0.5);
  if (!first && keep.length >= n) keep = keep.slice(0, Math.max(0, n - 1));
  const pool = SLOT_KEYS.filter((k) => !keep.includes(k) && !(was[k] !== SLOTS[k].base && Math.random() < 0.6)).sort(() => Math.random() - 0.5);
  const pick = [...keep, ...pool].slice(0, n);
  for (const k of SLOT_KEYS) {
    if (!pick.includes(k)) F[k] = SLOTS[k].base;
    else if (!keep.includes(k)) {
      const opts = SLOTS[k].curse;
      F[k] = opts[Math.floor(Math.random() * opts.length)];
    }
  }
  let told = 0;
  for (const k of SLOT_KEYS) {
    if (F[k] === was[k]) continue;
    const y = k === 'legs' ? 0.8 : k === 'head' ? 5.6 : k === 'back' ? 4.4 : 3.4;
    game.renderer.emit(c.x, c.y + y, c.z, { n: 18, color: F[k] === SLOTS[k].base ? ['#e0e0e8', '#a8a8b8', '#ffffff'] : ['#8ac040', '#5a2a3a', '#c83040', '#e0ff90'], up: 40, speed: 50, life: 0.7, glow: F[k] !== SLOTS[k].base });
    if (F[k] !== SLOTS[k].base && told < 2) {
      const line = SLOTS[k].words[F[k]];
      game.renderer.floatText(c.x, c.y + 5 + told * 0.8, c.z, line.split('!')[0].replace(/^His |^DRAGON'S /, '').toUpperCase(), '#c8ff60');
      if (!(c.toldForms ||= new Set()).has(F[k])) {
        c.toldForms.add(F[k]);
        const run = game.dungeon;
        (run && run.eachHere ? (fn) => run.eachHere(fn) : (fn) => fn())(() => game.ui.msg(line, '#c8ff80'));
      }
      told++;
    }
  }
  game.audio?.play('growl', c);
  game.audio?.play('crumble', c);
  cue(c, 'flex');
  c.morphT = (c.enraged ? 3 : 5) + Math.random() * 3;
}

// ------------------------------------------------------------ his works
const HERO = {
  // His sword, in combinations: three cuts, the last a great one.
  sword(c, t, game) {
    const N = evoPhase(c) >= 3 ? 4 : 3;
    for (let i = 0; i < N; i++) later(c, i * 0.45, () => {
      if (c.dead || !is(c, 'arm', 'sword')) return;
      const tt = c.target && !c.target.dead ? c.target : t;
      c.face(tt.x, tt.z);
      const last = i === N - 1;
      const tiles = last ? lineTiles(game, c, tt, 6).slice(c.foot || 0).flatMap((q) => [q, ...areaTiles(q.x, q.z, 1)]) : coneTiles(c, tt, c.foot + 2, 0.9);
      const uniq = [...new Map(tiles.map((q) => [`${q.x},${q.z}`, q])).values()];
      addHazard(game, { by: c, tiles: uniq, y: c.y, dur: last ? 0.8 : 0.5, dmg: dmgOf(c, last ? 9 : 5), kind: last ? 'slam' : 'burst', knock: last ? 2 : 0, from: { x: c.x, z: c.z }, color: STEEL });
      cue(c, last ? 'smash' : 'strike', tt);
    });
    return true;
  },
  // His shield driven into you, at a run.
  bash(c, t, game) {
    const ang = Math.atan2(t.z - c.z, t.x - c.x);
    const to = { x: Math.round(c.x + Math.cos(ang) * 6), z: Math.round(c.z + Math.sin(ang) * 6) };
    const tiles = lineTiles(game, c, to, 6).slice(c.foot || 0).flatMap((q) => [q, ...areaTiles(q.x, q.z, 1)]);
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.8, dmg: dmgOf(c, 6), kind: 'slam', stun: 0.9, knock: 3, from: { x: c.x, z: c.z }, color: STEEL, onFire: () => charge(c, to, 4) });
    cue(c, 'charge', t);
    say(c, 'For the realm!');
    return true;
  },
  // Up, and down on you.
  leap(c, t, game) {
    const at = spotIn(c, t, 0, 1) || { x: t.x, y: c.y, z: t.z };
    if (!fits(game, c, at.x, c.y, at.z, true)) return false;
    const R = c.foot + 2;
    c.leaping = { t: 0, dur: 1.2, from: { x: c.x, z: c.z }, to: at };
    addHazard(game, { by: c, tiles: areaTiles(at.x, at.z, R, true), y: c.y, dur: 1.2, dmg: dmgOf(c, 10), kind: 'slam', knock: 3, stun: 0.5, from: at, center: at, radius: R, color: [255, 200, 120] });
    cue(c, 'slam');
    say(c, is(c, 'back', 'wings') ? 'FROM ABOVE!' : 'HAAAH!');
    return true;
  },
  // His war-cry: his old companions back to him, shades.
  cry(c, t, game) {
    const n = game.creatures.filter((o) => !o.dead && o.summoner === c).length;
    if (n >= 3) return false;
    for (let i = 0; i < 2; i++) summon(game, 'legion_shade', c, 3, { color: ['#c8d8ff', '#ffffff'], level: c.level });
    for (const o of game.creatures) if (!o.dead && o.summoner === c && !o.leash) o.leash = c.leash;
    const R = c.foot + 2;
    addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, R), y: c.y, dur: 0.9, dmg: dmgOf(c, 3), kind: 'blast', knock: 3, from: c, center: { x: c.x, z: c.z }, radius: R, color: [255, 230, 160] });
    say(c, 'TO ME, MY FRIENDS! ...Friends?');
    cue(c, 'roar');
    return true;
  },
  // The mouth in his chest: it draws you in, and bites.
  devour(c, t, game) {
    proc(game, c, 0.35, 6, () => {
      for (const e of preyIn(c)) if (dist(c, e) <= 8 && dist(c, e) > 0) drag(game, e, c, 1);
    });
    c.inhale = true;
    later(c, 2.1, () => {
      c.inhale = false;
    });
    const tiles = coneTiles(c, t, c.foot + 3, 1.1);
    addHazard(game, { by: c, tiles, y: c.y, dur: 2.2, dmg: dmgOf(c, 12), kind: 'burst', color: BLOOD, onFire: (g, h, hit) => {
      if (hit.some((e) => e.kind === 'player')) {
        c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.02));
        g.renderer.floatText(c.x, c.y + 4, c.z, 'DEVOURED', '#ff6050');
      }
      g.audio?.play('bite', c);
    } });
    game.audio?.play('wind', c);
    cue(c, 'breath', t);
    return true;
  },
  // The mouth spews: a cone of bile.
  spew(c, t, game) {
    const tiles = coneTiles(c, t, 8, 0.5).filter((q) => dist(c, q) > 0);
    addHazard(game, { by: c, tiles, y: c.y, dur: 1, dmg: dmgOf(c, 6), kind: 'acid', color: CURSE, onFire: (g) => {
      g.zones ||= [];
      for (const q of tiles) if (Math.random() < 0.3) g.renderer.emit(q.x, c.y + 0.3, q.z, { n: 2, color: ['#a8c040', '#d8e870'], up: 10, speed: 8, life: 0.8, shape: 'puff' });
    } });
    cue(c, 'breath', t);
    return true;
  },
  // A claw: rending a great arc in front of him.
  rend(c, t, game) {
    const tiles = coneTiles(c, t, c.foot + 4, 1.4);
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.85, dmg: dmgOf(c, 9), kind: 'burst', knock: 2, color: BLOOD });
    cue(c, 'smash', t);
    say(c, 'RRRAAGH!', '#c8ff80');
    return true;
  },
  // Raking: three swipes, lunging on.
  rake(c, t, game) {
    for (let i = 0; i < 3; i++) later(c, i * 0.4, () => {
      if (c.dead || !is(c, 'arm', 'claw')) return;
      const tt = c.target && !c.target.dead ? c.target : t;
      charge(c, tt, 1);
      addHazard(game, { by: c, tiles: coneTiles(c, tt, c.foot + 3, 0.8), y: c.y, dur: 0.45, dmg: dmgOf(c, 5), kind: 'burst', color: BLOOD });
      cue(c, 'strike', tt);
    });
    return true;
  },
  // The bone blade: whirling, twice round.
  whirl(c, t, game) {
    const R = c.foot + 3;
    for (let i = 0; i < 2; i++) later(c, i * 0.7, () => {
      if (c.dead) return;
      addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, R, true).filter((q) => dist(c, q) > 0), y: c.y, dur: 0.65, dmg: dmgOf(c, 6), kind: 'burst', knock: 1, center: { x: c.x, z: c.z }, radius: R, color: [230, 220, 200] });
      cue(c, 'smash');
    });
    return true;
  },
  // Impaled on it: a lunge down a line.
  impale(c, t, game) {
    const ang = Math.atan2(t.z - c.z, t.x - c.x);
    const to = { x: Math.round(c.x + Math.cos(ang) * 8), z: Math.round(c.z + Math.sin(ang) * 8) };
    const tiles = lineTiles(game, c, to, 8).slice(c.foot || 0);
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.75, dmg: dmgOf(c, 9), kind: 'beam', from: tiles[0], to: tiles[tiles.length - 1], beamColor: '#f0e8d8', halo: '#8a2030', width: 2, color: [240, 230, 210], onFire: () => charge(c, to, 3) });
    cue(c, 'charge', t);
    return true;
  },
  // The tentacle arm, lashed out to take you and drag you in.
  lash(c, t, game) {
    const prey = preyIn(c).filter((e) => !e.heldBy && dist(c, e) <= 7);
    const e = prey.includes(t) ? t : prey[0];
    if (!e) return false;
    const at = { x: e.x, z: e.z };
    const tiles = lineTiles(game, c, at, 8).slice(c.foot || 0);
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.85, dmg: dmgOf(c, 4), kind: 'beam', from: tiles[0] || at, to: at, beamColor: '#c8ff80', halo: '#3a5a20', width: 1, color: CURSE, onFire: (g, h, hit) => {
      if (!hit.includes(e) || e.dead) return;
      grab(g, c, e, 1.6);
      proc(g, c, 0.15, 6, () => drag(g, e, c, 1));
      later(c, 1, () => {
        release(g, c, e);
        if (!e.dead && dist(c, e) <= 1) addHazard(g, { by: c, tiles: [{ x: e.x, z: e.z }], y: c.y, dur: 0.4, dmg: dmgOf(c, 7), kind: 'burst', center: { x: e.x, z: e.z }, color: BLOOD });
      });
    } });
    c.lashTo = { x: at.x, z: at.z, t: 0 };
    cue(c, 'throw', at);
    return true;
  },
  // Tentacles up out of the floor all round him, holding what they catch.
  writhe(c, t, game) {
    for (let r = c.foot + 1; r <= c.foot + 4; r++) later(c, (r - c.foot - 1) * 0.25, () => {
      const tiles = ringTiles(c.x, c.z, r).filter((q) => openFloor(game, q.x, q.z) && Math.random() < 0.7);
      addHazard(game, { by: c, tiles, y: c.y, dur: 0.8, dmg: dmgOf(c, 5), kind: 'erupt', color: CURSE, onFire: (g, h, hit) => {
        for (const e of hit) if (e.kind === 'player' && !(e.rollT > 0)) {
          e.grabbedT = Math.max(e.grabbedT || 0, 1.3);
          g.renderer.floatText(e.x, e.y + 2.4, e.z, 'tentacles! (roll free)', '#c8ff80');
        }
      } });
    });
    cue(c, 'slam');
    return true;
  },
  // The stalked eyes' gaze: lines of burning, two of them.
  gaze(c, t, game) {
    if ((game.lasers || []).some((L) => L.by === c)) return false;
    const ang = Math.atan2(t.z - c.z, t.x - c.x);
    for (const s of [-0.5, 0.5]) startLaser(game, { by: c, ang: ang + s, aim: () => (c.target && !c.target.dead ? Math.atan2(c.target.z - c.z, c.target.x - c.x) + s * 0.3 : null), turn: 0.6, len: 12, charge: 0.9, dur: 2.2, dmg: dmgOf(c, 3), tick: 0.3, width: 0.5, fire: false, hue: 'grave' });
    say(c, 'I SEE YOU. I SEE ALL OF YOU.', '#c8ff80');
    return true;
  },
  // A swarm out of him.
  swarm(c, t, game) {
    const n = game.creatures.filter((o) => !o.dead && o.summoner === c).length;
    if (n >= 5) return false;
    for (let i = 0; i < 3; i++) summon(game, 'mite', c, 2, { color: ['#8ac040', '#5a2a3a'], level: c.level });
    for (const o of game.creatures) if (!o.dead && o.summoner === c && !o.leash) o.leash = c.leash;
    cue(c, 'summon');
    return true;
  },
  // The wings: a buffet of wind before him.
  buffet(c, t, game) {
    const tiles = coneTiles(c, t, 7, 0.9).filter((q) => dist(c, q) > 0);
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.8, dmg: dmgOf(c, 4), kind: 'burst', knock: 4, from: { x: c.x, z: c.z }, color: [220, 230, 240] });
    game.audio?.play('flap', c);
    cue(c, 'roar');
    return true;
  },
  // Fire, out of the mouth in his chest or the wings' heat: a cone.
  breath(c, t, game) {
    const tiles = coneTiles(c, t, 9, 0.55).filter((q) => dist(c, q) > 0);
    addHazard(game, { by: c, tiles, y: c.y, dur: 1.1, dmg: dmgOf(c, 8), kind: 'fire', burn: 2.5, color: [255, 140, 40], onFire: (g) => {
      for (const q of tiles) if (Math.random() < 0.35) groundFire(g, q.x, q.z, c.y, c, false, 0);
    } });
    cue(c, 'breath', t);
    return true;
  },
};

// A few paces toward `to`, as it charges.
function charge(c, to, n) {
  const game = c.game;
  for (let i = 0; i < n; i++) {
    const sx = Math.sign(to.x - c.x);
    const sz = Math.sign(to.z - c.z);
    if (!sx && !sz) break;
    if (!fits(game, c, c.x + sx, c.y, c.z + sz, false)) break;
    c.teleport(c.x + sx, c.y, c.z + sz);
  }
}
// In the air (a leap, a dive), and down.
function leapTick(c, dt) {
  const L = c.leaping;
  if (!L) return false;
  L.t += dt;
  c.rise = -Math.round(Math.sin(Math.min(1, L.t / L.dur) * Math.PI) * 40);
  if (L.t >= L.dur * 0.55 && !L.moved) {
    L.moved = true;
    if (fits(c.game, c, L.to.x, c.y, L.to.z, true)) c.teleport(L.to.x, c.y, L.to.z);
  }
  if (L.t >= L.dur) {
    c.leaping = null;
    c.rise = 0;
    c.game.shake = Math.min(1.5, (c.game.shake || 0) + 0.8);
  }
  return true;
}

// ------------------------------------------------------------ his mercy
// The first time he'd kill one of you, the man in him won't: he fights the
// curse a breath (everyone down here sees it), and you roll clear.
function mercy(game, c, p) {
  if (c.mercyDone || c.dead) return false;
  c.mercyDone = true;
  p.hp = 1;
  p.mercyT = 2.4;
  c.stunT = 2.6;
  c.windup = null;
  for (const L of game.lasers || []) if (L.by === c) L.t = L.charge + L.dur;
  game.hazards = (game.hazards || []).filter((h) => h.by !== c);
  release(game, c, p);
  say(c, 'No... NO! Not again! I won\'t! RUN!', '#ffffff');
  game.audio?.play('sting');
  game.renderer.flashScreen?.('#ffffff', 0.4);
  // You, out of it: a roll clear, away from him.
  const sx = Math.sign(p.x - c.x) || 1;
  const sz = Math.sign(p.z - c.z);
  p.rollCd = 0;
  p.swing = null;
  p.commitT = 0;
  p.grabbedT = 0;
  p.stamina = Math.max(p.stamina ?? 0, 4);
  game.asPlayer?.(p, () => roll(game, p, Math.abs(p.x - c.x) >= Math.abs(p.z - c.z) ? [sx, 0] : [0, sz || 1]));
  const run = game.dungeon;
  const each = run && run.eachHere ? (fn) => run.eachHere(fn) : (fn) => fn();
  each((q) => {
    game.ui.msg(q === p ? 'His blade stops a finger from your throat. Something human looks out of his eyes, and he roars at you to RUN.' : `His blade stops a finger from ${p.account?.name || 'their'} throat... something human in his eyes, fighting the curse.`, '#ffe8c0', true);
    if (!game.scene) game.scene = mercyScene(game, c, p);
  });
  return true;
}
function mercyScene(game, c, p) {
  const ease = (k) => k * k * (3 - 2 * k);
  const cl = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
  return {
    kind: 'hero_mercy', t: 0, dur: 3, lock: true,
    timeScale(t) {
      return t < 1.6 ? 0.3 : 1;
    },
    get zoom() {
      return 1 - 0.3 * ease(cl(this.t / 0.5)) * (1 - ease(cl((this.t - 2.3) / 0.7)));
    },
    focus() {
      const k = ease(cl(this.t / 0.4)) * (1 - ease(cl((this.t - 2.3) / 0.7)));
      const a = p.renderPos ? p.renderPos() : p;
      const b = c.renderPos ? c.renderPos() : c;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
      return { x: a.x + (m.x - a.x) * k, y: a.y + (m.y - a.y) * k, z: a.z + (m.z - a.z) * k };
    },
    update(g) {
      if (Math.random() < 0.5) g.renderer.emit(c.x, c.y + 5, c.z, { n: 1, color: ['#ffffff', '#ffe8c0'], up: 20, speed: 20, life: 0.8, glow: true });
    },
    draw(ctx) {
      const W = ctx.canvas.width;
      const H = ctx.canvas.height;
      const k = Math.min(1, this.t / 0.3) * Math.min(1, (this.dur - this.t) / 0.5);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, Math.round(H * 0.12 * k));
      ctx.fillRect(0, H - Math.round(H * 0.12 * k), W, Math.round(H * 0.12 * k));
      // (Everything else dimmed but the two of them.)
      ctx.globalAlpha = 0.25 * k;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    },
  };
}

// ------------------------------------------------------------ the fight
const arm = (f) => (c) => is(c, 'arm', f);
const WORKS = [
  ['leapCd', 6, 10, HERO.leap, { min: 3, rest: 0.8 }],
  ['devourCd', 4, 9, HERO.devour, { when: (c) => is(c, 'chest', 'maw'), max: 8, rest: 1 }],
  ['spewCd', 3, 7, HERO.spew, { when: (c) => is(c, 'chest', 'maw'), max: 8 }],
  ['diveCd', 3, 8, HERO.leap, { when: (c) => is(c, 'back', 'wings'), min: 2, rest: 0.6 }],
  ['buffetCd', 3, 7, HERO.buffet, { when: (c) => is(c, 'back', 'wings'), max: 6 }],
  ['breathCd', 5, 9, HERO.breath, { when: (c) => is(c, 'back', 'wings') || is(c, 'chest', 'maw'), max: 9 }],
  ['gazeCd', 4, 9, HERO.gaze, { when: (c) => is(c, 'head', 'stalks'), min: 2, rest: 0.8 }],
  ['swarmCd', 6, 14, HERO.swarm, { when: (c) => is(c, 'head', 'stalks') }],
  ['lashCd', 2, 6, HERO.lash, { when: (c) => is(c, 'off', 'tentacle'), max: 7 }],
  ['writheCd', 3, 8, HERO.writhe, { when: (c) => is(c, 'legs', 'tentacles'), max: 5 }],
  ['rendCd', 2, 5, HERO.rend, { when: arm('claw'), max: 4 }],
  ['rakeCd', 3, 6, HERO.rake, { when: arm('claw'), max: 6 }],
  ['whirlCd', 2, 6, HERO.whirl, { when: arm('blade'), max: 4 }],
  ['impaleCd', 3, 6, HERO.impale, { when: arm('blade'), min: 1, max: 8 }],
  ['cryCd', 12, 24, HERO.cry, { ph: 2, rest: 0.6 }],
  ['bashCd', 3, 7, HERO.bash, { when: (c) => human(c, 'off'), min: 2, max: 7 }],
  ['swordCd', 1.4, 3.4, HERO.sword, { when: arm('sword'), max: 3, rest: 0.6 }],
];

export const HERO_BOSSES = {
  the_hero: {
    name: 'The Hero', hp: 250, dmg: 8, step: 0.34, mode: 'hostile', aggro: 22, under: true, boss: true, big: true, evolved: true, anim: true, humanoid: false,
    light: 6, brain: 'theHero', phases: 4, foot: 1, riseHp: 0.6, beamY: 84,
    tint: ['#ffd070', '#8ac040'], sayColor: '#ffe0a0',
    phaseLines: ['', '', 'It\'s... in my blood... get OUT!', 'I can\'t... I can\'t hold it... forgive me...', 'THERE IS NO HERO HERE. ONLY THE WOUND.'],
    riseLine: 'The man is gone. Only the curse rises.',
    tick: (c, dt) => {
      evoTick(c, dt);
      formOf(c);
      if (c.morphT === undefined) c.morphT = 4;
      if (!c.waiting && !(c.riseT > 0) && !c.leaping) {
        c.morphT -= dt;
        if (c.morphT <= 0) morph(c);
      }
      for (const e of c.game.everyone()) if (e.mercyT > 0) e.mercyT -= dt;
      if (c.lashTo) {
        c.lashTo.t += dt;
        if (c.lashTo.t > 1.1) c.lashTo = null;
      }
    },
    onPhase: (c) => {
      morph(c, true);
      c.cryCd = Math.min(c.cryCd ?? 0, 2);
    },
    onRise: (c) => {
      morph(c, true);
      c.mercyDone = true;
    },
    // (His mercy, the once: see evolved.js, evoHurt.)
    mercy: (game, c, p) => mercy(game, c, p),
    artSt: (c, st) => {
      const F = formOf(c);
      if (F.legs !== 'legs') st.legs = 1;
      if (F.chest !== 'plate') st.maw = 1;
    },
    drops: [['iron_ingot', 6, 12, 1], ['gold_ingot', 3, 6, 1], ['gem', 3, 6, 1], ['old_coin', 30, 60, 1], ['holy_relic', 1, 1, 1], ['shard_bloodstone', 2, 4, 1]],
  },
};

export const HERO_TITLES = {
  the_hero: { name: 'The Hero', title: 'Last Champion of Velmarch', taunt: 'Please... turn back. I can feel it waking. I don\'t want to hurt you.' },
};

export const HERO_BRAINS = {
  theHero(c, dt) {
    if (c.riseT > 0) return true;
    if (leapTick(c, dt)) return true;
    if (evoFight(c, dt, WORKS)) return true;
    return false;
  },
};

Object.assign(BRAINS, HERO_BRAINS);
Object.assign(BOSS_TITLES, HERO_TITLES);
