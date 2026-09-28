// Slot-array inventory helpers shared by the player, containers and NPCs.
import { maxStack } from '../world/items.js';

export function makeSlots(n) {
  return new Array(n).fill(null);
}

export function countItem(slots, key) {
  let n = 0;
  for (const s of slots) if (s && s.item === key) n += s.count;
  return n;
}

// Adds as many as fit; returns the number that did NOT fit.
export function addItem(slots, key, count, order = null) {
  const max = maxStack(key);
  const idx = order || slots.map((_, i) => i);
  for (const i of idx) {
    const s = slots[i];
    if (s && s.item === key && s.count < max) {
      const take = Math.min(max - s.count, count);
      s.count += take;
      count -= take;
      if (!count) return 0;
    }
  }
  for (const i of idx) {
    if (!slots[i]) {
      const take = Math.min(max, count);
      slots[i] = { item: key, count: take };
      count -= take;
      if (!count) return 0;
    }
  }
  return count;
}

export function removeItem(slots, key, count) {
  for (let i = slots.length - 1; i >= 0 && count > 0; i--) {
    const s = slots[i];
    if (s && s.item === key) {
      const take = Math.min(s.count, count);
      s.count -= take;
      count -= take;
      if (s.count <= 0) slots[i] = null;
    }
  }
  return count === 0;
}

export function canAdd(slots, key, count) {
  const max = maxStack(key);
  let room = 0;
  for (const s of slots) {
    if (!s) room += max;
    else if (s.item === key) room += max - s.count;
    if (room >= count) return true;
  }
  return room >= count;
}
