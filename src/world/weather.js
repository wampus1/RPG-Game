// Weather is the same whoever asks: a function of place and time. The sky
// changes in four-hour spells over areas a few map squares wide, and a wet
// or dry front tends to hang around for half a day. So a town you're far
// from has rain on its fields too, and its people grumble about it.
import { hash4 } from '../util/rng.js';
import { REGION_W, REGION_D } from '../config.js';

export const SPELL = 240; // minutes
const CELL_W = REGION_W * 3;
const CELL_D = REGION_D * 3;
const COLD = new Set(['tundra', 'taiga', 'mountain']);

function frac(seed, a, b, c) {
  return (hash4(seed, a, b, c) % 10007) / 10007;
}

// 'clear' | 'rain' | 'snow' | 'fog' at tile (x, z) at absolute minute abs.
export function weatherAt(seed, x, z, abs, biome) {
  if (biome === 'desert') return 'clear';
  const cx = Math.floor(x / CELL_W);
  const cz = Math.floor(z / CELL_D);
  const spell = Math.floor(abs / SPELL);
  const front = frac(seed, cx, cz, Math.floor(spell / 3) * 7 + 0x51);
  const r = frac(seed, cx, cz, spell * 13 + 0x3b);
  const wet = COLD.has(biome) ? 'snow' : 'rain';
  if (front < 0.3) return r < 0.8 ? wet : 'fog';
  if (front < 0.42) return r < 0.6 ? 'fog' : 'clear';
  return r < 0.1 ? wet : 'clear';
}

// The weather over a settlement.
export function townWeather(seed, s, abs) {
  const x = Math.floor((s.cx + s.cw / 2) * REGION_W);
  const z = Math.floor((s.cz + s.cd / 2) * REGION_D);
  return weatherAt(seed, x, z, abs, s.biome);
}

// Did it rain (or snow) over this settlement in the `hours` before abs?
export function rainedRecently(seed, s, abs, hours = 24) {
  for (let t = abs; t > abs - hours * 60; t -= SPELL) {
    const k = townWeather(seed, s, t);
    if (k === 'rain' || k === 'snow') return true;
  }
  return false;
}

export function isWet(kind) {
  return kind === 'rain' || kind === 'snow';
}
