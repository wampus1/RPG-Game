// Weather is the same whoever asks: a function of place and time. The sky
// changes in six-hour spells over wide areas (five map squares across),
// and a wet or dry front hangs around for most of a day. The areas drift
// slowly on the wind, so a storm rolls in over a few hours rather than
// switching on, and a town far away has rain on its fields too.
import { hash4 } from '../util/rng.js';
import { REGION_W, REGION_D } from '../config.js';
import { BIOMES } from './biomes.js';

export const SPELL = 360; // minutes
const CELL_W = REGION_W * 5;
const CELL_D = REGION_D * 5;
// Tiles the weather moves per minute (east and a little south): about a
// region's width a day.
const DRIFT_X = 1 / 24;
const DRIFT_Z = 1 / 60;

function frac(seed, a, b, c) {
  return (hash4(seed, a, b, c) % 10007) / 10007;
}

// 'clear' | 'rain' | 'snow' | 'fog' at tile (x, z) at absolute minute abs.
// Dry places see rain far less often (and no fog), and snow only ever
// falls where it's cold (each biome's rain and snowy: see biomes.js).
export function weatherAt(seed, x, z, abs, biome) {
  const bd = BIOMES[biome];
  const f = (bd && bd.rain) ?? 1;
  const cx = Math.floor((x - abs * DRIFT_X) / CELL_W);
  const cz = Math.floor((z - abs * DRIFT_Z) / CELL_D);
  const spell = Math.floor(abs / SPELL);
  const front = frac(seed, cx, cz, Math.floor(spell / 3) * 7 + 0x51);
  const r = frac(seed, cx, cz, spell * 13 + 0x3b);
  const wet = bd && bd.snowy ? 'snow' : 'rain';
  // Most of the time the sky is clear; a wet front passes now and then.
  if (front < 0.2 * f) return r < 0.75 ? wet : f >= 0.7 ? 'fog' : 'clear';
  if (front < 0.2 * f + 0.08 && f >= 0.7) return r < 0.35 ? 'fog' : 'clear';
  return r < 0.04 * f ? wet : 'clear';
}

// (Round 84) Storms: now and then, in two-hour spells, the weather
// turns wild. In the rain a thunderstorm (or, in the milder country, a
// hail storm); in the snow a blizzard; under a clear sky in the dry
// country a sandstorm, and elsewhere, rarely, a gale with no rain in it.
// The kind of weather under it is the same (a thunderstorm's rain is
// rain, a blizzard's snow is snow), so all that minds the rain still
// does: see Game.updateWeather.
export const STORMS = {
  thunder: { name: 'thunderstorm', base: 'rain', wind: 2.4, level: 1.6, start: 'Thunder rumbles: a storm rolls in.', end: 'The thunderstorm passes.' },
  hail: { name: 'hail storm', base: 'rain', wind: 2.1, level: 1.3, start: 'Hail comes rattling down!', end: 'The hail stops.' },
  blizzard: { name: 'blizzard', base: 'snow', wind: 2.8, level: 1.7, start: 'A blizzard howls in.', end: 'The blizzard blows itself out.' },
  sandstorm: { name: 'sandstorm', base: 'clear', wind: 2.6, level: 1.2, start: 'A wall of sand comes on the wind: a sandstorm!', end: 'The sandstorm dies down.' },
  gale: { name: 'gale', base: 'clear', wind: 2.2, level: 0.9, start: 'The wind gets up into a gale.', end: 'The gale drops.' },
};
const STORM_SPELL = 120; // minutes

export function stormAt(seed, x, z, abs, biome, kind = null) {
  const k = kind || weatherAt(seed, x, z, abs, biome);
  if (k === 'fog') return null;
  const bd = BIOMES[biome];
  const cx = Math.floor((x - abs * DRIFT_X) / CELL_W);
  const cz = Math.floor((z - abs * DRIFT_Z) / CELL_D);
  const sub = Math.floor(abs / STORM_SPELL);
  const r = frac(seed, cx, cz, sub * 29 + 0x5d);
  const r2 = frac(seed, cx, cz, sub * 31 + 0x6e);
  if (k === 'rain') {
    if (r >= 0.26) return null;
    const mild = bd && (bd.climate === 'mild' || bd.climate === 'warm') && (bd.rain ?? 1) <= 1;
    return mild && r2 < 0.3 ? 'hail' : 'thunder';
  }
  if (k === 'snow') return r < 0.24 ? 'blizzard' : null;
  if (biome === 'ocean' || !bd) return null;
  if ((bd.rain ?? 1) < 0.4) return r < 0.055 ? 'sandstorm' : null;
  return r < 0.018 ? 'gale' : null;
}

// The storm over a settlement, if there's one.
export function townStorm(seed, s, abs) {
  const x = Math.floor((s.cx + s.cw / 2) * REGION_W);
  const z = Math.floor((s.cz + s.cd / 2) * REGION_D);
  return stormAt(seed, x, z, abs, s.biome);
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

// (Round 84) What it is, in a word or two: 'rain', 'snow', 'fog', or a
// storm's name.
export function weatherWord(k) {
  return STORMS[k] ? STORMS[k].name : k === 'snow' ? 'snow' : k === 'fog' ? 'fog' : 'rain';
}

export function isWet(kind) {
  return kind === 'rain' || kind === 'snow';
}
