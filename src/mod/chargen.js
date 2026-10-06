// The character screen as a world's mods have it (round 63): their own
// tabs (choices of one of a list, of several, points to spend, words to
// write), and their changes to the game's tabs (renamed, moved, taken
// away; rows of them taken away; more rows on them; more origins, more
// starting gear, more traits). What's chosen is kept with the character
// (hero.modPicks, modOrigin, modKit, modTraits) and given when the game
// begins: items and coins, stats and health, traits, lasting effects, a
// story begun, values the mods' graphs and stories can read, looks, a
// companion at their heel, and where they begin.
//
// A tab, as the Workshop keeps it:
//   { name, title (on the screen), game (one of GAME_TABS: a change to
//     that tab, not a new one), hide, order, about, rows [{ id, label,
//     kind ('pick' | 'many' | 'points' | 'text'), about, options [{ id,
//     name, about, art (an asset), effects }], max (many: how many),
//     points (points: how many to spend), entries [{ id, name, about, max,
//     effects (each point's) }], def (pick: the option chosen to begin
//     with) }], hideRows [the game tab's own rows' ids], add { origin [{
//     id, name, about, as ('crash' | 'native' | 'star'), effects }], kit [{
//     id, name, about, effects }], trait [{ id, name, about, flaw,
//     effects }] } }
// Effects: { items [[ref, n]], coins, stats { str, agi, end, cha }, hp,
//   traits [game trait keys], effect (an effect entity '@id'), effectMins
//   (0: for good), story (a story's id), flags { name: value }, look {
//   skin, hair, ... }, companion (a creature '@id'), start ('spawn': where
//   the mod's world map has characters begin; or a world map place's id) }
import { MODS } from './state.js';
import { gameKey } from './format.js';

export const GAME_TABS = ['basics', 'looks', 'stats', 'traits'];
export const GAME_ORDER = { basics: 10, looks: 20, stats: 30, traits: 40 };
export const KINDS = ['pick', 'many', 'points', 'text'];
// The game tabs' own rows, by tab (what a change can take away).
export const GAME_ROWS = {
  basics: [['nameStyle', 'Names from'], ['origin', 'Origin'], ['kit', 'Starting gear']],
  looks: [['skin', 'Skin'], ['eyeColor', 'Eyes'], ['hair', 'Hair colour'], ['hairStyle', 'Hair style'], ['beard', 'Beard'], ['acc', 'Face'], ['mark', 'Marks'], ['hat', 'Hat'], ['outfit', 'Clothes'], ['shirt', 'Shirt colour'], ['pattern', 'Pattern'], ['neck', 'Kerchief'], ['cape', 'Cloak'], ['gloves', 'Gloves'], ['pants', 'Trousers'], ['shoes', 'Shoes'], ['accent', 'Accent'], ['stoop', 'Stance']],
  stats: [],
  traits: [],
};
export const LOOK_KEYS = ['skin', 'hair', 'eyeColor', 'shirt', 'pants', 'shoes', 'accent', 'neck', 'gloves', 'cape'];

const num = (v, d, a, b) => Math.max(a, Math.min(b, typeof v === 'number' && Number.isFinite(v) ? v : d));
const ref = (m, r) => (typeof r === 'string' && r[0] === '@' ? gameKey(m.id, r.slice(1)) : r);

