// Bridges across the straits of a land split into pieces (round 68: see
// shapes.js). Each pair of pieces side by side gets one, where the water
// between them's narrowest along the line from one to the other, and how
// it's built goes by how far it has to reach and whose land it's in:
//   a short one (under 26 paces): a plank bridge, three wide, a rail of
//     posts along it;
//   a middling one: dressed stone on piers, three wide, a parapet each
//     side and lanterns on it every so far;
//   a long one (over 80 paces): a causeway five wide on piers, with towers
//     at its ends and every forty paces, lanterns burning on them;
// each in the stone and timber of its island (black basalt and braziers on
// Kharos, bogwood and fog lanterns on Myrrow, and the far lands' own: see
// MATS). Laid into the ground by regiongen.js, the deck a layer over the
// sea (so no raft goes under it), and its ends run up onto the land.
import { B } from './blocks.js';
import { hash4 } from '../util/rng.js';
import { landValue } from './geography.js';

export const DECK_Y = 6;

// What each kind's built of, and how: half its width, how far apart its
// piers stand, its lamps, its towers.
export const BRIDGE_KINDS = {
  plank: { hw: 1, piers: 0, lamps: 0, towers: 0, name: 'plank bridge' },
  stone: { hw: 1, piers: 7, lamps: 14, towers: 0, name: 'stone bridge' },
  causeway: { hw: 2, piers: 9, lamps: 12, towers: 40, name: 'causeway' },
};
// Materials by land (and by default). deck, the rail or parapet, piers
// (and towers), and the lamp.
const MATS = {
  default: {
    plank: { deck: 'planks', rail: 'fence', pier: 'log_oak', lamp: 'lantern' },
    stone: { deck: 'stone_bricks', rail: 'cobblestone', pier: 'stone_bricks', lamp: 'lantern' },
    causeway: { deck: 'stone_bricks', mid: 'cobblestone', rail: 'stone_bricks', pier: 'stone_bricks', lamp: 'lantern' },
  },
  kharos: {
    plank: { deck: 'planks_cinder', rail: 'fence', pier: 'log_cinder', lamp: 'ash_brazier' },
    stone: { deck: 'basalt_bricks', rail: 'basalt', pier: 'basalt_bricks', lamp: 'ash_brazier' },
    causeway: { deck: 'basalt_bricks', mid: 'kiln_tile', rail: 'basalt_bricks', pier: 'basalt', lamp: 'ash_brazier' },
  },
  myrrow: {
    plank: { deck: 'planks_bog', rail: 'fence', pier: 'log_mangrove', lamp: 'fog_lantern' },
    stone: { deck: 'mossy_bricks', rail: 'mossy_bricks', pier: 'stone_bricks', lamp: 'fog_lantern' },
    causeway: { deck: 'mossy_bricks', mid: 'planks_bog', rail: 'mossy_bricks', pier: 'stone_bricks', lamp: 'fog_lantern' },
  },
  // The far lands' (see world/farlands.js): the Velari's travertine on
  // marble; the Jade Court's bamboo and red lacquer; whalebone on Corrow;
  // salt brick and blue glaze on Saltmere; cob and lanterns on Hollowmark;
  // drystone on the Wyrd Isle and the Skerries.
  velmarch: {
    plank: { deck: 'planks', rail: 'fence', pier: 'log_oak', lamp: 'lantern' },
    stone: { deck: 'travertine', rail: 'marble', pier: 'travertine', lamp: 'lantern' },
    causeway: { deck: 'travertine', mid: 'stone_bricks', rail: 'marble_column', pier: 'travertine', lamp: 'lantern' },
  },
  ostria: {
    plank: { deck: 'bamboo', rail: 'fence', pier: 'planks_lacquer', lamp: 'lantern' },
    stone: { deck: 'stone_bricks', rail: 'planks_lacquer', pier: 'stone_bricks', lamp: 'lantern' },
    causeway: { deck: 'stone_bricks', mid: 'flagstone', rail: 'planks_lacquer', pier: 'stone_bricks', lamp: 'lantern' },
  },
  corrow: {
    plank: { deck: 'planks_drift', rail: 'fence', pier: 'whalebone', lamp: 'lantern' },
    stone: { deck: 'drystone', rail: 'whalebone', pier: 'drystone', lamp: 'lantern' },
    causeway: { deck: 'drystone', mid: 'planks_drift', rail: 'whalebone', pier: 'drystone', lamp: 'lantern' },
  },
  saltmere: {
    plank: { deck: 'planks_birch', rail: 'fence', pier: 'log_birch', lamp: 'lantern' },
    stone: { deck: 'salt_brick', rail: 'tile_blue', pier: 'salt_brick', lamp: 'lantern' },
    causeway: { deck: 'salt_brick', mid: 'tile_blue', rail: 'salt_brick', pier: 'salt_brick', lamp: 'lantern' },
  },
  hollowmark: {
    plank: { deck: 'planks', rail: 'fence', pier: 'log_oak', lamp: 'lantern' },
    stone: { deck: 'cob', rail: 'mossy_bricks', pier: 'mossy_bricks', lamp: 'lantern' },
    causeway: { deck: 'mossy_bricks', mid: 'cob', rail: 'mossy_bricks', pier: 'mossy_bricks', lamp: 'lantern' },
  },
  wyrd: {
    plank: { deck: 'planks_dark', rail: 'fence', pier: 'log_pine', lamp: 'lantern' },
    stone: { deck: 'drystone', rail: 'drystone', pier: 'drystone', lamp: 'lantern' },
    causeway: { deck: 'drystone', mid: 'flagstone', rail: 'drystone', pier: 'drystone', lamp: 'lantern' },
  },
  skerries: {
    plank: { deck: 'planks_dark', rail: 'fence', pier: 'log_pine', lamp: 'lantern' },
    stone: { deck: 'drystone', rail: 'drystone', pier: 'drystone', lamp: 'lantern' },
    causeway: { deck: 'drystone', mid: 'cobblestone', rail: 'drystone', pier: 'drystone', lamp: 'lantern' },
  },
};
export function bridgeMats(land, kind) {
  const M = MATS[land] || MATS.default;
  const m = M[kind] || MATS.default[kind];
  const out = {};
  for (const [k, v] of Object.entries(m)) out[k] = B[v] ?? B[MATS.default[kind][k]] ?? B.planks;
  return out;
}
export function addBridgeMats(land, mats) {
  MATS[land] = mats;
}

