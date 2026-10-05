// Fishing: cast a line, watch the bobber, strike when it goes under, then
// reel the fish in. Reeling is a little tug of war: hold SPACE (or the mouse
// button) to pull your catch zone along the bar and keep the fish inside it
// until the line is in; let the fish run too long and it slips the hook.
//   What bites depends on the water (fresh or salt), the weather and the
//   hour, the island (Kharos and Myrrow have fish of their own), and on how
//   practised you are (see mastery.js): a novice catches
//   perch and mackerel; an old hand hooks pike, eels, swordfish, and now and
//   then a golden carp. Each kind fights its own way: a perch drifts, a carp
//   is heavy and pulls your zone back, a pike rests then darts, an eel
//   weaves, a trout zigzags, a golden carp goes everywhere at once. Big ones
//   fight harder and land more. And sometimes something glints down there:
//   keep it in your zone a moment too and it comes up with the catch.
import { ITEMS } from '../world/items.js';
import { has as heroHas } from './hero.js';
import { mastery, gainMastery } from './mastery.js';

const BITE_WINDOW = 1.4; // seconds to strike once the bobber dips
export const ZONE = 0.3; // width of the catch zone on the bar (at the start)

// The kinds on the end of the line. `move`: how it fights (see swim);
// `fight`: how hard; `rank`: the practice it takes to hook one at all;
// `water`: fresh, salt or either; `n`: fish it lands (a big one, one more).
export const KINDS = {
  perch: { name: 'Perch', w: 40, water: 'fresh', move: 'drift', fight: 1, n: 1, rank: 1, body: '#8aa848', belly: '#e8d890', fin: '#c86030', len: 9 },
  mackerel: { name: 'Mackerel', w: 40, water: 'salt', move: 'zig', fight: 1, n: 1, rank: 1, body: '#5a8ab0', belly: '#e0e8f0', fin: '#3a5a7a', len: 9, stripes: '#2a3a5a' },
  carp: { name: 'Carp', w: 20, water: 'fresh', move: 'heavy', fight: 1.1, n: 1, rank: 1, body: '#b88a3a', belly: '#f0d088', fin: '#8a5a20', len: 11 },
  bass: { name: 'Sea Bass', w: 20, water: 'salt', move: 'heavy', fight: 1.15, n: 1, rank: 1, body: '#6a7a6a', belly: '#d8e0d0', fin: '#4a5a4a', len: 11 },
  trout: { name: 'Rainbow Trout', w: 14, water: 'fresh', move: 'zig', fight: 1.25, n: 1, rank: 2, body: '#7a9ab8', belly: '#f4d0d8', fin: '#5a7a98', len: 10, stripe: '#e870a0' },
  pike: { name: 'Pike', w: 10, water: 'fresh', move: 'dart', fight: 1.4, n: 2, rank: 3, body: '#5a7a4a', belly: '#d0e0a8', fin: '#3a5a2a', len: 14, spots: '#c8d890' },
  eel: { name: 'Eel', w: 9, water: 'either', move: 'wave', fight: 1.3, n: 1, rank: 3, body: '#4a4a32', belly: '#8a8a5a', fin: '#3a3a26', len: 15, eel: true, rain: 2.5 },
  swordfish: { name: 'Swordfish', w: 5, water: 'salt', move: 'dart', fight: 1.7, n: 3, rank: 5, body: '#4a5a8a', belly: '#c8d0e8', fin: '#2a3a6a', len: 16, sword: true },
  golden: { name: 'Golden Carp', w: 1.5, water: 'either', move: 'erratic', fight: 1.9, n: 3, rank: 4, body: '#f0c030', belly: '#fff0a0', fin: '#e08020', len: 11, gold: true, coins: 8 },
  // Only off the other Dagoni Islands (`isle`): round Kharos, an eel that
  // keeps to the warm water by the vents and a black-scaled snapper; in
  // Myrrow's dark pools and channels, a carp grey as the mist and a little
  // fish that glows.
  ember_eel: { name: 'Ember Eel', w: 12, water: 'either', move: 'wave', fight: 1.35, n: 2, rank: 2, body: '#8a3a1a', belly: '#f0a040', fin: '#5a2010', len: 15, eel: true, isle: 'kharos' },
  black_snapper: { name: 'Black Snapper', w: 18, water: 'salt', move: 'dart', fight: 1.3, n: 2, rank: 1, body: '#2a2630', belly: '#8a8090', fin: '#c8441a', len: 12, isle: 'kharos' },
  mist_carp: { name: 'Mist Carp', w: 22, water: 'fresh', move: 'heavy', fight: 1.15, n: 1, rank: 1, body: '#8a9498', belly: '#e0e4e0', fin: '#6a7478', len: 11, isle: 'myrrow' },
  glowfin: { name: 'Glowfin', w: 8, water: 'either', move: 'erratic', fight: 1.45, n: 2, rank: 3, body: '#4a8a8a', belly: '#c0f8f0', fin: '#9ae0e0', len: 9, isle: 'myrrow', stripe: '#e8fff8' },
  // (Not fish.)
  string: { name: 'Tangle of String', w: 8, water: 'either', move: 'sink', fight: 0.4, item: 'string', rank: 1 },
  bone: { name: 'Old Bone', w: 7, water: 'either', move: 'sink', fight: 0.4, item: 'bone', rank: 1 },
  coin: { name: 'Lost Coin', w: 6, water: 'either', move: 'sink', fight: 0.6, item: 'coin', rank: 1 },
  gem: { name: 'Rough Gem', w: 3, water: 'either', move: 'erratic', fight: 1.5, item: 'gem', rank: 2 },
};

