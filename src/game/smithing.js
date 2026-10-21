// (Round 132) Making arms, armour and tools by hand, the way a dish is
// cooked (see game/cooking.js): what a piece comes out as is down to how
// well the work's done (the forge's games, see ui/forgewin.js), what went
// into it besides its iron (the additives, each with a nature you only
// learn by working it: see world/smithmats.js), and how practised you are
// (Smithing, ranked as angling and cooking are: see mastery.js).
//   - The work: at an anvil (or a smith's grindstone) iron's heated,
//     hammered and quenched; at a bench wood and stone are shaped and
//     bound; a bow's bent and strung; leather and cloth are cut and
//     stitched. Each stage scores 0 to 1; together, how well it was done.
//   - Its stars: how well it was done, no more than your rank allows (two
//     stars to begin with; five only for a master) and no more than what
//     it's made of allows (wood, stone, leather and cloth three; iron, gold
//     and the rest four; five only with a rare material in it).
//   - Its modifiers: as many as its stars bring (as ever), leaning toward
//     what its additives are (a fiery thing, searing; a light one, swift);
//     one of them, now and then, working only at some times if something
//     in it is of the night, of the deep, desperate...; botched, flaws.
//   - A pattern: a piece worth making again written down, its modifiers
//     and additives with it (the stars are your own work every time).
//   - A cast: a piece pressed into a blank cast (a mould with a very rare
//     material at its heart), and poured again and again, the piece exactly
//     as it was, for its makings and a relic shard each.
//   - Reforging: the modifiers beaten out afresh (the stars kept; flaws
//     beaten out, done well, or new ones in, done badly). Tempering: a
//     rare material worked into a piece for one star more.
// What's done at the forge is worked out here, at the host (a guest plays
// the forge's games on their own screen: see ui/forgewin.js).
import { ITEMS, patternKey, parsePattern } from '../world/items.js';
import { MODS, FLAWS, STATIC_MODS, gearClass, parseStar, starKey, starable, splitMod, modOf } from '../world/quality.js';
import { ADDITIVES, TRAITS, MATERIALS, RARITY, lifts, rarityOf } from '../world/smithmats.js';
import { mastery, gainMastery } from './mastery.js';
import { craftSources, countFrom, takeFrom } from './invtools.js';
import { addItem, countItem, removeItem } from './inventory.js';
import { RECIPES } from '../world/recipes.js';
import { has as heroHas } from './hero.js';