// What the world's mods make of the character screen (from the mods as
// they are, installed or not: the screen comes before the world).
export function charGenOf(mods) {
  const out = { tabs: [], hidden: new Set(), titles: {}, orders: {}, abouts: {}, hideRows: new Set(), extra: { basics: [], looks: [], stats: [], traits: [] }, origins: [], kits: [], traits: [], any: false };
  for (const m of mods || []) {
    for (const t of Object.values(m.chargen || {})) {
      if (!t) continue;
      out.any = true;
      const rows = (t.rows || []).filter((r) => r && r.id && KINDS.includes(r.kind || 'pick')).map((r) => ({ ...r, kind: r.kind || 'pick', key: `${m.id}:${r.id}`, mod: m }));
      if (t.game && GAME_TABS.includes(t.game)) {
        if (t.hide) out.hidden.add(t.game);
        if (t.title) out.titles[t.game] = String(t.title).slice(0, 18);
        if (t.order !== undefined) out.orders[t.game] = num(t.order, GAME_ORDER[t.game], 0, 999);
        if (t.about) out.abouts[t.game] = t.about;
        for (const r of t.hideRows || []) out.hideRows.add(r);
        // (On the game's tabs: choices of one, or words.)
        for (const r of rows) if (r.kind === 'pick' || r.kind === 'text') out.extra[t.game].push(r);
        const A = t.add || {};
        for (const o of A.origin || []) if (o && o.id) out.origins.push({ ...o, mod: m, key: `${m.id}:${o.id}` });
        for (const o of A.kit || []) if (o && o.id) out.kits.push({ ...o, mod: m, key: `${m.id}:${o.id}` });
        for (const o of A.trait || []) if (o && o.id) out.traits.push({ ...o, mod: m, key: `${m.id}:${o.id}` });
      } else if (!t.hide) {
        out.tabs.push({ id: `m:${m.id}:${t.id}`, mod: m, tab: t, name: String(t.title || t.name || 'MORE').slice(0, 18), order: num(t.order, 50, 0, 999), about: t.about || '', rows });
      }
    }
  }
  return out;
}

// The tabs in order: [{ id, name, game ('basics'...) | null, tab (a mod's
// tab: { rows, about, ... }) }].
export function tabsOf(cg, names = { basics: 'BASICS', looks: 'LOOKS', stats: 'STATS', traits: 'TRAITS' }) {
  const list = [];
  for (const g of GAME_TABS) if (!cg.hidden.has(g)) list.push({ id: g, game: g, name: (cg.titles[g] || names[g]).toUpperCase(), order: cg.orders[g] ?? GAME_ORDER[g] });
  for (const t of cg.tabs) list.push({ id: t.id, game: null, tab: t, name: t.name.toUpperCase(), order: t.order });
  return list.sort((a, b) => a.order - b.order);
}

// Each row's choice to begin with (and every new row since: kept).
export function defaultPicks(cg, picks = {}) {
  const rows = [...cg.tabs.flatMap((t) => t.rows), ...Object.values(cg.extra).flat()];
  for (const r of rows) {
    if (picks[r.key] !== undefined) continue;
    if (r.kind === 'pick') picks[r.key] = r.def && (r.options || []).some((o) => o.id === r.def) ? r.def : (r.options || [])[0]?.id ?? null;
    else if (r.kind === 'many') picks[r.key] = [];
    else if (r.kind === 'points') picks[r.key] = {};
    else picks[r.key] = '';
  }
  return picks;
}

// Every effect a character's choices bring: [{ mod, e (effects), n (how
// many times: a point's, so many points), what (said where it came from)
// }].
export function chosenEffects(cg, hero) {
  const out = [];
  const picks = hero.modPicks || {};
  const rows = [...cg.tabs.flatMap((t) => t.rows), ...Object.values(cg.extra).flat()];
  for (const r of rows) {
    const v = picks[r.key];
    if (r.kind === 'pick') {
      const o = (r.options || []).find((q) => q.id === v);
      if (o && o.effects) out.push({ mod: r.mod, e: o.effects, n: 1, what: `${r.label}: ${o.name}` });
    } else if (r.kind === 'many') {
      for (const o of r.options || []) if (Array.isArray(v) && v.includes(o.id) && o.effects) out.push({ mod: r.mod, e: o.effects, n: 1, what: `${r.label}: ${o.name}` });
    } else if (r.kind === 'points') {
      for (const en of r.entries || []) {
        const n = v && v[en.id] | 0;
        if (n > 0 && en.effects) out.push({ mod: r.mod, e: en.effects, n, what: `${r.label}: ${en.name} ${n}` });
      }
    }
  }
  const o = hero.modOrigin && cg.origins.find((q) => q.key === hero.modOrigin);
  if (o && o.effects) out.push({ mod: o.mod, e: o.effects, n: 1, what: `Origin: ${o.name}` });
  const k = hero.modKit && cg.kits.find((q) => q.key === hero.modKit);
  if (k && k.effects) out.push({ mod: k.mod, e: k.effects, n: 1, what: `Gear: ${k.name}` });
  for (const key of hero.modTraits || []) {
    const t = cg.traits.find((q) => q.key === key);
    if (t && t.effects) out.push({ mod: t.mod, e: t.effects, n: 1, what: `Trait: ${t.name}` });
  }
  return out;
}