// What bites: by the water, the hour, the weather and your practice (the
// rarer kinds more often as you rise; the lucky pull up coins and gems
// twice as often).
export function rollCatch(rand, o = {}) {
  const { lucky = false, unlucky = false, rank = 1, salt = false, rain = false, night = false, isle = null } = o;
  const list = [];
  for (const [k, c] of Object.entries(KINDS)) {
    if (c.rank > rank) continue;
    if (c.isle && c.isle !== isle) continue;
    if (c.water === 'fresh' && salt) continue;
    if (c.water === 'salt' && !salt) continue;
    let w = c.w;
    if (c.rank > 1) w *= 1 + 0.25 * (rank - c.rank);
    if ((k === 'coin' || k === 'gem') && lucky) w *= 2;
    if ((k === 'coin' || k === 'gem') && unlucky) w = 0;
    if (c.rain && rain) w *= c.rain;
    if (night && (k === 'eel' || k === 'pike' || k === 'glowfin')) w *= 1.6;
    list.push([k, w]);
  }
  let r = rand() * list.reduce((n, [, w]) => n + w, 0);
  for (const [k, w] of list) {
    r -= w;
    if (r <= 0) return k;
  }
  return list[0][0];
}

// Minutes-ish to wait for a bite: fish bite better in the rain and at dawn
// and dusk (and for an old hand).
function waitTime(game, rand) {
  let t = 8 + rand() * 12;
  if (game.weather && game.weather.kind === 'rain') t *= 0.7;
  const m = game.minute;
  if ((m >= 300 && m < 480) || (m >= 1080 && m < 1260)) t *= 0.8;
  if (heroHas(game.hero, 'angler')) t *= 0.75;
  t *= 1 - 0.03 * (mastery(game, 'fishing').rank - 1);
  return t;
}

// Is the water there the sea's?
function saltAt(game) {
  const b = game.biomeCache ? game.biomeCache.biome : null;
  return b === 'ocean' || b === 'beach';
}