// The narrowest crossing between two pieces of land `L`: along lines from
// one's heart to the other's, a little to either side. Null if there's no
// sea between them (they've grown together) or it's too far to bridge.
function crossing(ow, L, A, B2) {
  const dx = B2.x - A.x;
  const dz = B2.z - A.z;
  const D = Math.hypot(dx, dz);
  if (D < 4) return null;
  const ux = dx / D;
  const uz = dz / D;
  const px = -uz;
  const pz = ux;
  const span = Math.min(A.rx, A.rz, B2.rx, B2.rz) * 0.45;
  let best = null;
  for (const o of [0, -0.5, 0.5, -1, 1]) {
    const ox = px * o * span;
    const oz = pz * o * span;
    let lastLand = -1;
    let sea = false;
    for (let t = 0; t <= D; t += 1) {
      const x = A.x + ux * t + ox;
      const z = A.z + uz * t + oz;
      const land = landValue(L, x, z, ow.nCont) > 0.02;
      if (land) {
        if (sea && lastLand >= 0) {
          const len = t - lastLand;
          if (len <= 260 && (!best || len < best.len)) best = { t0: lastLand, t1: t, len, ox, oz };
          break;
        }
        lastLand = t;
        sea = false;
      } else if (lastLand >= 0) sea = true;
    }
  }
  if (!best) return null;
  const run = 3;
  return {
    x0: A.x + ux * (best.t0 - run) + best.ox,
    z0: A.z + uz * (best.t0 - run) + best.oz,
    x1: A.x + ux * (best.t1 + run) + best.ox,
    z1: A.z + uz * (best.t1 + run) + best.oz,
    len: best.len,
  };
}

// Every bridge in the world (built with the world: see worldgen.js).
export function findBridges(ow) {
  const out = [];
  for (const L of ow.lands) {
    if (!L.parts || L.parts.length < 2 || !L.chain) continue;
    for (const [a, b] of L.chain) {
      const c = crossing(ow, L, L.parts[a], L.parts[b]);
      if (!c) continue;
      const kind = c.len < 26 ? 'plank' : c.len <= 80 ? 'stone' : 'causeway';
      const K = BRIDGE_KINDS[kind];
      const hw = K.hw;
      const pad = hw + 3;
      out.push({
        id: out.length, land: L.key, kind, ...c, hw,
        seed: hash4(ow.seed, Math.round(c.x0), Math.round(c.z0), 0xb41d),
        bx0: Math.min(c.x0, c.x1) - pad, bx1: Math.max(c.x0, c.x1) + pad,
        bz0: Math.min(c.z0, c.z1) - pad, bz1: Math.max(c.z0, c.z1) + pad,
      });
    }
  }
  return out;
}

// Where (x, z) is on a bridge, if it is: how far along it (in tiles from
// its first end), how far out from its middle line (signed), and the
// bridge. Null off any.
export function onBridge(bridges, x, z) {
  for (const b of bridges) {
    if (x < b.bx0 || x > b.bx1 || z < b.bz0 || z > b.bz1) continue;
    const dx = b.x1 - b.x0;
    const dz = b.z1 - b.z0;
    const l2 = dx * dx + dz * dz || 1;
    const t = ((x - b.x0) * dx + (z - b.z0) * dz) / l2;
    if (t < 0 || t > 1) continue;
    const len = Math.sqrt(l2);
    const side = ((x - b.x0) * -dz + (z - b.z0) * dx) / len;
    if (Math.abs(side) > b.hw + 0.5) continue;
    return { b, along: t * len, side: Math.round(side), len };
  }
  return null;
}
