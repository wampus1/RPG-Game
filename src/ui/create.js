// The character screen: who you'll be before a new game starts, in four
// tabs: the basics (name, origin, starting gear), looks, stats and traits
// (what you're good at, and your flaws). Everything can be changed with the
// mouse (click the tabs, arrows and boxes) or the keys: 1-4 or Tab switch
// tabs, ↑↓ pick a line, ←→ change it, and you type to edit your name. A tab
// longer than the screen scrolls (the wheel, the arrows on its bar, or just
// moving down it).
//
// (Round 63) A world's mods can change it (see mod/chargen.js): tabs of
// their own (a choice of one, of several, points to spend, words to write),
// the game's tabs renamed, moved or taken away, rows of them taken away,
// more rows on them, and more origins, starting gear and traits.
import { COLS, ROWS } from '../config.js';
import { Window, cap } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS } from '../world/items.js';
import { CULTURES } from '../world/names.js';
import { humanoidSheet, SHEET_H, SPR_PAD, toCanvas } from '../render/sprites.js';
import { drawWing, wingInFront } from '../render/wing.js';
import { Px } from '../render/pixel.js';
import {
  STATS, STAT_BASE, STAT_MAX, TRAITS, traitPicks, goodTraits, ORIGINS, KITS, SKINS, HAIRS, HAIR_STYLES, CLOTHES, PANTS, SHOES,
  DETAILS, HATS, PATTERNS, OUTFITS, pointsLeft, randomHero, heroName, hpBonus, COMMON_KIT,
  EYES, BEARD_STYLES, MARKS, NECKS, GLOVES, CAPES,
} from '../game/hero.js';
import { charGenOf, tabsOf, defaultPicks, chosenEffects, cleanPicks } from '../mod/chargen.js';
import { assetPixels } from '../mod/format.js';

const cycle = (list, v, d) => list[(list.indexOf(v) + d + list.length) % list.length];
// (Origins and gear: the game's and the mods', each known by its key.)
const keyOf = (o) => (o ? o.mod || o.game : null);
const cycleOf = (list, v, d) => list[(list.findIndex((o) => keyOf(o) === keyOf(v)) + d + list.length) % list.length];
const DETAIL_NAMES = { null: 'none', mustache: 'moustache', freckles: 'freckles', glasses: 'glasses', earring: 'earrings', scar: 'a scar', eyepatch: 'an eyepatch' };
const OUTFIT_NAMES = { plain: 'plain shirt', vest: 'waistcoat', hunter: 'hunter\'s tunic', plaid: 'plaid shirt', noble: 'fine doublet', apron: 'apron', fisher: 'fisher\'s vest', farmer: 'overalls', tunic: 'belted tunic', traveller: 'travelling coat', robe_blue: 'blue robe', robe_green: 'green robe', robe_white: 'white robe' };
const MARK_NAMES = { null: 'none', warpaint: 'war paint', tattoo: 'inked teardrop', blush: 'rosy cheeks', mole: 'a mole', stripes: 'red stripes' };
const HAT_NAMES = { null: 'none', straw: 'straw hat', cap: 'cap', beret: 'beret', bandana: 'bandana', wide: 'wide brim', feather: 'feathered hat', scarf: 'head scarf', flower: 'a flower', hood: 'hood', fur: 'fur hat', tricorn: 'tricorn', wreath: 'leaf wreath' };
const EYE_NAMES = { '#1e1a28': 'dark', '#4a2e1a': 'brown', '#6a5a2a': 'hazel', '#3a6a3a': 'green', '#3a5a9a': 'blue', '#7a8090': 'grey', '#a87a2a': 'amber' };
export const TABS = [
  { id: 'basics', name: 'BASICS' },
  { id: 'looks', name: 'LOOKS' },
  { id: 'stats', name: 'STATS' },
  { id: 'traits', name: 'TRAITS' },
];
const STAT_NAMES = { str: 'strength', agi: 'agility', end: 'endurance', cha: 'charm' };

// A mod's thing by its name in the mod ('@id'), or the game's.
function thingName(mod, r) {
  if (typeof r !== 'string') return '?';
  if (r[0] === '@') {
    const e = mod && mod.entities ? mod.entities[r.slice(1)] : null;
    return e ? e.title || e.name : r.slice(1);
  }
  return ITEMS[r]?.name || r;
}