export function castLine(game, c, rand = Math.random) {
  const p = game.player;
  if (game.fishing) {
    if (game.fishing.phase === 'bite') return hook(game);
    game.ui.msg('You reel in your line.', '#80c8ff');
    game.fishing = null;
    return false;
  }
  p.face(c.x, c.z);
  p.doAction(0.35);
  game.fishing = { phase: 'wait', x: c.x, y: c.y, z: c.z, t: waitTime(game, rand), nibble: 2 + rand() * 3, dip: 0, px: p.x, pz: p.z };
  game.audio?.play('splash');
  game.renderer.emit(c.x, c.y, c.z, { n: 6, color: ['#8cc4f0', '#e0f4ff'], up: 25, life: 0.5, oy: 2 });
  game.ui.msg('You cast your line... watch the bobber.', '#80c8ff');
  return true;
}

// Strike! Only works while the bobber is under.
export function hook(game, rand = Math.random) {
  const f = game.fishing;
  if (!f) return false;
  if (f.phase !== 'bite') {
    if (f.phase === 'wait') {
      // Too early: you spook them and have to wait longer.
      f.t += 3;
      game.ui.msg('Too soon! Wait for the bobber to go under.', '#c8c8c8');
    }
    return false;
  }
  const rank = mastery(game, 'fishing').rank;
  const ow = game.world.ow;
  const isle = ow.islandAt ? ow.islandAt(game.player.x, game.player.z) || ow.islandAt(f.x, f.z) : null;
  const kind = rollCatch(rand, { lucky: heroHas(game.hero, 'lucky'), unlucky: heroHas(game.hero, 'unlucky'), rank, salt: saltAt(game), rain: game.weather?.kind === 'rain', night: game.minute < 300 || game.minute >= 1260, isle });
  const K = KINDS[kind];
  // (How big: the bigger, the harder it fights, and the more it lands.)
  const size = K.item ? 1 : 0.75 + rand() * (0.45 + 0.05 * rank);
  f.phase = 'reel';
  f.kind = kind;
  f.catch = K.item || 'fish';
  f.size = size;
  f.big = size >= 1.15;
  f.fight = K.fight * (0.8 + size * 0.25) * (1 + 0.03 * (rank - 1));
  f.fish = 0.5;
  f.fishV = 0;
  f.dir = 1;
  f.zone = 0.5;
  f.zoneV = 0;
  // (A steadier hand, rank by rank; a big one's harder to keep in it.)
  f.zoneW = Math.max(0.18, ZONE + 0.008 * (rank - 1) + (heroHas(game.hero, 'angler') ? 0.03 : 0) - (f.big ? 0.03 : 0));
  f.progress = 0.3;
  f.turn = 0;
  f.t = 0;
  f.move = { mode: K.move, rest: 0, target: 0.5, ph: rand() * 6, base: 0.5, freq: 1.2 + rand() };
  // (Now and then something glints down there.)
  f.treasure = rand() < 0.12 + 0.015 * rank ? { at: 1 + rand() * 4, pos: 0.15 + rand() * 0.7, got: 0, life: 6, item: rand() < 0.15 ? 'gem' : rand() < 0.5 ? 'coin' : 'old_coin' } : null;
  game.player.doAction(0.3);
  game.audio?.play('select');
  game.ui.msg(K.item ? 'Hooked something! Hold SPACE to keep it in the green.' : `Hooked ${f.big ? 'a big ' : 'a '}${K.name.toLowerCase()}! Hold SPACE to keep it in the green.`, '#ffe070');
  return true;
}

