// Fishing: cast a line, watch the bobber, strike when it goes under, then
// reel the fish in. Reeling is a little tug of war: hold SPACE (or the mouse
// button) to pull your catch zone along the bar and keep the fish inside it
// until the line is in; let the fish run too long and it slips the hook.
import { ITEMS } from '../world/items.js';

const BITE_WINDOW = 1.1; // seconds to strike once the bobber dips
export const ZONE = 0.3; // width of the catch zone on the bar

// What's on the end of the line, and how hard it fights.
const CATCHES = [
  { item: 'fish', w: 70, fight: 1 },
  { item: 'string', w: 9, fight: 0.4 },
  { item: 'bone', w: 9, fight: 0.4 },
  { item: 'coin', w: 8, fight: 0.7 },
  { item: 'gem', w: 4, fight: 1.6 },
];

function rollCatch(rand) {
  let r = rand() * CATCHES.reduce((n, c) => n + c.w, 0);
  for (const c of CATCHES) {
    r -= c.w;
    if (r <= 0) return c;
  }
  return CATCHES[0];
}

// Minutes-ish to wait for a bite: fish bite better in the rain and at dawn
// and dusk.
function waitTime(game, rand) {
  let t = 8 + rand() * 12;
  if (game.weather && game.weather.kind === 'rain') t *= 0.7;
  const m = game.minute;
  if ((m >= 300 && m < 480) || (m >= 1080 && m < 1260)) t *= 0.8;
  return t;
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
  const c = rollCatch(rand);
  f.phase = 'reel';
  f.catch = c.item;
  f.fight = c.fight;
  f.fish = 0.5;
  f.fishV = 0;
  f.zone = 0.5;
  f.zoneV = 0;
  f.progress = 0.3;
  f.turn = 0;
  game.player.doAction(0.3);
  game.audio?.play('select');
  game.ui.msg('Hooked! Hold SPACE to keep the fish in the green.', '#ffe070');
  return true;
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
      f.t = BITE_WINDOW;
      f.dip = 1;
      p.emoteShow('!', '#ffe070', BITE_WINDOW);
      game.audio?.play('splash');
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
  const pull = input && (input.isDown('Space') || input.mouse.down);
  f.turn -= dt;
  if (f.turn <= 0) {
    f.turn = 0.3 + rand() * 0.9 / f.fight;
    f.fishV = (rand() - 0.5) * 1.4 * f.fight;
  }
  f.fish += f.fishV * dt;
  if (f.fish < 0.03 || f.fish > 0.97) {
    f.fish = Math.max(0.03, Math.min(0.97, f.fish));
    f.fishV = -f.fishV;
  }
  f.zoneV += (pull ? 2.6 : -2.2) * dt;
  f.zoneV = Math.max(-0.9, Math.min(0.9, f.zoneV));
  f.zone += f.zoneV * dt;
  if (f.zone < ZONE / 2 || f.zone > 1 - ZONE / 2) {
    f.zone = Math.max(ZONE / 2, Math.min(1 - ZONE / 2, f.zone));
    f.zoneV = 0;
  }
  const inside = Math.abs(f.fish - f.zone) <= ZONE / 2;
  f.inside = inside;
  f.progress += (inside ? 0.28 : -0.2 * f.fight) * dt;
  f.dip = inside ? 0.3 : 0.8;
  if (Math.random() < dt * 3) game.renderer.emit(f.x, f.y, f.z, { n: 1, color: '#e0f4ff', up: 10, life: 0.3, oy: 2 });
  if (f.progress >= 1) land(game, f);
  else if (f.progress <= 0) {
    game.ui.msg('The line goes slack. It slipped the hook!', '#ff9060');
    game.fishing = null;
  }
}

function land(game, f) {
  const p = game.player;
  const item = f.catch;
  const left = p.give(item, 1);
  if (left) game.spawnDrop(item, 1, p.x, p.y, p.z, true);
  game.ui.msg(item === 'fish' ? 'Caught a fish!' : `You fished up: ${ITEMS[item].name}!`, '#80e070');
  game.audio?.play('pickup');
  game.renderer.emit(f.x, f.y, f.z, { n: 12, color: ['#8cc4f0', '#e0f4ff', '#ffffff'], up: 45, life: 0.6, oy: 2 });
  p.doAction(0.3);
  game.stats.fish = (game.stats.fish || 0) + (item === 'fish' ? 1 : 0);
  game.fishing = null;
}
