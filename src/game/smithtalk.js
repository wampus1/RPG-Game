// (Round 132) A town's blacksmith takes commissions: a piece ordered, paid
// for, and ready the next day, made as well as a smith of that town makes
// things (a village's, two stars; a town's, two or three; a city's three,
// and four now and then, with steel to work). Better than most of what you'll
// make yourself to begin with, and dearer than buying it plain; never
// better than a master's own hand (see game/smithing.js).
import { ITEMS } from '../world/items.js';
import { RECIPES } from '../world/recipes.js';
import { forgeKind, forgePiece } from './smithing.js';
import { countItem, removeItem, addItem } from './inventory.js';
import { hash4, RNG } from '../util/rng.js';

// What a smith will make, by the size of the place (the anvil's own work).
const WARES = {
  village: ['iron_sword', 'dagger', 'iron_axe', 'iron_pickaxe', 'iron_shovel', 'iron_helmet', 'iron_shield', 'hoe'],
  town: ['iron_sword', 'short_sword', 'mace', 'spear', 'iron_axe', 'iron_pickaxe', 'iron_helmet', 'iron_shield', 'chainmail', 'iron_boots'],
  city: ['iron_sword', 'sabre', 'greatsword', 'battle_axe', 'warhammer', 'halberd', 'iron_pickaxe', 'iron_breastplate', 'chainmail', 'iron_greaves', 'iron_shield', 'steel_sword'],
};
const sizeOf = (s) => (s && WARES[s.type] ? s.type : 'village');

function orders(game) {
  return ((game.stats ||= {}).smithOrders ||= []);
}
// The order waiting with this smith, if there's one.
export function orderWith(game, npc) {
  return orders(game).find((o) => o.sid === npc.settlement.id && o.idx === npc.rec.idx) || null;
}
// What this smith makes, and for how much.
export function smithWares(game, npc) {
  const size = sizeOf(npc.settlement);
  return WARES[size].filter((k) => ITEMS[k] && RECIPES.some((r) => r.out === k && forgeKind(r))).map((k) => ({ k, name: ITEMS[k].name, price: priceOf(k, size) }));
}
function priceOf(k, size) {
  const base = (ITEMS[k] && ITEMS[k].value) || 30;
  return Math.round(base * ({ village: 2.2, town: 2.8, city: 3.6 }[size]) + 15);
}
// How well this smith's piece comes out: its stars.
function starsOf(size, rng) {
  if (size === 'city') return rng.chance(0.3) ? 4 : 3;
  if (size === 'town') return rng.chance(0.45) ? 3 : 2;
  return 2;
}

export function smithTopics(npc, game) {
  if (!npc.rec || npc.rec.job !== 'blacksmith' || npc.hired || npc.visit) return [];
  const o = orderWith(game, npc);
  if (o) return [{ id: 'sm_collect', label: o.day <= game.day ? `I've come for my ${ITEMS[o.plain].name.toLowerCase()}.` : `How's my ${ITEMS[o.plain].name.toLowerCase()} coming?` }];
  return [{ id: 'sm_order', label: 'Could you make me something?' }];
}

export function smithRespond(npc, game, id, arg) {
  if (!id.startsWith('sm_')) return null;
  const p = game.player;
  const s = npc.settlement;
  const size = sizeOf(s);
  if (id === 'sm_order') {
    if (orderWith(game, npc)) return { lines: ['One thing at a time. I\'ve your last order on the anvil still.'] };
    const wares = smithWares(game, npc);
    if (!arg) {
      return {
        lines: [size === 'city' ? 'Anything you like, if you\'ve the coin for it. Steel, even.' : size === 'town' ? 'I can make most things. What\'ll it be?' : 'Simple work, but honest. What do you need?', 'Paid now, and ready tomorrow.'],
        choices: wares.slice(0, 8).map((w) => ({ id: 'sm_order', arg: w.k, label: `${w.name} (¤${w.price})` })),
      };
    }
    const w = wares.find((q) => q.k === arg);
    if (!w) return { lines: ['I don\'t make those.'] };
    if (countItem(p.inv, 'coin') < w.price) return { lines: [`¤${w.price}, and not a coin less. Iron's dear.`] };
    removeItem(p.inv, 'coin', w.price);
    // (Its making settled now, so it's the same piece however long it waits.)
    const rng = new RNG(hash4(s.id, npc.rec.idx, game.day, w.price));
    const stars = starsOf(size, rng);
    const piece = forgePiece(w.k, 0.5 + stars * 0.1, [], 10, rng, { stars, cap: 5 });
    // (A smith's work carries no flaws out of the shop.)
    const key = piece.flaws.length ? forgePiece(w.k, 0.9, [], 10, rng, { stars, cap: 5, mods: piece.mods }).key : piece.key;
    orders(game).push({ sid: s.id, idx: npc.rec.idx, plain: w.k, key, day: game.day + 1, paid: w.price });
    game.audio?.play('coin');
    return { lines: [`Done. Come back tomorrow and it'll be ready: ${w.name.toLowerCase()}, as good as I can make it.`] };
  }
  if (id === 'sm_collect') {
    const o = orderWith(game, npc);
    if (!o) return { lines: ['I\'ve nothing of yours here.'] };
    if (o.day > game.day) return { lines: ['Still on the anvil. Tomorrow, I said.'] };
    const L = orders(game);
    L.splice(L.indexOf(o), 1);
    const it = ITEMS[o.key];
    const left = addItem(p.inv, o.key, 1);
    if (left) game.spawnDrop?.(o.key, left, p.x, p.y, p.z, true);
    game.audio?.play('clang');
    return { lines: [`Here: ${it ? it.name : 'your piece'}${it && it.stars ? `, ${'★'.repeat(it.stars)}` : ''}. Some of my best work.`] };
  }
  return null;
}