// What an option gives, in words.
export function effectsText(mod, e) {
  if (!e) return '';
  const out = [];
  const items = (Array.isArray(e.items) ? e.items : []).filter((q) => q && q[0]).map(([it, n]) => `${n > 1 ? `${n} ` : ''}${thingName(mod, it)}`);
  if (e.coins) items.push(`¤${e.coins}`);
  if (items.length) out.push(`Gives ${items.join(', ')}.`);
  const st = Object.entries(e.stats || {}).filter(([, v]) => v).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${STAT_NAMES[k] || k}`);
  if (st.length) out.push(`${st.join(', ')}.`);
  if (e.hp) out.push(`${e.hp > 0 ? '+' : ''}${e.hp} health.`);
  const tr = (e.traits || []).filter((k) => TRAITS[k]).map((k) => TRAITS[k].name);
  if (tr.length) out.push(`Trait${tr.length > 1 ? 's' : ''}: ${tr.join(', ')}.`);
  if (e.companion) out.push(`A companion: ${thingName(mod, e.companion)}.`);
  if (e.effect) out.push(e.effectMins ? `An effect for ${e.effectMins} minutes.` : 'An effect, for good.');
  if (e.start) out.push(e.start === 'spawn' ? 'Begins where the world map says.' : 'Begins somewhere of its own.');
  return out.join(' ');
}

// A piece of a mod's art, as big as fits a box `w` x `h` pixels (kept).
const ART = new Map();
function artCanvas(mod, id, w = 48, h = 48) {
  const k = `${mod.id}:${id}:${mod.rev || 0}:${w}x${h}`;
  if (ART.has(k)) return ART.get(k);
  let out = null;
  try {
    const pix = assetPixels(mod, id, 0, null, null);
    if (pix) {
      const p = new Px(pix.w, pix.h);
      p.d.set(pix.d);
      const src = toCanvas(p);
      const s = Math.max(1, Math.floor(Math.min(w / pix.w, h / pix.h)));
      out = document.createElement('canvas');
      out.width = pix.w * s;
      out.height = pix.h * s;
      const cx = out.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.drawImage(src, 0, 0, out.width, out.height);
    }
  } catch {
    out = null;
  }
  if (ART.size > 200) ART.clear();
  ART.set(k, out);
  return out;
}

export class CharacterWindow extends Window {
  constructor(ui, seed, onDone, mods = []) {
    super(ui, COLS, ROWS, { kind: 'create', x: 0, y: 0 });
    this.seed = seed;
    this.onDone = onDone;
    this.rolls = 0;
    this.setMods(mods);
    this.hero = this.fresh(randomHero((seed ^ Date.now()) >>> 0));
    this.tab = 0;
    this.sel = 0;
    this.scroll = 0;
    this.rows = this.makeRows();
  }

  // The mods that change the screen (the Workshop's preview changes them as
  // they're made).
  setMods(mods) {
    this.mods = mods || [];
    this.cg = charGenOf(this.mods);
    const t = tabsOf(this.cg);
    this.tabs = t.length ? t : [{ id: 'basics', game: 'basics', name: 'BASICS', order: 0 }];
    if (this.hero) {
      this.fresh(this.hero);
      this.rows = this.makeRows();
      this.tab = Math.min(this.tab, this.tabs.length - 1);
      this.sel = Math.min(this.sel, Math.max(0, this.tabRows.length - 1));
    }
  }

  // A character as the mods allow: their choices to begin with, and none of
  // what they've taken away.
  fresh(h) {
    const cg = this.cg;
    h.modPicks = defaultPicks(cg, h.modPicks || {});
    h.modTraits = (h.modTraits || []).filter((k) => cg.traits.some((q) => q.key === k));
    if (h.modOrigin && !cg.origins.some((q) => q.key === h.modOrigin)) h.modOrigin = null;
    if (h.modKit && !cg.kits.some((q) => q.key === h.modKit)) h.modKit = null;
    if (!h.modOrigin && cg.hideRows.has(`origin:${h.origin}`)) this.setOrigin(this.origins()[0], h);
    if (!h.modKit && cg.hideRows.has(`kit:${h.kit}`)) this.setKit(this.kits()[0], h);
    h.traits = h.traits.filter((k) => !cg.hideRows.has(`trait:${k}`));
    return h;
  }

  // ------------------------------------------------------------ origins, kits
  origins() {
    const cg = this.cg;
    const list = [
      ...Object.keys(ORIGINS).filter((k) => !cg.hideRows.has(`origin:${k}`)).map((k) => ({ game: k, name: ORIGINS[k].name, about: ORIGINS[k].about })),
      ...cg.origins.map((o) => ({ mod: o.key, as: ORIGINS[o.as] ? o.as : 'crash', name: String(o.name || 'An origin'), about: [o.about, effectsText(o.mod, o.effects)].filter(Boolean).join(' '), art: o.art ? [o.mod, o.art] : null })),
    ];
    return list.length ? list : [{ game: 'crash', name: ORIGINS.crash.name, about: ORIGINS.crash.about }];
  }

  originNow(h = this.hero) {
    const L = this.origins();
    return L.find((o) => (h.modOrigin ? o.mod === h.modOrigin : !o.mod && o.game === h.origin)) || L[0];
  }

  setOrigin(o, h = this.hero) {
    if (!o) return;
    h.modOrigin = o.mod || null;
    h.origin = o.mod ? o.as : o.game;
  }

  kits() {
    const cg = this.cg;
    const list = [
      ...Object.keys(KITS).filter((k) => !cg.hideRows.has(`kit:${k}`)).map((k) => ({ game: k, name: KITS[k].name })),
      ...cg.kits.map((o) => ({ mod: o.key, name: String(o.name || 'Starting gear'), o, art: o.art ? [o.mod, o.art] : null })),
    ];
    return list.length ? list : [{ game: 'wanderer', name: KITS.wanderer.name }];
  }

  kitNow(h = this.hero) {
    const L = this.kits();
    return L.find((o) => (h.modKit ? o.mod === h.modKit : !o.mod && o.game === h.kit)) || L[0];
  }

  setKit(o, h = this.hero) {
    if (!o) return;
    h.modKit = o.mod || null;
    if (!o.mod) h.kit = o.game;
  }

  makeRows() {
    const h = () => this.hero;
    const cg = this.cg;
    const look = (k, list) => ({ get: () => h().look[k], set: (d) => { h().look[k] = cycle(list, h().look[k], d); } });
    const pickOf = (k, list, names) => ({ show: () => (names ? names[h().look[k]] : h().look[k]) || 'none', set: (d) => { h().look[k] = cycle(list, h().look[k] ?? null, d); } });
    // (A colour, or none at all.)
    const orNone = (k, list) => ({ get: () => h().look[k] || null, set: (d) => { h().look[k] = cycle(list, h().look[k] ?? null, d); } });
    const beards = [null, ...BEARD_STYLES];
    const rows = [
      { tab: 'basics', id: 'name', label: 'Name', type: 'name', about: 'Type to change your name. ←/→ picks another.' },
      { tab: 'basics', id: 'nameStyle', label: 'Names from', type: 'cycle', show: () => (h().nameStyle ? CULTURES[h().nameStyle].label : 'anywhere'), set: (d) => { h().nameStyle = cycle([null, ...Object.keys(CULTURES)], h().nameStyle ?? null, d); }, about: 'Which people\'s names ←/→ on your name picks from.' },
      { tab: 'basics', id: 'origin', label: 'Origin', type: 'cycle', show: () => this.originNow().name, set: (d) => { this.setOrigin(cycleOf(this.origins(), this.originNow(), d)); }, about: () => this.originNow().about, art: () => this.originNow().art },
      { tab: 'basics', id: 'kit', label: 'Starting gear', type: 'cycle', show: () => this.kitNow().name, set: (d) => { this.setKit(cycleOf(this.kits(), this.kitNow(), d)); }, about: () => this.kitText(), art: () => this.kitNow().art },
      { tab: 'looks', id: 'skin', label: 'Skin', type: 'swatch', ...look('skin', SKINS) },
      { tab: 'looks', id: 'eyeColor', label: 'Eyes', type: 'swatch', ...look('eyeColor', EYES), name: (c) => EYE_NAMES[c] || c },
      { tab: 'looks', id: 'hair', label: 'Hair colour', type: 'swatch', ...look('hair', HAIRS) },
      { tab: 'looks', id: 'hairStyle', label: 'Hair style', type: 'cycle', ...pickOf('hairStyle', HAIR_STYLES) },
      { tab: 'looks', id: 'beard', label: 'Beard', type: 'cycle', show: () => (h().look.beard ? h().look.beardStyle || 'full' : 'none'), set: (d) => { const n = cycle(beards, h().look.beard ? h().look.beardStyle || 'full' : null, d); h().look.beard = !!n; if (n) h().look.beardStyle = n; } },
      { tab: 'looks', id: 'acc', label: 'Face', type: 'cycle', ...pickOf('acc', DETAILS, DETAIL_NAMES) },
      { tab: 'looks', id: 'mark', label: 'Marks', type: 'cycle', ...pickOf('mark', MARKS, MARK_NAMES), about: 'Paint, ink or a mark of your own on your face.' },
      { tab: 'looks', id: 'hat', label: 'Hat', type: 'cycle', ...pickOf('hat', HATS, HAT_NAMES) },
      { tab: 'looks', id: 'outfit', label: 'Clothes', type: 'cycle', ...pickOf('outfit', OUTFITS, OUTFIT_NAMES) },
      { tab: 'looks', id: 'shirt', label: 'Shirt colour', type: 'swatch', ...look('shirt', CLOTHES) },
      { tab: 'looks', id: 'pattern', label: 'Pattern', type: 'cycle', ...pickOf('pattern', PATTERNS) },
      { tab: 'looks', id: 'neck', label: 'Kerchief', type: 'swatch', ...orNone('neck', NECKS), about: 'A kerchief knotted at your neck.' },
      { tab: 'looks', id: 'cape', label: 'Cloak', type: 'swatch', ...orNone('cape', CAPES), about: 'A cloak over your shoulders (best seen from behind).' },
      { tab: 'looks', id: 'gloves', label: 'Gloves', type: 'swatch', ...orNone('gloves', GLOVES) },
      { tab: 'looks', id: 'pants', label: 'Trousers', type: 'swatch', ...look('pants', PANTS) },
      { tab: 'looks', id: 'shoes', label: 'Shoes', type: 'swatch', ...look('shoes', SHOES) },
      { tab: 'looks', id: 'accent', label: 'Accent', type: 'swatch', ...look('accent', CLOTHES), about: 'The colour of trims, sashes and some hats.' },
      { tab: 'looks', id: 'stoop', label: 'Stance', type: 'cycle', show: () => (h().look.stoop ? 'stooped' : 'upright'), set: () => { h().look.stoop = !h().look.stoop; } },
    ].filter((r) => r.id === 'name' || !cg.hideRows.has(r.id));
    for (const s of STATS) rows.push({ tab: 'stats', id: `stat:${s.key}`, label: s.name, type: 'stat', key: s.key, about: s.about });
    // (The good ones first, then the flaws: the game's, then the mods'.)
    const keys = Object.keys(TRAITS).filter((k) => !cg.hideRows.has(`trait:${k}`));
    const mine = (flaw) => cg.traits.filter((t) => !!t.flaw === flaw).map((t) => ({ tab: 'traits', id: `trait:${t.key}`, label: String(t.name || 'A trait'), type: 'trait', key: t.key, mt: true, flaw, about: [t.about, effectsText(t.mod, t.effects)].filter(Boolean).join(' '), art: t.art ? () => [t.mod, t.art] : null }));
    const gameT = (k) => ({ tab: 'traits', id: `trait:${k}`, label: TRAITS[k].name, type: 'trait', key: k, flaw: !!TRAITS[k].flaw, about: TRAITS[k].about });
    rows.push(...keys.filter((q) => !TRAITS[q].flaw).map(gameT), ...mine(false), ...keys.filter((q) => TRAITS[q].flaw).map(gameT), ...mine(true));
    // The mods' more on the game's tabs, and their own tabs.
    for (const g of Object.keys(cg.extra)) for (const r of cg.extra[g]) rows.push(...this.modRows(g, r));
    for (const t of cg.tabs) for (const r of t.rows) rows.push(...this.modRows(t.id, r));
    return rows;
  }

  // A row of a mod's, as lines on the screen: a choice of one (a line to
  // turn), of several (a box each), points (a line each), or words.
  modRows(tab, r) {
    const P = () => (this.hero.modPicks ||= {});
    const opts = r.options || [];
    const about = (o) => [o.about, effectsText(r.mod, o.effects)].filter(Boolean).join(' ');
    const label = String(r.label || 'Choice');
    if (r.kind === 'pick') {
      const cur = () => opts.find((o) => o.id === P()[r.key]) || null;
      return [{
        tab, id: r.key, label, type: 'cycle', mod: r,
        show: () => (cur() ? cur().name || '?' : 'none'),
        set: (d) => {
          if (opts.length) P()[r.key] = cycle(opts.map((o) => o.id), P()[r.key], d);
        },
        about: () => [r.about, cur() ? about(cur()) : ''].filter(Boolean).join(' ') || 'Pick one (←/→).',
        art: () => (cur() && cur().art ? [r.mod, cur().art] : null),
      }];
    }
    if (r.kind === 'text') return [{ tab, id: r.key, label, type: 'text', mod: r, about: r.about || 'Type here.' }];
    if (r.kind === 'many') return opts.map((o) => ({ tab, id: `${r.key}/${o.id}`, label: String(o.name || '?'), type: 'many', mod: r, opt: o, about: about(o) || r.about || '', art: o.art ? () => [r.mod, o.art] : null }));
    if (r.kind === 'points') return (r.entries || []).map((en) => ({ tab, id: `${r.key}/${en.id}`, label: String(en.name || '?'), type: 'point', mod: r, entry: en, about: [en.about, en.effects ? `Each point: ${effectsText(r.mod, en.effects)}` : ''].filter(Boolean).join(' ') || r.about || '' }));
    return [];
  }

  // The lines on the tab you're looking at.
  get tabRows() {
    const t = this.tabs[this.tab];
    const id = t ? t.id : 'basics';
    return this.rows.filter((r) => r.tab === id);
  }

  setTab(i) {
    this.tab = (i + this.tabs.length) % this.tabs.length;
    this.sel = 0;
    this.scroll = 0;
    this.note = null;
    this.ui.audio?.play('select');
  }

  // A tab by its id (the Workshop's preview, showing the tab being made).
  showTab(id, row = null) {
    const i = this.tabs.findIndex((t) => t.id === id);
    if (i < 0) return;
    if (i !== this.tab) {
      this.tab = i;
      this.scroll = 0;
    }
    const j = row ? this.tabRows.findIndex((r) => r.id === row || (r.mod && r.mod.key === row)) : -1;
    this.sel = j >= 0 ? j : Math.min(this.sel, Math.max(0, this.tabRows.length - 1));
    this.follow = true;
  }

  // A list too long for the screen: `V` of its `n` lines show, from
  // this.scroll (kept on the line you're on when you move with the keys).
  scrolled(n, V) {
    const top = Math.max(0, n - V);
    if (this.follow) {
      if (this.sel < this.scroll) this.scroll = this.sel;
      else if (this.sel >= this.scroll + V) this.scroll = this.sel - V + 1;
      this.follow = false;
    }
    this.scroll = Math.max(0, Math.min(top, this.scroll));
    this.view = { n, V };
    return this.scroll;
  }

  // Its bar, down the right of the list: arrows to click at either end, the
  // thumb showing where you are in it.
  scrollbar(g, x, y0, H, n, V) {
    if (n <= V) return;
    const top = n - V;
    for (let y = y0; y < y0 + H; y++) g.text(x, y, '│', C.faint);
    const th = Math.max(2, Math.round((H * V) / n));
    const ty = y0 + Math.round(((H - th) * this.scroll) / top);
    for (let y = ty; y < ty + th; y++) g.text(x, y, '█', C.dim);
    g.text(x, y0 - 1, '▲', this.scroll > 0 ? C.hi : C.faint);
    g.text(x, y0 + H, '▼', this.scroll < top ? C.hi : C.faint);
    this.hit(x, y0 - 1, 1, 1, () => this.onWheel(-1));
    this.hit(x, y0 + H, 1, 1, () => this.onWheel(1));
    this.hit(x, y0, 1, H, (ck, game, cx, cy) => this.onWheel(cy === undefined ? 1 : cy < ty ? -V : cy >= ty + th ? V : 0));
    if (this.scroll < top) g.text(x - 9, y0 + H, 'more ▼', C.faint);
  }

  onWheel(d) {
    if (!this.view || !d) return;
    this.scroll = Math.max(0, Math.min(this.view.n - this.view.V, this.scroll + Math.round(d)));
  }

  kitText() {
    const kn = this.kitNow();
    const all = new Map();
    let coins = 0;
    if (kn.mod) {
      const e = kn.o.effects || {};
      for (const [it, n] of Array.isArray(e.items) ? e.items : []) if (it) all.set(thingName(kn.o.mod, it), (all.get(thingName(kn.o.mod, it)) || 0) + (n || 1));
      coins = e.coins | 0;
    } else {
      const k = KITS[kn.game];
      for (const [it, n] of k.items) all.set(ITEMS[it]?.name || it, (all.get(ITEMS[it]?.name || it) || 0) + n);
      coins = k.coins;
    }
    for (const [it, n] of COMMON_KIT) all.set(ITEMS[it]?.name || it, (all.get(ITEMS[it]?.name || it) || 0) + n);
    const names = [...all].map(([nm, n]) => `${n > 1 ? `${n} ` : ''}${nm}`);
    const more = kn.mod ? effectsText(kn.o.mod, { ...kn.o.effects, items: null, coins: 0 }) : '';
    return `${kn.mod && kn.o.about ? `${kn.o.about} ` : ''}${names.join(', ')}${coins ? `, and ¤${coins}` : ''}.${more ? ` ${more}` : ''}`;
  }

  // How many good traits you have, and may have (the mods' counted too).
  traitCount() {
    const h = this.hero;
    const cg = this.cg;
    const mt = (h.modTraits || []).map((k) => cg.traits.find((q) => q.key === k)).filter(Boolean);
    return { good: goodTraits(h).length + mt.filter((t) => !t.flaw).length, picks: traitPicks(h) + mt.filter((t) => t.flaw).length, flaws: (h.traits.length - goodTraits(h).length) + mt.filter((t) => t.flaw).length };
  }

  // ←/→ (or a click on an arrow) on a line.
  change(row, d) {
    const h = this.hero;
    if (row.type === 'name') h.name = heroName((this.seed + ++this.rolls * 7919) >>> 0, h.nameStyle || null);
    else if (row.type === 'stat') {
      const v = h.stats[row.key];
      if (d > 0 && v < STAT_MAX && pointsLeft(h) > 0) h.stats[row.key]++;
      else if (d < 0 && v > 1) h.stats[row.key]--;
      else {
        this.ui.audio?.play('error');
        return;
      }
    } else if (row.type === 'trait' || row.type === 'many' || row.type === 'point') {
      const ok = row.type === 'trait' ? this.toggle(row) : row.type === 'many' ? this.toggleMany(row) : this.point(row, d);
      if (!ok) {
        this.ui.audio?.play('error');
        return;
      }
    } else if (row.type === 'text') return;
    else if (row.set) row.set(d);
    h.look.hatColor = h.look.accent;
    this.ui.audio?.play('select');
  }

  // On or off. You may have TRAIT_PICKS good traits, one more for each flaw
  // (as many flaws as you like). False if it can't be taken (all your picks
  // are used: take one off first, or a flaw).
  toggle(row) {
    const h = this.hero;
    const list = row.mt ? (h.modTraits ||= []) : h.traits;
    const i = list.indexOf(row.key);
    if (i >= 0) {
      list.splice(i, 1);
      // Dropping a flaw drops the pick it gave (the last good one taken).
      if (row.flaw) {
        while (this.traitCount().good > this.traitCount().picks) {
          const mods = (h.modTraits || []).filter((k) => this.cg.traits.find((q) => q.key === k && !q.flaw));
          if (mods.length) h.modTraits.splice(h.modTraits.lastIndexOf(mods.at(-1)), 1);
          else h.traits.splice(h.traits.lastIndexOf(goodTraits(h).at(-1)), 1);
        }
      }
      this.note = null;
      return true;
    }
    const c = this.traitCount();
    if (!row.flaw && c.good >= c.picks) {
      this.note = 'All your picks are used. Take one off, or take a flaw for another pick.';
      return false;
    }
    list.push(row.key);
    this.note = null;
    return true;
  }

  // One of several: on or off (no more than may be taken).
  toggleMany(row) {
    const r = row.mod;
    const P = (this.hero.modPicks ||= {});
    const list = Array.isArray(P[r.key]) ? P[r.key] : (P[r.key] = []);
    const i = list.indexOf(row.opt.id);
    if (i >= 0) {
      list.splice(i, 1);
      this.note = null;
      return true;
    }
    const max = r.max | 0 || (r.options || []).length;
    if (list.length >= max) {
      this.note = `You can pick ${max} of ${String(r.label || 'these').toLowerCase()}. Take one off first.`;
      return false;
    }
    list.push(row.opt.id);
    this.note = null;
    return true;
  }

  // A point on, or off.
  point(row, d) {
    const r = row.mod;
    const P = (this.hero.modPicks ||= {});
    const o = P[r.key] && typeof P[r.key] === 'object' && !Array.isArray(P[r.key]) ? P[r.key] : (P[r.key] = {});
    const v = o[row.entry.id] | 0;
    const left = (r.points | 0) - Object.values(o).reduce((a, b) => a + (b | 0), 0);
    const most = row.entry.max | 0 || r.points | 0;
    if (d > 0 && left > 0 && v < most) o[row.entry.id] = v + 1;
    else if (d < 0 && v > 0) o[row.entry.id] = v - 1;
    else {
      this.note = d > 0 ? (left > 0 ? `${row.label} can't go higher.` : 'No points left: take one from somewhere else.') : null;
      return false;
    }
    this.note = null;
    return true;
  }

  pointsLeftIn(r) {
    const o = (this.hero.modPicks || {})[r.key] || {};
    return (r.points | 0) - Object.values(o).reduce((a, b) => a + (b | 0), 0);
  }

  // What the mods' choices add to your stats and health (shown as you
  // choose; given when the game begins: see mod/chargen.js).
  modBonus() {
    const h = this.hero;
    h.modStats = {};
    h.modHp = 0;
    if (!this.cg.any) return;
    for (const { e, n } of chosenEffects(this.cg, h)) {
      for (const [s, v] of Object.entries(e.stats || {})) if (STAT_NAMES[s]) h.modStats[s] = (h.modStats[s] || 0) + (Number(v) || 0) * n;
      if (e.hp) h.modHp += (Number(e.hp) || 0) * n;
    }
  }

  draw(g) {
    const h = this.hero;
    this.modBonus();
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#0b0912');
    g.center(1, 'W H O   W I L L   Y O U   B E ?', C.hi);
    // Tabs (as many as fit: numbered while they do, then shortened).
    const n = this.tabs.length;
    const full = this.tabs.map((t, i) => ` ${i < 9 ? `${i + 1} ` : ''}${t.name} `);
    let labels = full;
    if (full.reduce((a, l) => a + l.length + 1, -1) > 51) {
      const each = Math.max(3, Math.floor((51 - (n - 1)) / n) - 2);
      labels = this.tabs.map((t) => ` ${t.name.slice(0, each)} `);
    }
    let tx = 2;
    this.tabs.forEach((t, i) => {
      const label = labels[i];
      const on = i === this.tab;
      const hov = this.hovering(tx, 3, label.length, 1);
      g.fill(tx, 3, label.length, 1, ' ', C.fg, on ? C.bgHi : hov ? '#3a3250' : '#1a1622');
      g.text(tx, 3, label, on ? C.hi : hov ? C.white : C.dim);
      this.hit(tx, 3, label.length, 1, () => this.setTab(i));
      tx += label.length + 1;
    });
    g.text(2, 4, '─'.repeat(51), C.faint);
    let hovAbout = null;
    const rows = this.tabRows;
    const rowAt = (r, x, y, w) => {
      const i = rows.indexOf(r);
      const hov = this.hovering(x, y, w, 1);
      if (hov) hovAbout = r;
      const sel = this.sel === i;
      g.fill(x, y, w, 1, ' ', C.fg, sel ? C.bgHi : hov ? 'rgba(60,52,80,0.9)' : undefined);
      return { sel, i };
    };
    const cyc = (r, y) => {
      const { sel, i } = rowAt(r, 2, y, 50);
      g.text(3, y, r.label.slice(0, 15), sel ? C.white : C.dim);
      const typed = r.type === 'name' || r.type === 'text';
      if (!typed || r.type === 'name') g.text(19, y, '◄', C.hi);
      if (r.type === 'swatch') {
        const c = r.get();
        if (c) {
          g.text(21, y, '███', c);
          g.text(25, y, r.name ? r.name(c) : c, C.faint);
        } else g.text(21, y, 'none', C.fg);
      } else if (typed) {
        const v = r.type === 'name' ? h.name : String((h.modPicks || {})[r.id] || '');
        const blink = sel && Math.floor(this.ui.time * 2) % 2 ? '_' : '';
        g.text(r.type === 'name' ? 21 : 19, y, `${v.slice(-26)}${blink}` || (sel ? '' : '…'), v || blink ? C.white : C.faint);
      } else g.text(21, y, cap(String(r.show())).slice(0, 25), C.fg);
      if (!typed || r.type === 'name') g.text(48, y, '►', C.hi);
      this.hit(19, y, 2, 1, () => {
        this.sel = i;
        if (!typed || r.type === 'name') this.change(r, -1);
      });
      this.hit(46, y, 4, 1, () => {
        this.sel = i;
        if (!typed || r.type === 'name') this.change(r, 1);
      });
      this.hit(2, y, 17, 1, () => {
        this.sel = i;
      });
      this.hit(21, y, 25, 1, () => {
        this.sel = i;
        if (!typed) this.change(r, 1);
      });
    };
    const t = this.tabs[this.tab] || this.tabs[0];
    const tab = t.game;
    if (tab === 'basics') {
      const R = (id) => rows.find((r) => r.id === id);
      let y = 6;
      for (const id of ['name', 'nameStyle']) if (R(id)) cyc(R(id), y++);
      y++;
      if (R('origin')) {
        cyc(R('origin'), y);
        wrap(this.originNow().about, 48).slice(0, 3).forEach((l, i) => g.text(4, y + 1 + i, l, C.faint));
        y += 5;
      }
      if (R('kit')) {
        cyc(R('kit'), y);
        wrap(this.kitText(), 48).slice(0, 3).forEach((l, i) => g.text(4, y + 1 + i, l, C.faint));
        y += 5;
      }
      // (The mods' more: a line each.)
      const more = rows.filter((r) => r.mod);
      for (const r of more) cyc(r, y++);
      if (more.length) y++;
      y = Math.max(20, y);
      if (y + 4 < this.h - 1) {
        g.text(3, y, 'Summary', C.cyan);
        g.text(4, y + 1, `Stats: ${STATS.map((s) => `${s.name.slice(0, 3)} ${h.stats[s.key] + (h.modStats[s.key] || 0)}`).join(' · ')}`.slice(0, 48), C.dim);
        const names = [...h.traits.map((k) => TRAITS[k].name), ...(h.modTraits || []).map((k) => this.cg.traits.find((q) => q.key === k)?.name).filter(Boolean)];
        wrap(`Traits: ${names.join(', ') || 'none'}`, 48).slice(0, 3).forEach((l, i) => g.text(4, y + 2 + i, l, C.dim));
      }
    } else if (tab === 'looks') {
      // (More than fits: it scrolls.)
      const V = Math.floor((this.h - 4 - 6) / 2) + 1;
      const s0 = this.scrolled(rows.length, V);
      rows.slice(s0, s0 + V).forEach((r, i) => cyc(r, 6 + i * 2));
      this.scrollbar(g, 52, 6, V * 2 - 1, rows.length, V);
    } else if (tab === 'stats') {
      const left = pointsLeft(h);
      g.text(3, 6, `${left} point${left === 1 ? '' : 's'} to spend`, left > 0 ? C.hi : C.faint);
      const stats = rows.filter((r) => r.type === 'stat');
      stats.forEach((r, j) => {
        const y = 8 + j * 3;
        const { sel, i } = rowAt(r, 2, y, 50);
        g.text(3, y, r.label, sel ? C.white : C.dim);
        g.text(19, y, '[-]', C.hi);
        const v = h.stats[r.key];
        for (let k = 0; k < STAT_MAX; k++) g.text(23 + k * 2, y, k < v ? '■' : '□', k < v ? (v > STAT_BASE && k >= STAT_BASE ? C.green : C.fg) : C.faint);
        g.text(34, y, '[+]', C.hi);
        // (What the mods' choices add.)
        const b = h.modStats[r.key] || 0;
        if (b) g.text(38, y, `${b > 0 ? '+' : ''}${b}`, b > 0 ? C.green : C.orange);
        g.text(4, y + 1, r.about.slice(0, 47), C.faint);
        this.hit(19, y, 3, 1, () => {
          this.sel = i;
          this.change(r, -1);
        });
        this.hit(34, y, 3, 1, () => {
          this.sel = i;
          this.change(r, 1);
        });
      });
      rows.filter((r) => r.type !== 'stat').forEach((r, j) => cyc(r, 9 + stats.length * 3 + j * 2));
    } else if (tab === 'traits') {
      // One list: the good traits, a line, then the flaws. It scrolls.
      const { good, picks, flaws } = this.traitCount();
      g.text(3, 6, `Good traits: ${good}/${picks}`, good < picks ? C.hi : C.fg);
      g.text(24, 6, `Flaws: ${flaws}`, flaws ? C.orange : C.faint);
      // (What's on the list: a heading, the good ones, the divider, the
      // flaws; and a mod's more after.)
      const lines = [{ head: `GOOD TRAITS  (pick up to ${picks})` }];
      rows.forEach((r, j) => {
        if (r.type === 'trait' && r.flaw && !lines.some((q) => q.divider)) lines.push({ divider: true });
        if (r.type !== 'trait' && !lines.some((q) => q.gap)) lines.push({ gap: true });
        lines.push({ r, j });
      });
      const y0 = 8;
      const V = this.h - y0 - 6;
      this.listScroll(lines, V);
      lines.slice(this.scroll, this.scroll + V).forEach((q, k) => {
        const y = y0 + k;
        if (q.head) {
          g.text(3, y, q.head, C.cyan);
          return;
        }
        if (q.divider) {
          const dt = ' FLAWS: each gives one more good pick ';
          g.text(2, y, `${'─'.repeat(3)}${dt}${'─'.repeat(Math.max(0, 47 - dt.length))}`, C.orange);
          return;
        }
        if (q.gap) return;
        const r = q.r;
        if (r.type !== 'trait') return cyc(r, y);
        const { sel, i } = rowAt(r, 2, y, 49);
        const on = (r.mt ? h.modTraits || [] : h.traits).includes(r.key);
        g.text(3, y, on ? '[x]' : '[ ]', on ? (r.flaw ? C.orange : C.green) : C.faint);
        g.text(7, y, r.label.slice(0, 18), sel ? C.white : on ? (r.flaw ? C.orange : C.fg) : r.flaw ? '#a87050' : C.dim);
        g.text(26, y, (typeof r.about === 'string' ? r.about : '').slice(0, 24) + ((r.about || '').length > 24 ? '…' : ''), C.faint);
        this.hit(2, y, 49, 1, () => {
          this.sel = i;
          this.change(r, 1);
        });
        return null;
      });
      this.scrollbar(g, 52, y0, V, lines.length, V);
      const cur = hovAbout || rows[this.sel];
      const yA = y0 + V + 1;
      if (this.note) wrap(this.note, 48).slice(0, 2).forEach((l, i) => g.text(3, yA + i, l, C.orange));
      else if (cur) {
        g.text(3, yA, cur.label, cur.flaw ? C.orange : C.cyan);
        wrap(typeof cur.about === 'function' ? cur.about() : cur.about || '', 48).slice(0, 2).forEach((l, i) => g.text(3, yA + 1 + i, l, C.dim));
      }
    } else this.drawModTab(g, t, rows, rowAt, cyc);

    // The preview, and what the line you're on does.
    const px = 56;
    g.box(px - 1, 3, 29, 16, { fg: C.faint, bg: '#141020' });
    g.center(4, h.name.toUpperCase(), C.hi, undefined, px, 27);
    this.previewAt = { x: px + 9, y: 6 };
    const hp = 20 + hpBonus(h);
    g.text(px + 1, 17, `Health ${hp}`, C.red);
    g.text(px + 13, 17, this.originNow().name.slice(0, 13), C.cyan);
    const cur = hovAbout || rows[this.sel];
    // (A mod's picture for what's chosen there.)
    const art = cur && cur.art ? cur.art() : null;
    const pic = art && art[0] && art[1] ? artCanvas(art[0], art[1]) : null;
    if (pic) g.image(px + 18, 6, pic, 0, 0);
    this.previewAt.x = pic ? px + 4 : px + 9;
    const about = cur && (typeof cur.about === 'function' ? cur.about() : cur.about);
    g.box(px - 1, 19, 29, 8, { fg: C.faint, bg: '#0b0912' });
    if (about) wrap(about, 25).slice(0, 6).forEach((l, i) => g.text(px + 1, 20 + i, l, C.dim));
    // Buttons.
    const btn = (y, label, fn, col = C.fg) => {
      const hov = this.hovering(px - 1, y, 29, 1);
      g.fill(px - 1, y, 29, 1, ' ', C.fg, hov ? C.bgHi : 'rgba(26,22,34,0.95)');
      g.text(px + 1, y, label, hov ? C.white : col);
      this.hit(px - 1, y, 29, 1, fn);
    };
    btn(28, '[ENTER]  Begin', () => this.begin(), C.hi);
    btn(30, '[0]      Randomise', () => this.randomise());
    btn(32, '[ESC]    Back', () => this.close());
    g.text(2, this.h - 1, `1-${Math.min(9, n)}/TAB switch tab · ↑↓ choose · ←→ change · type to rename`, C.faint);
  }

  // A list's scroll kept on the line you're on, when you move with the
  // keys (a heading above it shows too).
  listScroll(lines, V) {
    const at = lines.findIndex((q) => q.r && q.j === this.sel);
    if (this.follow) {
      if (at < this.scroll + 1) this.scroll = Math.max(0, at - 1);
      else if (at >= this.scroll + V) this.scroll = at - V + 1;
      this.follow = false;
    }
    this.scroll = Math.max(0, Math.min(Math.max(0, lines.length - V), this.scroll));
    this.view = { n: lines.length, V };
  }

  // A mod's own tab: what it's about, then its rows (each a line to turn,
  // boxes to tick, points to spend, or words), scrolling if they're many.
  drawModTab(g, t, rows, rowAt, cyc) {
    const h = this.hero;
    const about = t.tab && t.tab.about ? wrap(t.tab.about, 49).slice(0, 2) : [];
    about.forEach((l, i) => g.text(3, 6 + i, l, C.faint));
    const y0 = about.length ? 9 : 6;
    const lines = [];
    let last = null;
    rows.forEach((r, j) => {
      if (r.mod !== last) {
        last = r.mod;
        if (lines.length) lines.push({ gap: true });
        if (r.type === 'many' || r.type === 'point') lines.push({ head: r.mod });
      }
      lines.push({ r, j });
    });
    if (!lines.length) g.text(3, y0, 'Nothing to choose here yet.', C.faint);
    const V = this.h - y0 - 4;
    this.listScroll(lines, V);
    lines.slice(this.scroll, this.scroll + V).forEach((q, k) => {
      const y = y0 + k;
      if (q.gap) return;
      if (q.head) {
        const r = q.head;
        g.text(3, y, String(r.label || '').toUpperCase().slice(0, 30), C.cyan);
        if (r.kind === 'many') {
          const max = r.max | 0 || (r.options || []).length;
          g.text(35, y, `pick ${max >= (r.options || []).length ? 'any' : `up to ${max}`}`, C.faint);
        } else {
          const left = this.pointsLeftIn(r);
          g.text(35, y, `${left} to spend`, left > 0 ? C.hi : C.faint);
        }
        return;
      }
      const r = q.r;
      if (r.type === 'cycle' || r.type === 'text') return cyc(r, y);
      const { sel, i } = rowAt(r, 2, y, 49);
      if (r.type === 'many') {
        const on = ((h.modPicks || {})[r.mod.key] || []).includes(r.opt.id);
        g.text(3, y, on ? '[x]' : '[ ]', on ? C.green : C.faint);
        g.text(7, y, r.label.slice(0, 18), sel ? C.white : on ? C.fg : C.dim);
        const ab = typeof r.about === 'string' ? r.about : '';
        g.text(26, y, ab.slice(0, 24) + (ab.length > 24 ? '…' : ''), C.faint);
        this.hit(2, y, 49, 1, () => {
          this.sel = i;
          this.change(r, 1);
        });
        return null;
      }
      // (Points: a box for each that can go on it.)
      const v = ((h.modPicks || {})[r.mod.key] || {})[r.entry.id] | 0;
      const most = Math.min(10, r.entry.max | 0 || r.mod.points | 0);
      g.text(3, y, r.label.slice(0, 15), sel ? C.white : C.dim);
      g.text(19, y, '[-]', C.hi);
      for (let k2 = 0; k2 < most; k2++) g.text(23 + k2 * 2, y, k2 < v ? '■' : '□', k2 < v ? C.green : C.faint);
      g.text(24 + most * 2, y, '[+]', C.hi);
      this.hit(19, y, 3, 1, () => {
        this.sel = i;
        this.change(r, -1);
      });
      this.hit(24 + most * 2, y, 3, 1, () => {
        this.sel = i;
        this.change(r, 1);
      });
      this.hit(2, y, 17, 1, () => {
        this.sel = i;
      });
      return null;
    });
    this.scrollbar(g, 52, y0, V, lines.length, V);
    if (this.note) wrap(this.note, 48).slice(0, 2).forEach((l, i) => g.text(3, this.h - 3 + i, l, C.orange));
  }

  drawPixels(ctx) {
    if (!this.previewAt) return;
    const sheet = humanoidSheet(this.hero.look);
    const dir = Math.floor(this.ui.time * 0.8) % 4;
    const row = [0, 3, 2, 1][dir];
    const f = Math.floor(this.ui.time * 4) % 3;
    const s = 3;
    const x = (this.x + this.previewAt.x) * 6;
    const y = (this.y + this.previewAt.y) * 8 - SPR_PAD;
    ctx.imageSmoothingEnabled = false;
    // (A fallen star: the wing too, behind, or in front seen from behind.)
    const wing = this.hero.origin === 'star';
    const wingAt = () => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      drawWing(ctx, row, 0, SPR_PAD, 1, this.ui.time);
      ctx.restore();
    };
    if (wing && !wingInFront(row)) wingAt();
    ctx.drawImage(sheet, f * 16, row * SHEET_H, 16, SHEET_H, x, y, 16 * s, SHEET_H * s);
    if (wing && wingInFront(row)) wingAt();
  }

  randomise() {
    const { name, nameStyle } = this.hero;
    // (What you've written stays.)
    const words = {};
    for (const r of this.rows) if (r.type === 'text') words[r.id] = (this.hero.modPicks || {})[r.id] || '';
    this.hero = randomHero((this.seed + ++this.rolls * 104729 + Date.now()) >>> 0);
    this.hero.name = name;
    this.hero.nameStyle = nameStyle;
    this.hero.modPicks = words;
    this.fresh(this.hero);
    // (The mods' choices too: any of their origins and gear, and each of
    // their rows.)
    const h = this.hero;
    const any = (L) => L[Math.floor(Math.random() * L.length)];
    if (this.cg.origins.length) this.setOrigin(any(this.origins()));
    if (this.cg.kits.length) this.setKit(any(this.kits()));
    const P = h.modPicks;
    for (const r of [...this.cg.tabs.flatMap((t) => t.rows), ...Object.values(this.cg.extra).flat()]) {
      const ids = (r.options || []).map((o) => o.id);
      if (r.kind === 'pick' && ids.length) P[r.key] = any(ids);
      else if (r.kind === 'many') P[r.key] = ids.filter(() => Math.random() < 0.4).slice(0, r.max | 0 || ids.length);
      else if (r.kind === 'points') {
        const o = {};
        const en = r.entries || [];
        for (let k = 0; k < (r.points | 0) && en.length; k++) {
          const e = any(en);
          if (!(e.max | 0) || (o[e.id] | 0) < (e.max | 0)) o[e.id] = (o[e.id] | 0) + 1;
        }
        P[r.key] = o;
      }
    }
    this.ui.audio?.play('craft');
  }

  begin() {
    const h = this.hero;
    if (!h.name.trim()) h.name = heroName(this.seed, null);
    h.name = h.name.trim().slice(0, 16);
    h.look.hatColor = h.look.accent;
    if (this.cg.any) cleanPicks(this.cg, h);
    else {
      delete h.modPicks;
      delete h.modTraits;
      delete h.modOrigin;
      delete h.modKit;
    }
    delete h.modStats;
    delete h.modHp;
    this.ui.audio?.play('coin');
    this.close();
    this.onDone(JSON.parse(JSON.stringify(h)));
  }

  onKey(k) {
    const rows = this.tabRows;
    const row = rows[this.sel];
    const n = rows.length;
    const digit = /^Digit([0-9])$/.exec(k.code);
    if (k.code === 'Escape') this.close();
    else if (k.code === 'Enter') this.begin();
    else if (k.code === 'Tab') this.setTab(this.tab + (k.shift ? -1 : 1));
    // (Words of a mod's row: anything typed goes in, digits too.)
    else if (row && row.type === 'text' && (k.code === 'Backspace' || (k.key && k.key.length === 1 && /[\p{L}\p{N}' ,.!?-]/u.test(k.key)))) {
      const P = (this.hero.modPicks ||= {});
      const v = String(P[row.id] || '');
      P[row.id] = k.code === 'Backspace' ? v.slice(0, -1) : v.length < 40 ? v + k.key : v;
    } else if (digit && digit[1] === '0') this.randomise();
    else if (digit && Number(digit[1]) <= this.tabs.length) this.setTab(Number(digit[1]) - 1);
    else if (k.code === 'ArrowUp' && n) {
      this.sel = (this.sel + n - 1) % n;
      this.follow = true;
    } else if (k.code === 'ArrowDown' && n) {
      this.sel = (this.sel + 1) % n;
      this.follow = true;
    } else if (k.code === 'PageDown' || k.code === 'PageUp') this.onWheel(k.code === 'PageDown' ? 5 : -5);
    else if (k.code === 'ArrowLeft' && row) this.change(row, -1);
    else if (k.code === 'ArrowRight' && row) this.change(row, 1);
    else if (row && row.type === 'name') {
      if (k.code === 'Backspace') this.hero.name = this.hero.name.slice(0, -1);
      else if (k.key && k.key.length === 1 && /[\p{L}' -]/u.test(k.key) && this.hero.name.length < 16) this.hero.name += k.key;
    } else if (row && k.code === 'Space' && (row.type === 'trait' || row.type === 'many')) this.change(row, 1);
    return true;
  }
}