const LOOSE = {
  chance: (p) => Math.random() < p,
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  float: (a, b) => a + Math.random() * (b - a),
  pick: (a) => a[Math.floor(Math.random() * a.length)],
  next: () => Math.random(),
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const METALS = ['iron_ingot', 'gold_ingot', 'steel_ingot', 'kav_scrap'];
export const MAX_ADDS = 2;

// ------------------------------------------------------------ the work
// Which of the forge's works a recipe is (or null: made at once, as ever).
// A dye's only colour on a piece already made.
export function forgeKind(r) {
  if (!r || !starable(r.out)) return null;
  const ins = Object.keys(r.in);
  if (ins.some((k) => starable(k))) return null;
  const it = ITEMS[r.out];
  const cls = gearClass(it);
  const metal = ins.some((k) => METALS.includes(k));
  if (cls === 'bow' && !metal) return 'bow';
  // (Cloth and leather are cut and stitched, a little gold in them or not.)
  const soft = ins.filter((k) => k === 'leather' || k === 'cloth').reduce((a, k) => a + r.in[k], 0);
  const hard = ins.filter((k) => METALS.includes(k)).reduce((a, k) => a + r.in[k], 0);
  if ((cls === 'armor' || cls === 'shield') && soft > hard && !ins.includes('planks')) return 'stitch';
  if (metal) return 'forge';
  return 'carve';
}

// The stages of each work, in turn.
export const STAGES = {
  forge: ['heat', 'hammer', 'quench'],
  carve: ['shape', 'bind'],
  bow: ['bend', 'string'],
  stitch: ['cut', 'stitch'],
  reforge: ['heat', 'hammer'],
  temper: ['heat', 'quench'],
  cast: ['pour'],
};
// What the work's called, at its head.
export const WORK_NAMES = { forge: 'AT THE FORGE', carve: 'AT THE BENCH', bow: 'AT THE BOWYER\'S BENCH', stitch: 'AT THE CUTTING TABLE', reforge: 'REFORGING', temper: 'TEMPERING', cast: 'POURING THE CAST' };

// How many stars your rank allows (see mastery.js: Smithing).
export function masteryCap(rank) {
  return rank >= 9 ? 5 : rank >= 6 ? 4 : rank >= 3 ? 3 : 2;
}
// How many stars what it's made of allows (a rare material: five).
export function materialCap(r, adds = []) {
  const ins = Object.keys((r && r.in) || {});
  const base = ins.some((k) => METALS.includes(k) || k === 'obsidian_shard') ? 4 : 3;
  return Math.min(5, base + (adds.some((k) => lifts(k)) ? 1 : 0));
}
// How well the work was done, as stars (before the caps).
export function starsFor(q) {
  return q < 0.3 ? 1 : q < 0.52 ? 2 : q < 0.72 ? 3 : q < 0.88 ? 4 : 5;
}
// Each stage counted together: the hammer (or the shaping) a little more
// than the rest.
export function qualityOf(scores, kind) {
  const st = STAGES[kind] || [];
  const w = st.map((s) => (s === 'hammer' || s === 'shape' || s === 'bend' || s === 'stitch' ? 1.4 : 1));
  let sum = 0;
  let tot = 0;
  st.forEach((s, i) => {
    sum += clamp(+scores[i] || 0, 0, 1) * w[i];
    tot += w[i];
  });
  return tot ? sum / tot : 0;
}

// ------------------------------------------------------------ what's known
function known(game) {
  return ((game.stats ||= {}).smithKnown ||= {});
}
export function knowsAdd(game, k) {
  return !!known(game)[k];
}
// What an additive's nature is, in words (known, or '?').
export function traitWords(game, k) {
  const A = ADDITIVES[k];
  if (!A) return '';
  if (!knowsAdd(game, k)) return '?';
  return A.traits.map((t) => TRAITS[t].name).join(', ');
}
// What there is in your pack (and the chests by you) that could go in.
export function additivesAt(game) {
  const src = craftSources(game);
  const out = [];
  for (const k of Object.keys(ADDITIVES)) {
    const n = countFrom(src, k);
    if (n > 0 && ITEMS[k]) out.push({ k, n, name: ITEMS[k].name, traits: traitWords(game, k), rarity: rarityOf(k) });
  }
  return out.sort((a, b) => RARITY[b.rarity].n - RARITY[a.rarity].n || a.name.localeCompare(b.name));
}

// ------------------------------------------------------------ the piece
// The modifiers a piece of `cls` comes out with, `n` of them, leaning
// toward its additives' natures; one of them, given a time (`cond`), only
// working then.
function leanMods(cls, base, n, traits, rng) {
  const pool = Object.entries(MODS[cls] || {}).filter(([, m]) => (!m.tools || (base && m.tools.includes(base.tool))) && (!m.ammo || (base && base.ammo !== 'none'))).map(([k]) => k);
  const w = {};
  for (const k of pool) w[k] = 1;
  for (const t of traits) for (const [m, v] of Object.entries((TRAITS[t] && TRAITS[t].lean && TRAITS[t].lean[cls]) || {})) if (w[m] !== undefined) w[m] += v * 2;
  const out = [];
  while (out.length < n) {
    const opts = Object.entries(w).filter(([k]) => !out.includes(k));
    if (!opts.length) break;
    let r = rng.float(0, opts.reduce((a, [, v]) => a + v, 0));
    let got = opts[opts.length - 1][0];
    for (const [k, v] of opts) {
      r -= v;
      if (r < 0) {
        got = k;
        break;
      }
    }
    out.push(got);
  }
  return out;
}
function condOf(traits) {
  for (const t of traits) if (TRAITS[t] && TRAITS[t].cond) return TRAITS[t].cond;
  return null;
}
function withCond(cls, mods, cond, rng) {
  if (!cond || !mods.length) return mods;
  const ok = mods.map((m, i) => [m, i]).filter(([m]) => !(STATIC_MODS[cls] || []).includes(m) && !modOf(cls, m)?.land);
  if (!ok.length) return mods;
  const [m, i] = ok[rng.int(0, ok.length - 1)];
  const out = mods.slice();
  out[i] = `${m}-${cond}`;
  return out;
}

// A piece of `plain` worked as well as `q` (0 to 1), with `adds` in it, by
// a smith of rank `rank`. { key, stars, mods, flaws, q }.
// `o.mods`: its modifiers fixed (from a pattern); `o.cap`: what it's made
// of allows.
export function forgePiece(plain, q, adds = [], rank = 1, rng = LOOSE, o = {}) {
  const base = ITEMS[plain];
  const cls = gearClass(base);
  const traits = adds.flatMap((k) => (ADDITIVES[k] ? ADDITIVES[k].traits : []));
  // (What's in it can make the work go better, or worse.)
  const work = traits.reduce((a, t) => a + ((TRAITS[t] && TRAITS[t].work) || 0), 0);
  const qq = clamp(q + work + (rng.float(-0.03, 0.03)), 0, 1);
  const cap = Math.min(masteryCap(rank), o.cap || 4);
  const stars = o.stars || Math.max(1, Math.min(cap, starsFor(qq)));
  let mods;
  if (o.mods) mods = o.mods.filter((m) => modOf(cls, m) && !modOf(cls, m).flaw);
  else {
    const n = Math.min(3, Math.floor(stars / 2) + (rng.chance(0.3 + qq * 0.2) ? 1 : 0));
    mods = withCond(cls, leanMods(cls, base, n, traits, rng), condOf(traits), rng);
  }
  // Botched: a flaw, now and then (a brittle thing in it, likelier; a
  // tough one, less).
  const flawK = traits.reduce((a, t) => a + ((TRAITS[t] && TRAITS[t].flaw) || 0), 0);
  const pFlaw = clamp((qq < 0.4 ? (0.4 - qq) * 2.2 : 0) + Math.max(0, flawK) * (qq < 0.6 ? 1 : 0.3), 0, 0.95) * (flawK < 0 ? Math.max(0.1, 1 + flawK) : 1);
  const flaws = [];
  const F = Object.keys(FLAWS[cls] || {});
  if (F.length && rng.chance(pFlaw)) flaws.push(F[rng.int(0, F.length - 1)]);
  const key = starKey(plain, stars, 'c', rng.int(0, 36 * 36 - 1), [...mods, ...flaws]);
  return { key, stars, mods, flaws, q: qq };
}

// ------------------------------------------------------------ the forge
// What's to be done, for the forge's window (and for a guest's screen, all
// of it: see ui/forgewin.js). `r`: the recipe; `o.mode`: 'make' (the
// default), 'reforge' or 'temper' (`o.slot`: the piece, in your pack), or
// 'cast' (`o.cast`: the cast's key, `o.times`).
export function forgeCfg(game, r, o = {}) {
  const mode = o.mode || 'make';
  const m = mastery(game, 'smithing');
  const kind = mode === 'make' ? forgeKind(r) : mode;
  const piece = o.slot !== undefined && game.player.inv[o.slot] ? game.player.inv[o.slot].item : null;
  const plain = r ? r.out : piece ? (parseStar(piece) || { plain: piece }).plain : o.cast ? (parseStar(ITEMS[o.cast]?.cast) || {}).plain : null;
  const pats = mode === 'make' && r ? game.player.inv.filter((s) => s && ITEMS[s.item] && ITEMS[s.item].pattern && ITEMS[s.item].pattern.plain === r.out).map((s) => s.item) : [];
  game.forgeSeq = (game.forgeSeq || 0) + 1;
  return {
    token: game.forgeSeq, mode, kind, stages: STAGES[kind] || [], station: o.station || 'anvil',
    out: plain, n: r ? r.n : 1, name: plain && ITEMS[plain] ? ITEMS[plain].name : '', ins: r ? r.in : null,
    piece, cast: o.cast || null, times: o.times || 1,
    adds: mode === 'cast' ? [] : additivesAt(game).filter((a) => mode !== 'temper' || RARITY[a.rarity].n >= 2),
    patterns: pats.map((k) => ({ k, name: ITEMS[k].name, adds: ITEMS[k].pattern.adds, mods: ITEMS[k].pattern.mods })),
    rank: m.rank, title: m.title, frac: m.frac, cap: masteryCap(m.rank), mcap: r ? materialCap(r) : 5,
    cost: mode === 'reforge' && piece ? reforgeCostOf(piece) : null,
  };
}

// What a reforge takes: coin, and a bar of iron (a string, for a bow).
export function reforgeCostOf(key) {
  const sp = parseStar(key) || { plain: key, stars: 1 };
  const bow = gearClass(ITEMS[sp.plain]) === 'bow';
  return { coin: 20 + sp.stars * 15, item: bow ? 'string' : 'iron_ingot', name: bow ? 'a string' : 'an iron ingot' };
}

// Is it all still there to be used (the makings, the additives)?
function haveAll(src, need) {
  for (const [k, n] of Object.entries(need)) if (countFrom(src, k) < n) return k;
  return null;
}

// The forge's games played (`msg`: { scores, adds, pattern }): the piece
// made (or reforged, tempered, poured), and what came of it, for the
// window to show. { ok, key, name, stars, mods: [{ name, about, flaw }],
// learned: [{ name, traits }], text }.
export function forgeResult(game, cfg, msg = {}, rng = LOOSE) {
  const p = game.player;
  const src = craftSources(game);
  const scores = Array.isArray(msg.scores) ? msg.scores : [];
  // (A tinker's hand a little finer.)
  const q = clamp(qualityOf(scores, cfg.kind) + (heroHas(game.hero, 'tinker') ? 0.04 : 0), 0, 1);
  const pat = msg.pattern && ITEMS[msg.pattern] && ITEMS[msg.pattern].pattern ? parsePattern(msg.pattern) : null;
  let adds = (Array.isArray(msg.adds) ? msg.adds : []).filter((k) => ADDITIVES[k]).slice(0, MAX_ADDS);
  if (pat) adds = pat.adds.filter((k) => ADDITIVES[k]).slice(0, MAX_ADDS);
  const m = mastery(game, 'smithing');
  const need = {};
  for (const [k, n] of Object.entries(cfg.ins || {})) need[k] = (need[k] || 0) + n * (cfg.mode === 'cast' ? cfg.times : 1);
  for (const k of adds) need[k] = (need[k] || 0) + 1;
  if (cfg.mode === 'cast') need.relic_shard = (need.relic_shard || 0) + cfg.times;
  const missing = haveAll(src, need);
  if (missing) return { ok: false, text: `You haven't the ${ITEMS[missing] ? ITEMS[missing].name.toLowerCase() : missing} for it any more.` };
  // (Its natures learned, as a cook learns what a thing is.)
  const learned = [];
  const K = known(game);
  for (const k of adds) {
    if (!K[k]) learned.push({ name: ITEMS[k].name, traits: ADDITIVES[k].traits.map((t) => TRAITS[t].name).join(', ') });
    K[k] = true;
  }
  let key = null;
  let made = 1;
  if (cfg.mode === 'make') {
    for (const [k, n] of Object.entries(need)) takeFrom(src, k, n);
    const res = forgePiece(cfg.out, q, adds, m.rank, rng, { cap: materialCap({ in: cfg.ins }, adds), mods: pat ? pat.mods : null });
    key = res.key;
    const left = addItem(p.inv, key, 1);
    if (left) game.spawnDrop?.(key, left, p.x, p.y, p.z, true);
    gainMastery(game, 'smithing', q >= 0.45 ? 1 + (res.stars >= 4 ? 1 : 0) : 0.4);
  } else if (cfg.mode === 'reforge' || cfg.mode === 'temper') {
    const i = p.inv.findIndex((s) => s && s.item === cfg.piece);
    if (i < 0) return { ok: false, text: 'The piece isn\'t in your pack any more.' };
    const sp = parseStar(cfg.piece) || { plain: cfg.piece, stars: 1, mods: [], origin: 'c', roll: 0 };
    const cls = gearClass(ITEMS[sp.plain]);
    if (cfg.mode === 'temper') {
      const mat = adds.find((k) => lifts(k));
      if (!mat) return { ok: false, text: 'Tempering wants a rare material or better.' };
      takeFrom(src, mat, 1);
      const cap = masteryCap(m.rank);
      if (q >= 0.55 && sp.stars < Math.min(5, cap)) {
        key = starKey(sp.plain, sp.stars + 1, sp.origin, sp.roll, sp.mods);
        gainMastery(game, 'smithing', 1);
      } else {
        gainMastery(game, 'smithing', 0.4);
        return { ok: true, key: cfg.piece, failed: true, ...describe(cfg.piece), learned, text: sp.stars >= cap ? `It won't take another star from you: your rank allows ${cap}.` : `The ${ITEMS[mat].name.toLowerCase()} wouldn't take: the piece is as it was, and the material's spent.` };
      }
    } else {
      const c = reforgeCostOf(cfg.piece);
      if (countItem(p.inv, 'coin') < c.coin || countFrom(src, c.item) < 1) return { ok: false, text: `Reforging takes ¤${c.coin} and ${c.name}.` };
      removeItem(p.inv, 'coin', c.coin);
      takeFrom(src, c.item, 1);
      for (const k of adds) takeFrom(src, k, 1);
      const land = sp.mods.filter((x) => modOf(cls, x) && modOf(cls, x).land);
      const fresh = forgePiece(sp.plain, q, adds, 10, rng, { stars: sp.stars });
      // (Done well, its flaws beaten out; badly, perhaps new ones.)
      const flaws = q >= 0.5 ? [] : fresh.flaws;
      key = starKey(sp.plain, sp.stars, sp.origin, rng.int(0, 36 * 36 - 1), [...land, ...fresh.mods.filter((x) => !land.includes(splitMod(x).m))].slice(0, 3).concat(flaws));
      gainMastery(game, 'smithing', 0.5);
    }
    const s = p.inv[i];
    if (s.count > 1) {
      s.count--;
      const left = addItem(p.inv, key, 1);
      if (left) game.spawnDrop?.(key, left, p.x, p.y, p.z, true);
    } else p.inv[i] = { item: key, count: 1 };
  } else if (cfg.mode === 'cast') {
    const of = ITEMS[cfg.cast] && ITEMS[cfg.cast].cast;
    if (!of || countItem(p.inv, cfg.cast) < 1) return { ok: false, text: 'You haven\'t the cast.' };
    for (const [k, n] of Object.entries(need)) takeFrom(src, k, n);
    key = of;
    made = cfg.times;
    const left = addItem(p.inv, key, made);
    if (left) game.spawnDrop?.(key, left, p.x, p.y, p.z, true);
  }
  game.stats.crafted = (game.stats.crafted || 0) + made;
  return { ok: true, key, made, q, learned, ...describe(key), rankUp: mastery(game, 'smithing').rank > m.rank };
}

// What a piece is, in words for the window.
export function describe(key) {
  const it = ITEMS[key];
  if (!it) return { name: key, stars: 0, mods: [] };
  const cls = it.gear;
  return {
    name: it.name, stars: it.stars || 0,
    mods: (it.mods || []).map((m) => {
      const d = modOf(cls, m) || {};
      return { name: d.name || m, about: d.about || '', flaw: !!d.flaw, cond: d.cond || null };
    }),
  };
}

// ------------------------------------------------------------ patterns, casts
// A piece written down as a pattern (a scroll used up): its modifiers, and
// what went into it.
export function writePattern(game, key, adds = []) {
  const p = game.player;
  const sp = parseStar(key);
  if (!sp || sp.origin !== 'c') return { ok: false, text: 'Only a piece you\'ve made yourself can be written down.' };
  if (countItem(p.inv, 'scroll') < 1) return { ok: false, text: 'You need a blank scroll to write a pattern on.' };
  removeItem(p.inv, 'scroll', 1);
  const cls = gearClass(ITEMS[sp.plain]);
  const pk = patternKey(sp.plain, sp.mods.filter((m) => !modOf(cls, m)?.flaw), adds.filter((k) => ADDITIVES[k]));
  const left = addItem(p.inv, pk, 1);
  if (left) game.spawnDrop?.(pk, left, p.x, p.y, p.z, true);
  return { ok: true, key: pk, text: `Written down: ${ITEMS[pk].name}.` };
}

// A piece of yours pressed into a blank cast: the cast (the piece kept).
export function pressCast(game, key) {
  const p = game.player;
  const sp = parseStar(key);
  if (!sp || sp.origin !== 'c') return { ok: false, text: 'Only a piece forged by hand can be cast.' };
  if (countItem(p.inv, 'blank_cast') < 1) return { ok: false, text: 'You need a blank cast (made at an anvil, of a very rare material).' };
  if (countItem(p.inv, key) < 1) return { ok: false, text: 'The piece isn\'t in your pack.' };
  removeItem(p.inv, 'blank_cast', 1);
  const ck = `cast~${key}`;
  const left = addItem(p.inv, ck, 1);
  if (left) game.spawnDrop?.(ck, left, p.x, p.y, p.z, true);
  game.audio?.play('clang');
  return { ok: true, key: ck, text: `${ITEMS[key].name} pressed into the clay: ${ITEMS[ck].name}.` };
}

// The casts in your pack, and what a pour of each takes.
export function castsAt(game) {
  const out = [];
  for (const s of game.player.inv) {
    const it = s && ITEMS[s.item];
    if (!it || !it.cast || out.some((q) => q.k === s.item)) continue;
    const sp = parseStar(it.cast);
    const r = recipeFor(sp ? sp.plain : it.cast);
    out.push({ k: s.item, of: it.cast, name: ITEMS[it.cast].name, recipe: r });
  }
  return out;
}

// The recipe a piece is made by (the first, if it's made more than one way).
let RECIPES_OF = null;
export function recipeFor(plain) {
  if (!RECIPES_OF) {
    RECIPES_OF = new Map();
    for (const r of RECIPES) if (!RECIPES_OF.has(r.out) && forgeKind(r)) RECIPES_OF.set(r.out, r);
  }
  return RECIPES_OF.get(plain) || null;
}

export { MATERIALS };
