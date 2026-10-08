// (Round 73) Things set out to be seen: a weapon rack's three pegs, a
// stand for one fine piece, a hook on the wall for another. What's on them
// is kept as a chest's contents are (world.getContainer), so it saves and
// travels to everyone else the same way; and it's drawn on them as it is
// (see Renderer.drawDisplay). Click one with something in your hand to set
// it there; with nothing that fits, to take down what's on it. Someone
// else's are theirs: taking from them is stealing (onContainerTake).
//
// And paintings, small and large: each of something the painter saw (a
// beast, a face, a place, a map, a thing), the same picture always for the
// same spot, drawn once (see paintingArt).
import { BLOCKS, B } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { hash4 } from '../util/rng.js';
import { addItem } from './inventory.js';

const RACK_WEAPONS = ['spear', 'short_sword', 'hand_axe', 'mace', 'sabre', 'quarterstaff', 'halberd', 'battle_axe', 'dagger', 'club', 'javelin'];
const STAND_PIECES = ['steel_sword', 'greatsword', 'warhammer', 'longbow', 'crossbow', 'sabre', 'harpoon', 'flail'];
const HANGER_PIECES = ['sabre', 'short_sword', 'bow', 'dagger', 'harpoon', 'javelin', 'hand_axe'];

const isWeapon = (k) => !!(k && ITEMS[k] && (ITEMS[k].kind === 'weapon' || ITEMS[k].damage));

// What one holds before anyone's touched it: a rack in a town or a deep
// place has a weapon or two on it; a stand or a hook, sometimes, a piece.
// (The same each time for the same spot.)
export function displayDefault(world, x, y, z, b) {
  const n = b.display || 1;
  const out = new Array(n).fill(null);
  const h = (k) => hash4(x, y * 31 + k, z, (world.seed >>> 0) ^ 0xd15);
  const pick = (list, k) => {
    const key = list[h(k) % list.length];
    return ITEMS[key] ? { item: key, count: 1 } : null;
  };
  // (A player's own, or one out in the wild: bare.)
  const s = world.ow && world.ow.settlementAt ? world.ow.settlementAt(x, z) : null;
  const inst = world.inInstance && world.inInstance(x);
  if (!s && !inst) return out;
  if (s && s.condition === 'abandoned') return out;
  if (b.name === 'weapon_rack') {
    for (let i = 0; i < n; i++) if (h(10 + i) % 100 < 62) out[i] = pick(RACK_WEAPONS, 20 + i);
  } else if (b.name === 'display_stand') {
    if (h(1) % 100 < 70) out[0] = pick(STAND_PIECES, 2);
  } else if (h(1) % 100 < 55) out[0] = pick(HANGER_PIECES, 3);
  return out;
}

// What's on it now (without filling it in, if it's never been touched).
export function displayItems(world, x, y, z) {
  const b = BLOCKS[world.getBlock(x, y, z)];
  if (!b || !b.display) return null;
  return world.peekContainer(x, y, z) || displayDefault(world, x, y, z, b);
}

// May this go on it? (A rack takes weapons; a stand or a hook, anything
// that's one thing: not a block of stone or a heap of berries.)
export function fits(b, key) {
  if (!key || !ITEMS[key]) return false;
  if (b.displayKind === 'weapon') return isWeapon(key);
  const it = ITEMS[key];
  if (it.kind === 'block' || it.place) return false;
  return true;
}