// How the thing on the line moves along the bar, by its kind.
function swim(f, dt, rand) {
  const m = f.move;
  const F = f.fight;
  switch (m.mode) {
    case 'dart':
      // Rests, then a sudden dash.
      m.rest -= dt;
      if (m.rest <= 0) {
        if (Math.abs(f.fishV) > 0.5) {
          f.fishV = 0;
          m.rest = 0.5 + rand() * 0.9;
        } else {
          f.fishV = (rand() < 0.5 ? -1 : 1) * (1.6 + 0.8 * F);
          m.rest = 0.18 + rand() * 0.15;
          f.splash = 0.3;
        }
      }
      break;
    case 'wave':
      // Weaving round a slowly wandering middle.
      m.ph += dt * m.freq * (1 + 0.3 * F);
      m.base += (rand() - 0.5) * dt * 0.6;
      m.base = Math.max(0.25, Math.min(0.75, m.base));
      f.fishV = (m.base + Math.sin(m.ph) * 0.22 * F - f.fish) * 4;
      break;
    case 'zig':
      // Back and forth at a steady clip.
      m.rest -= dt;
      if (m.rest <= 0) {
        f.dir = -f.dir;
        m.rest = 0.35 + rand() * 0.5;
      }
      f.fishV = f.dir * (0.45 + 0.35 * F);
      break;
    case 'erratic':
      // Here, there, everywhere.
      m.rest -= dt;
      if (m.rest <= 0) {
        m.target = 0.05 + rand() * 0.9;
        m.rest = 0.22 + rand() * 0.3;
      }
      f.fishV = (m.target - f.fish) * (5 + 2 * F);
      break;
    case 'sink':
      // Hardly moves at all; drifts toward the bottom of the bar.
      f.fishV = -0.08 + Math.sin((f.t || 0) * 1.3) * 0.05;
      break;
    default:
      // A perch (or a carp): drifting this way and that.
      f.turn -= dt;
      if (f.turn <= 0) {
        f.turn = 0.3 + rand() * 0.9 / F;
        f.fishV = (rand() - 0.5) * 1.4 * F;
      }
  }
}

export function updateFishing(game, dt, input, rand = Math.random) {
  const f = game.fishing;
  if (!f) return;
  const p = game.player;
  if (p.x !== f.px || p.z !== f.pz || !p.heldDef()?.fishing || p.dead) {
    game.fishing = null;
    return;
  }
  f.dip = Math.max(0, f.dip - dt * 3);
  if (f.phase === 'wait') {
    f.t -= dt;
    f.nibble -= dt;
    // Nibbles: the bobber twitches, but it's not a bite yet.
    if (f.nibble <= 0) {
      f.nibble = 1.5 + rand() * 3;
      f.dip = 0.5;
      game.renderer.emit(f.x, f.y, f.z, { n: 2, color: '#e0f4ff', up: 8, life: 0.3, oy: 2 });
    }
    if (f.t <= 0) {
      f.phase = 'bite';
      f.t = BITE_WINDOW * (heroHas(game.hero, 'angler') ? 1.5 : 1) * (heroHas(game.hero, 'butterfingers') ? 0.67 : 1);
      f.dip = 1;
      p.emoteShow('!', '#ffe070', f.t);
      game.audio?.play('bite');
      game.renderer.emit(f.x, f.y, f.z, { n: 10, color: ['#8cc4f0', '#e0f4ff', '#ffffff'], up: 35, life: 0.5, oy: 2 });
    }
    return;
  }
  if (f.phase === 'bite') {
    f.dip = 1;
    f.t -= dt;
    if (f.t <= 0) {
      game.ui.msg('It got away... the bobber pops back up.', '#c8c8c8');
      f.phase = 'wait';
      f.t = waitTime(game, rand) * 0.6;
      f.nibble = 1 + rand() * 2;
    }
    return;
  }
  // Reeling: the fish darts about; you pull the zone after it.
  f.t = (f.t || 0) + dt;
  const pull = input && (input.isDown('Space') || input.mouse.down);
  f.clickT = (f.clickT || 0) - dt;
  if (pull && f.clickT <= 0) {
    f.clickT = 0.18;
    game.audio?.play('reel');
  }
  if (f.splash > 0) f.splash -= dt;
  swim(f, dt, rand);
  f.fish += f.fishV * dt;
  if (f.fish < 0.03 || f.fish > 0.97) {
    f.fish = Math.max(0.03, Math.min(0.97, f.fish));
    f.fishV = -f.fishV;
    f.dir = -f.dir;
  }
  const W = f.zoneW || ZONE;
  f.zoneV += (pull ? 2.6 : -2.2) * dt;
  // (A heavy one hauls back against you while you have it.)
  if (f.move && f.move.mode === 'heavy' && Math.abs(f.fish - f.zone) <= W / 2) f.zoneV -= 0.9 * f.fight * dt;
  f.zoneV = Math.max(-0.9, Math.min(0.9, f.zoneV));
  f.zone += f.zoneV * dt;
  if (f.zone < W / 2 || f.zone > 1 - W / 2) {
    f.zone = Math.max(W / 2, Math.min(1 - W / 2, f.zone));
    f.zoneV = 0;
  }
  const inside = Math.abs(f.fish - f.zone) <= W / 2;
  f.inside = inside;
  f.progress += (inside ? 0.28 * (heroHas(game.hero, 'angler') ? 1.25 : 1) * (heroHas(game.hero, 'butterfingers') ? 0.8 : 1) / Math.max(1, f.size || 1) : -0.2 * f.fight) * dt;
  // Something glinting: in your zone a moment and it's yours.
  const tr = f.treasure;
  if (tr && !tr.done && f.t >= tr.at) {
    tr.life -= dt;
    if (Math.abs(tr.pos - f.zone) <= W / 2) tr.got += dt / 1.6;
    if (tr.got >= 1) {
      tr.done = 'got';
      game.audio?.play('coin');
      game.ui.msg('Something glinting comes up with the line!', '#ffe070');
    } else if (tr.life <= 0) tr.done = 'lost';
  }
  f.dip = inside ? 0.3 : 0.8;
  if (Math.random() < dt * 3) game.renderer.emit(f.x, f.y, f.z, { n: 1, color: '#e0f4ff', up: 10, life: 0.3, oy: 2 });
  if (f.progress >= 1) land(game, f);
  else if (f.progress <= 0) {
    game.ui.msg(f.big ? 'The line goes slack. The big one got away!' : 'The line goes slack. It slipped the hook!', '#ff9060');
    game.fishing = null;
  }
}