// The values a character's choices keep, for graphs and stories: each
// row's choice (as `${mod}:${row}`), and the flags its options set.
export function flagsOf(cg, hero) {
  const flags = {};
  const picks = hero.modPicks || {};
  for (const [k, v] of Object.entries(picks)) flags[k] = Array.isArray(v) ? v.join(',') : v && typeof v === 'object' ? JSON.stringify(v) : v;
  for (const r of cg.tabs.flatMap((t) => t.rows)) if (r.kind === 'points') for (const en of r.entries || []) flags[`${r.mod.id}:${r.id}.${en.id}`] = (picks[r.key] && picks[r.key][en.id]) | 0;
  for (const { mod, e, n } of chosenEffects(cg, hero)) for (const [fk, fv] of Object.entries(e.flags || {})) flags[`${mod.id}:${fk}`] = typeof fv === 'number' ? fv * n : fv;
  return flags;
}

// ------------------------------------------------------------ the game begun
// What a new character's choices give, given (their kit just given; before
// their look and health are settled).
export function applyCharGen(game, hero, player) {
  if (!hero || !MODS.active.length) return [];
  const cg = charGenOf(MODS.active);
  if (!cg.any) return [];
  const said = [];
  hero.modStats = {};
  hero.modHp = 0;
  hero.modFlags = flagsOf(cg, hero);
  hero.modCompanions ||= [];
  hero.modLasting ||= [];
  for (const { mod, e, n, what } of chosenEffects(cg, hero)) {
    for (const [it, c] of e.items || []) {
      const k = ref(mod, it);
      if (k) game.giveOrWear(k, Math.max(1, Math.round(num(c, 1, 1, 999))) * n);
    }
    if (e.coins) player.give('coin', Math.round(num(e.coins, 0, 0, 9999)) * n);
    for (const [s, v] of Object.entries(e.stats || {})) if (['str', 'agi', 'end', 'cha'].includes(s)) hero.modStats[s] = (hero.modStats[s] || 0) + num(v, 0, -5, 5) * n;
    if (e.hp) hero.modHp += num(e.hp, 0, -20, 40) * n;
    for (const t of e.traits || []) if (!hero.traits.includes(t)) hero.traits.push(t);
    if (e.look) for (const [k, v] of Object.entries(e.look)) if (LOOK_KEYS.includes(k) || ['hairStyle', 'hat', 'outfit', 'pattern', 'acc', 'mark', 'beardStyle'].includes(k)) hero.look[k] = v;
    if (e.effect) hero.modLasting.push({ key: ref(mod, e.effect), mins: num(e.effectMins, 0, 0, 100000) });
    if (e.companion) hero.modCompanions.push({ species: ref(mod, e.companion), alive: true });
    if (e.story) (game.modBegin ||= []).push({ type: 'story', mod: mod.id, story: e.story, player });
    if (e.start) (game.modBegin ||= []).push({ type: 'start', mod: mod.id, start: e.start, player });
    said.push(what);
  }
  return said;
}