// Clicked: set the thing in your hand on it, or take something down.
export function useDisplay(game, x, y, z) {
  const w = game.world;
  const b = BLOCKS[w.getBlock(x, y, z)];
  if (!b || !b.display) return false;
  const p = game.player;
  const slots = w.getContainer(x, y, z);
  if (!slots) return false;
  const held = p.inv[p.selected];
  const free = slots.findIndex((q) => !q);
  if (held && fits(b, held.item) && free >= 0) {
    slots[free] = { item: held.item, count: 1 };
    held.count -= 1;
    if (held.count <= 0) p.inv[p.selected] = null;
    game.audio?.play('place');
    game.markContainer?.(x, y, z);
    return true;
  }
  // Take the last thing put up.
  let i = slots.length - 1;
  while (i >= 0 && !slots[i]) i--;
  if (i < 0) {
    if (held && !fits(b, held.item)) game.renderer.floatText(x, y + 1.6, z, b.displayKind === 'weapon' ? 'weapons only' : 'won\'t hang there', '#c8c8c8');
    return true;
  }
  const got = slots[i];
  const left = addItem(p.inv, got.item, got.count);
  if (left >= got.count) {
    game.renderer.floatText(p.x, p.y + 2.2, p.z, 'no room', '#ffb080');
    return true;
  }
  slots[i] = left ? { ...got, count: left } : null;
  game.audio?.play('pickup');
  game.markContainer?.(x, y, z);
  const owner = game.containerOwner ? game.containerOwner(x, y, z) : null;
  if (owner) game.onContainerTake({ x, y, z, owner }, [{ item: got.item, count: got.count - left }]);
  return true;
}

// ------------------------------------------------------------ paintings
// What a painting shows (the same always for the same spot): a beast, a
// face, a place, a map, a thing; and which of each.
const BEASTS = ['wolf', 'deer', 'bear', 'boar', 'fox', 'rabbit', 'sheep', 'horse', 'crow', 'owl', 'spider', 'slime', 'skeleton', 'drake'];
const THINGS = ['apple', 'bread', 'steel_sword', 'goblet', 'lantern', 'gem', 'bow', 'cheese', 'fish', 'grapes', 'pumpkin', 'crown', 'book', 'key'];
export const PAINT_KINDS = ['beast', 'face', 'place', 'map', 'thing', 'sea', 'still'];
export function paintingSubject(x, y, z, seed = 0) {
  const h = hash4(x, y, z, (seed >>> 0) ^ 0xa17);
  const kind = PAINT_KINDS[h % PAINT_KINDS.length];
  const v = (h >>> 8) & 0xffff;
  if (kind === 'beast') return { kind, beast: BEASTS[v % BEASTS.length], v };
  if (kind === 'thing' || kind === 'still') {
    const things = THINGS.filter((k) => ITEMS[k]);
    return { kind, thing: things[v % things.length] || 'apple', thing2: things[(v >> 4) % things.length] || 'bread', v };
  }
  return { kind, v };
}

export const isPainting = (id) => !!(BLOCKS[id] && BLOCKS[id].painting);
export const isDisplay = (id) => !!(BLOCKS[id] && BLOCKS[id].display);
export const DISPLAY_IDS = () => [B.weapon_rack, B.display_stand, B.wall_hanger];

// (Round 74) Which way a thing hung on a wall has its wall: 0 the +z side,
// 1 the -x, 2 the -z, 3 the +x (as facings are counted: see
// Renderer.viewDir). The one in its meta if there's a wall there, else
// whichever side has one (one hung before they knew), else -1.
export const WALL_DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];
const wallAt = (world, x, y, z) => {
  const b = BLOCKS[world.getBlock(x, y, z)];
  return !!(b && b.solid && (b.render === 'cube' || b.render === 'wall' || b.render === 'door'));
};
export function wallDirOf(world, x, y, z, pref = 2) {
  const order = [pref & 3, 2, 1, 3, 0];
  for (const d of order) if (wallAt(world, x + WALL_DIRS[d][0], y, z + WALL_DIRS[d][1])) return d;
  return -1;
}
// The side a wall is on from (x, z), toward (wx, wz) beside it, or -1.
export function dirToward(x, z, wx, wz) {
  const dx = Math.sign(wx - x);
  const dz = Math.sign(wz - z);
  if (dx && dz) return -1;
  return WALL_DIRS.findIndex(([a, b]) => a === dx && b === dz);
}
