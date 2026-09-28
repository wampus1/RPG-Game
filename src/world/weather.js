// Weather is the same whoever asks: a function of place and time. The sky
// changes in six-hour spells over wide areas (five map squares across),
// and a wet or dry front hangs around for most of a day. The areas drift
// slowly on the wind, so a storm rolls in over a few hours rather than
// switching on, and a town far away has rain on its fields too.
import { hash4 } from '../util/rng.js';
import { REGION_W, REGION_D } from '../config.js';

export const SPELL = 360; // minutes
const CELL_W = REGION_W * 5;
const CELL_D = REGION_D * 5;
// Tiles the weather moves per minute (east and a little south): about a
// region's width a day.
const DRIFT_X = 1 / 24;
const DRIFT_Z = 1 / 60;
const COLD = new Set(['tundra', 'taiga', 'mountain']);

function frac(seed, a, b, c) {
  return (hash4(seed, a, b, c) % 10007) / 10007;
}

// 'clear' | 'rain' | 'snow' | 'fog' at tile (x, z) at absolute minute abs.
export function weatherAt(seed, x, z, abs, biome) {
  if (biome === 'desert') return 'clear';
  const cx = Math.floor((x - abs * DRIFT_X) / CELL_W);
  const cz = Math.floor((z - abs * DRIFT_Z) / CELL_D);
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
  for (let t = abs; t > abs - hours * 60; t -= 60) {
    const k = townWeather(seed, s, t);
    if (k === 'rain' || k === 'snow') return true;
  }
  return false;
}

export function isWet(kind) {
  return kind === 'rain' || kind === 'snow';
}
