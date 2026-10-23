// (Round 144) How a town taken by storm is treated: the sack. Two things in
// it: greed (how much is carried off: the coin, the stores, the goods) and
// cruelty (what's burned, who's cut down, who's dragged off). Each comes of
// who took it:
//   - the conquering people's ways (a martial people, or one that lives off
//     the sea, are harder; a pious one gentler, unless it's a holy war; a
//     merchant people loots more and kills less; scholars spare what they
//     can), and what their faith holds most dear (charity, patience,
//     hospitality soften them; courage doesn't);
//   - the realm's ruler (their kindness, their temper; a player ruler's
//     decree on the conduct of the realm's armies: see crown.js);
//   - the commander in the field (their kindness, their temper, stern or
//     merciful, grasping or honest; a player in command gives the word
//     themselves, there and then: see command.js);
//   - and what's gone before: a long siege, assaults beaten back with heavy
//     losses, terms refused, a hated enemy; a town of the same faith, or one
//     that was theirs once, spared the worst.
// The level: an orderly taking (the gates held, nothing touched), plunder
// (the town picked clean, a few fires), a sack (fires, killing in the
// streets, prisoners), or a massacre.
import { clamp } from '../util/rng.js';
import { traitsOf } from './officertraits.js';
import { realmFaith, religionOf } from './culture.js';

// A player ruler's decree on the conduct of their armies.
export const CONDUCTS = ['mercy', 'custom', 'plunder', 'ruthless'];
export const CONDUCT_NAMES = { mercy: 'show mercy', custom: 'as the soldiers will', plunder: 'plunder, no killing', ruthless: 'no quarter' };
export const LEVELS = ['orderly', 'plunder', 'sack', 'massacre'];
export const LEVEL_NAMES = { orderly: 'taken in good order', plunder: 'plundered', sack: 'sacked', massacre: 'put to the sword' };

// The word given there and then, by a player in command (or none).
export const WORDS = { spare: 'Spare the town!', loot: 'Take what you can carry, but no killing!', free: 'The town is yours!', none: null };

