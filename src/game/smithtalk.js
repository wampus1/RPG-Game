// (Round 132) A town's blacksmith takes commissions: a piece ordered, paid
// for, and ready the next day. Better than most of what you'll make
// yourself to begin with, and dearer than buying it plain.
// (Round 139) Anything made at the anvil can be ordered. How good it comes
// out, and what it costs, is down to the smith's own skill: an apprentice's
// is cheap and plain, a master's dear and fine (a city's iron allows four
// stars, a village's three). The coin goes into the smith's purse.
import { ITEMS } from '../world/items.js';
import { RECIPES } from '../world/recipes.js';
import { forgeKind, forgePiece } from './smithing.js';
import { gearClass } from '../world/quality.js';
import { countItem, removeItem, addItem } from './inventory.js';
import { hash4, RNG } from '../util/rng.js';
import { tradeSkill } from '../sim/mind/talent.js';

// (Round 139) What a smith will make: everything that's worked at the
// anvil, from a hoe to a steel sword, in its kinds. How good it comes out,
// and what it costs, is down to the smith (their skill at their trade: see
// sim/mind/talent.tradeSkill), and a little to the place (a city's smith
// has better iron to hand, and dearer rent).
const KINDS = [
  { k: 'blades', label: 'Swords and knives', test: (it) => it.gear === 'blade' && /sword|sabre|dagger|knife|blade/.test(it.key) },
  { k: 'heavy', label: 'Axes, maces and hammers', test: (it) => it.gear === 'blade' && /axe|mace|hammer|flail/.test(it.key) },
  { k: 'pole', label: 'Spears, polearms and crossbows', test: (it) => it.gear === 'bow' || (it.gear === 'blade' && /spear|halberd|harpoon|pike|glaive/.test(it.key)) },
  { k: 'armor', label: 'Armour and shields', test: (it) => it.gear === 'armor' || it.gear === 'shield' },
  { k: 'tools', label: 'Tools', test: (it) => it.gear === 'tool' || it.kind === 'tool' },
];
const sizeOf = (s) => (s && ['village', 'town', 'city'].includes(s.type) ? s.type : 'village');
// (Every piece made at the anvil, worked out once.)
let ANVIL = null;
function anvilWork() {
  if (!ANVIL) {
    ANVIL = [];
    for (const r of RECIPES) {
      if (forgeKind(r) !== 'forge' || ANVIL.includes(r.out) || !ITEMS[r.out]) continue;
      ANVIL.push(r.out);
    }
    ANVIL.sort((a, b) => (ITEMS[a].value || 0) - (ITEMS[b].value || 0));
  }
  return ANVIL;
}
const kindOf = (k) => {
  const it = ITEMS[k];
  return (KINDS.find((q) => q.test({ ...it, key: k, gear: gearClass(it) })) || KINDS[KINDS.length - 1]).k;
};

function orders(game) {
  return ((game.stats ||= {}).smithOrders ||= []);
}
// The order waiting with this smith, if there's one.
export function orderWith(game, npc) {
  return orders(game).find((o) => o.sid === npc.settlement.id && o.idx === npc.rec.idx) || null;
}
// How good a smith this is (0 to 1).
export function smithSkill(npc) {
  return Math.max(0.05, Math.min(1, tradeSkill(npc.rec)));
}
// What this smith makes, and for how much (`kind`: only those of a kind).
export function smithWares(game, npc, kind = null) {
  const size = sizeOf(npc.settlement);
  const sk = smithSkill(npc);
  return anvilWork().filter((k) => !kind || kindOf(k) === kind).map((k) => ({ k, name: ITEMS[k].name, price: priceOf(k, size, sk), kind: kindOf(k) }));
}
// (The better the smith, the dearer: a master asks three times what an
// apprentice does.)
export function priceOf(k, size, skill = 0.4) {
  const base = (ITEMS[k] && ITEMS[k].value) || 30;
  return Math.round(base * (1.2 + skill * 3.2) * ({ village: 0.9, town: 1, city: 1.15 }[size] || 1) + 10 + skill * 20);
}
// How well this smith's piece comes out: its stars, by their skill (and a
// little luck), no more than the place's iron allows.
export function smithStars(skill, size, rng) {
  const q = skill + rng.float(-0.08, 0.08);
  const s = q < 0.3 ? 1 : q < 0.5 ? 2 : q < 0.7 ? 3 : q < 0.88 ? 4 : 5;
  return Math.max(1, Math.min({ village: 3, town: 4, city: 4 }[size] || 3, s));
}
const starWords = (skill) => (skill >= 0.8 ? 'a master' : skill >= 0.6 ? 'a fine hand' : skill >= 0.4 ? 'a fair smith' : 'still learning');

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
    const sk = smithSkill(npc);
    // (First the kind of thing; then, of that kind, the piece.)
    if (!arg || arg.startsWith('kind:')) {
      const kind = arg ? arg.slice(5) : null;
      if (!kind) {
        return {
          lines: [sk >= 0.8 ? 'Anything that can be beaten out of iron, I can make, and make well. It\'ll cost you, mind.' : sk >= 0.5 ? 'I can make most things. What\'ll it be?' : 'Simple work, but honest, and cheap with it. What do you need?', `Paid now, and ready tomorrow. (${starWords(sk)}: about ${'★'.repeat(smithStars(sk, size, { float: () => 0 }))} work.)`],
          choices: KINDS.map((q) => ({ id: 'sm_order', arg: `kind:${q.k}`, label: `${q.label} (${smithWares(game, npc, q.k).length})` })),
        };
      }
      const wares = smithWares(game, npc, kind);
      return {
        lines: [wares.length ? 'Pick what you like.' : 'I\'ve nothing of that kind.'],
        choices: [...wares.map((w) => ({ id: 'sm_order', arg: w.k, label: `${w.name} (¤${w.price})` })), { id: 'sm_order', arg: '', label: '(Something else.)' }],
      };
    }
    const w = smithWares(game, npc).find((q) => q.k === arg);
    if (!w) return { lines: ['I don\'t make those.'] };
    if (countItem(p.inv, 'coin') < w.price) return { lines: [`¤${w.price}, and not a coin less. ${sk >= 0.7 ? 'Good work comes dear.' : 'Iron\'s dear.'}`] };
    removeItem(p.inv, 'coin', w.price);
    // (Round 139: the coin goes to the smith, as any sale's does.)
    npc.rec.coins = (npc.rec.coins || 0) + w.price;
    // (Its making settled now, so it's the same piece however long it waits.)
    const rng = new RNG(hash4(s.id, npc.rec.idx, game.day, w.price));
    const stars = smithStars(sk, size, rng);
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