// Each second or so, in play: lasting effects on, companions about (back
// at their owner's side if they're lost), what waits for the game to have
// begun (a story, a start somewhere else).
export function charGenTick(game) {
  if (!MODS.active.length) return;
  for (const q of game.modBegin || []) {
    const m = MODS.byId.get(q.mod);
    if (!m) continue;
    if (q.type === 'story') MODS.startStory?.(game, m, q.story, { player: q.player, pos: { x: q.player.x, z: q.player.z } });
    else if (q.type === 'start') startAt(game, q);
  }
  game.modBegin = null;
  for (const p of game.everyone()) {
    const hero = game.asPlayer(p, () => game.hero);
    if (!hero || p.dead) continue;
    for (const L of hero.modLasting || []) {
      if (L.done) continue;
      const on = (p.modFx || []).some((q) => q.key === L.key);
      if (on) continue;
      // (For good: on again whenever it's gone. For a while: once.)
      MODS.applyEffect?.(game, p, L.key, L.mins ? L.mins * 60 : 1e9);
      if (L.mins) L.done = true;
    }
    for (const C of hero.modCompanions || []) {
      if (!C.alive) continue;
      const c = game.creatures.find((q) => q.modOwnerKey === C && !q.dead);
      if (c) {
        c.owner = p;
        continue;
      }
      // (Killed: gone for good.)
      if (C.ent && C.ent.dead && C.ent.hp <= 0) {
        C.alive = false;
        game.asPlayer(p, () => game.ui?.msg?.(`${C.ent.S?.name || 'Your companion'} has fallen.`, '#ff9080'));
        continue;
      }
      const s = game.findFreeSpot(Math.round(p.x) + 1, Math.round(p.z) + 1, Math.floor(p.y));
      const nc = game.spawnMonster?.(C.species, s.x, s.y, s.z);
      if (!nc) continue;
      nc.owner = p;
      nc.modOwnerKey = C;
      C.ent = nc;
    }
  }
}

// A character begun somewhere a mod's world map says.
function startAt(game, q) {
  const ow = game.world.ow;
  const plan = MODS.world;
  let cx = null;
  let cz = null;
  if (q.start === 'spawn' && plan && plan.spawn) ({ cx, cz } = plan.spawn);
  else if (plan) {
    const P = plan.places.find((p) => p.id === q.start);
    const s = P && (game.world.sites || []).find((x) => x.planId === P.id);
    if (s) {
      const p = q.player;
      game.loadAround(s.x, s.z + (s.d || 4), true);
      const at = game.findFreeSpot(s.x, s.z + Math.ceil((s.d || 6) / 2) + 2, s.h + 1);
      p.teleport(at.x, at.y, at.z);
      p.spawn = { ...at };
      return;
    }
    if (P) ({ cx, cz } = P);
  }
  if (cx === null) return;
  const x = Math.floor((cx + 0.5) * 64);
  const z = Math.floor((cz + 0.5) * 36);
  game.loadAround(x, z, true);
  const at = game.findFreeSpot(x, z, 6);
  q.player.teleport(at.x, at.y, at.z);
  q.player.spawn = { ...at };
  ow.markExplored(at.x, at.z, 1);
}

// A companion's turn: at its owner's heel, at foes near them.
export function companionTick(c, dt) {
  const o = c.owner;
  if (!o || o.dead || o.limbo || o.down) return false;
  const game = c.game;
  const d = c.distTo(o);
  if (d > 28 || Math.abs(o.y - c.y) > 6) {
    const s = game.findFreeSpot(Math.round(o.x) + 1, Math.round(o.z), Math.floor(o.y));
    game.moveEntity(c, s.x, s.y, s.z);
    c.x = s.x;
    c.y = s.y;
    c.z = s.z;
    return true;
  }
  if (c.S.dmg > 0) {
    const foe = game.creatures.find((q) => q !== c && !q.dead && !q.owner && q.hostileNow && q.distTo(o) < 7 && Math.abs(q.y - o.y) <= 2);
    if (foe) {
      c.target = foe;
      c.chase(dt);
      return true;
    }
  }
  c.target = null;
  if (d > 2.5 && !c.moving) {
    const sx = Math.sign(Math.round(o.x) - c.x);
    const sz = Math.sign(Math.round(o.z) - c.z);
    const order = Math.abs(o.x - c.x) > Math.abs(o.z - c.z) ? [[sx, 0], [0, sz]] : [[0, sz], [sx, 0]];
    for (const [dx, dz] of order) if ((dx || dz) && c.tryStep(c.x + dx, c.z + dz, c.S.step * 0.9)) return true;
  }
  return true;
}