function land(game, f) {
  const p = game.player;
  const K = KINDS[f.kind] || KINDS.perch;
  const item = f.catch;
  const n = K.item ? (item === 'coin' ? 2 + Math.floor(Math.random() * 4) : 1) : (K.n || 1) + (f.big ? 1 : 0);
  const give = (it, c) => {
    const left = p.give(it, c);
    if (left) game.spawnDrop(it, left, p.x, p.y, p.z, true);
  };
  give(item, n);
  if (K.coins) give('coin', K.coins);
  if (f.treasure && f.treasure.done === 'got') give(f.treasure.item, f.treasure.item === 'gem' ? 1 : 1 + Math.floor(Math.random() * 3));
  const what = K.item ? ITEMS[item].name : `${f.big ? 'a big ' : 'a '}${K.name.toLowerCase()}${n > 1 ? ` (${n} fish)` : ''}`;
  game.ui.msg(K.item ? `You fished up: ${what}!` : `Caught ${what}!`, K.gold ? '#ffe070' : '#80e070');
  game.audio?.play('catch');
  game.renderer.emit(f.x, f.y, f.z, { n: 12, color: K.gold ? ['#ffe070', '#fff8c0', '#ffffff'] : ['#8cc4f0', '#e0f4ff', '#ffffff'], up: 45, life: 0.6, oy: 2 });
  p.doAction(0.3);
  game.stats.fish = (game.stats.fish || 0) + (item === 'fish' ? n : 0);
  // (Practice: more for the harder ones.)
  gainMastery(game, 'fishing', K.item ? 0.5 : Math.max(1, Math.round(K.fight * (f.big ? 1.5 : 1))));
  game.fishing = null;
}