// How a town taken by `civ`'s army would be treated. `ctx`: { w (the war),
// commander (a rec), town (the settlement), days (of siege), failed
// (assaults beaten back), refused (terms refused), word (a player's word in
// the field), conduct (a player ruler's decree, if any) }.
export function brutality(sim, civ, ctx = {}) {
  const why = [];
  const add = (axis, v, text) => {
    if (Math.abs(v) >= 0.02) why.push({ axis, v, text });
    return v;
  };
  let c = 0.28;
  let g = 0.4;
  const vals = (civ && civ.values) || [];
  if (vals.includes('martial')) c += add('c', 0.12, 'a martial people');
  if (vals.includes('seafaring')) {
    c += add('c', 0.05, 'raiders by sea of old');
    g += add('g', 0.1, 'raiders by sea of old');
  }
  if (vals.includes('mercantile')) {
    g += add('g', 0.16, 'a merchant people: what can be sold');
    c += add('c', -0.06, 'a merchant people: dead men buy nothing');
  }
  if (vals.includes('pious')) c += add('c', -0.08, 'a pious people');
  if (vals.includes('scholarly')) c += add('c', -0.08, 'a learned people');
  if (vals.includes('agrarian') || vals.includes('artisan')) c += add('c', -0.03, 'a people of the fields and benches');
  const faith = civ ? realmFaith(civ) : null;
  if (faith) {
    if (['charity', 'patience', 'hospitality'].includes(faith.virtue)) c += add('c', -0.07, `a faith that holds ${faith.virtue} highest`);
    if (faith.virtue === 'courage') c += add('c', 0.03, 'a faith that holds courage highest');
    if (faith.virtue === 'honesty') g += add('g', -0.05, 'a faith that holds honesty highest');
  }
  const town = ctx.town || null;
  const theirs = town ? religionOf(town) : null;
  const w = ctx.w || null;
  if (w && (w.reason === 'holy' || /faithful|holy/.test(w.why || ''))) c += add('c', 0.2, 'a holy war');
  else if (faith && theirs && faith.key === theirs.key) c += add('c', -0.08, 'the same faith');
  // (A town that was theirs, once: their own people.)
  if (town && civ && (sim.realms.allegiance || []).some((q) => q[0] === town.id && q[1] === civ.id)) c += add('c', -0.22, 'a town that was theirs once');
  if (town && town.civ && civ && sim.realms.relation) {
    const r = sim.realms.relation(civ, town.civ);
    if (r && r.score <= -60) c += add('c', 0.08, 'a hated enemy');
  }
  // The ruler.
  const crown = sim.crown;
  const ruled = crown && civ && crown.ruled && crown.ruled(civ);
  const R = ruled ? crown.R(civ) : null;
  const conduct = ctx.conduct || (R && R.decrees && R.decrees.conduct) || null;
  if (!ruled) {
    const ruler = civ && sim.realms.ruler(civ);
    const P = (ruler && ruler.personality) || {};
    c += add('c', ((P.temper ?? 0.5) - 0.5) * 0.22, 'the ruler\'s temper');
    c += add('c', -((P.kindness ?? 0.5) - 0.5) * 0.3, 'the ruler\'s kindness');
    const T = ruler ? traitsOf(ruler) : [];
    if (T.includes('grasping')) g += add('g', 0.08, 'a grasping ruler');
  }
  // The commander in the field.
  const cm = ctx.commander || null;
  if (cm) {
    const P = cm.personality || {};
    const T = traitsOf(cm);
    c += add('c', ((P.temper ?? 0.5) - 0.5) * 0.24, 'the commander\'s temper');
    c += add('c', -((P.kindness ?? 0.5) - 0.5) * 0.24, 'the commander\'s kindness');
    if (T.includes('merciful')) c += add('c', -0.14, 'a merciful commander');
    if (T.includes('stern')) c += add('c', 0.05, 'a stern commander');
    if (T.includes('grasping')) g += add('g', 0.1, 'a grasping commander');
    if (T.includes('honest')) g += add('g', -0.06, 'an honest commander');
  }
  // What's gone before.
  if (ctx.days) c += add('c', Math.min(0.15, ctx.days * 0.015), `${ctx.days} days before the walls`);
  if (ctx.failed) c += add('c', Math.min(0.18, ctx.failed * 0.06), 'assaults beaten back with heavy losses');
  if (ctx.refused) c += add('c', 0.1, 'terms refused');
  // A player ruler's decree: the realm's armies behave as they're told.
  if (conduct === 'mercy') {
    c = Math.min(c * 0.25, 0.12);
    g = Math.min(g * 0.4, 0.2);
    why.push({ axis: 'c', v: 0, text: 'the ruler\'s decree: show mercy' });
  } else if (conduct === 'plunder') {
    g = Math.max(g, 0.72);
    c = clamp(c, 0.15, 0.42);
    why.push({ axis: 'g', v: 0, text: 'the ruler\'s decree: plunder, but no killing' });
  } else if (conduct === 'ruthless') {
    c = Math.max(c, 0.86);
    g = Math.max(g, 0.7);
    why.push({ axis: 'c', v: 0, text: 'the ruler\'s decree: no quarter' });
  }
  // A player's word in the field, there and then (their soldiers mostly
  // heed it: a little of their own temper comes through all the same).
  const word = ctx.word || null;
  if (word === 'spare') {
    c = Math.min(c, 0.1 + Math.max(0, c - 0.6) * 0.3);
    g = Math.min(g, 0.25);
  } else if (word === 'loot') {
    g = Math.max(g, 0.7);
    c = Math.min(c, 0.4);
  } else if (word === 'free') {
    c = Math.max(c, 0.62);
    g = Math.max(g, 0.75);
  }
  c = clamp(c, 0, 1);
  g = clamp(g, 0, 1);
  const score = Math.max(c, g * 0.82);
  const level = score < 0.3 ? 'orderly' : score < 0.5 ? 'plunder' : c < 0.74 ? 'sack' : 'massacre';
  return { c: Math.round(c * 100) / 100, g: Math.round(g * 100) / 100, level, why: why.sort((p, q) => Math.abs(q.v) - Math.abs(p.v)), conduct, word };
}

// What it comes to, in a town of `pop`: how much of the coin and stores
// are carried off, how many fires, how many of the townsfolk killed, and
// whether the garrison's spared.
export function sackOf(b, pop) {
  const loot = clamp(0.08 + b.g * 0.55, 0, 0.7);
  const stores = clamp(b.g * 0.6, 0, 0.65);
  const fires = Math.round(b.c < 0.3 ? 0 : (b.c - 0.25) * 9);
  const killed = b.c < 0.55 ? 0 : Math.round(pop * (b.c - 0.55) * 0.26);
  const quarter = b.c < 0.86;
  const flee = b.level === 'sack' || b.level === 'massacre';
  return { loot, stores, fires, killed, quarter, flee };
}
