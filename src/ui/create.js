// The character screen: who you'll be before a new game starts, in four
// tabs: the basics (name, origin, starting gear), looks, stats and traits
// (what you're good at, and your flaws). Everything can be changed with the
// mouse (click the tabs, arrows and boxes) or the keys: 1-4 or Tab switch
// tabs, ↑↓ pick a line, ←→ change it, and you type to edit your name. A tab
// longer than the screen scrolls (the wheel, the arrows on its bar, or just
// moving down it).
import { COLS, ROWS } from '../config.js';
import { Window, cap } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS } from '../world/items.js';
import { CULTURES } from '../world/names.js';
import { humanoidSheet, SHEET_H, SPR_PAD } from '../render/sprites.js';
import { drawWing, wingInFront } from '../render/wing.js';
import {
  STATS, STAT_BASE, STAT_MAX, TRAITS, FLAW_MAX, traitPicks, goodTraits, ORIGINS, KITS, SKINS, HAIRS, HAIR_STYLES, CLOTHES, PANTS, SHOES,
  DETAILS, HATS, PATTERNS, OUTFITS, pointsLeft, randomHero, heroName, hpBonus, COMMON_KIT,
  EYES, BEARD_STYLES, MARKS, NECKS, GLOVES, CAPES,
} from '../game/hero.js';

const cycle = (list, v, d) => list[(list.indexOf(v) + d + list.length) % list.length];
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

export class CharacterWindow extends Window {
  constructor(ui, seed, onDone) {
    super(ui, COLS, ROWS, { kind: 'create', x: 0, y: 0 });
    this.seed = seed;
    this.onDone = onDone;
    this.rolls = 0;
    this.hero = randomHero((seed ^ Date.now()) >>> 0);
    this.tab = 0;
    this.sel = 0;
    this.scroll = 0;
    this.rows = this.makeRows();
  }

  makeRows() {
    const h = () => this.hero;
    const look = (k, list) => ({ get: () => h().look[k], set: (d) => { h().look[k] = cycle(list, h().look[k], d); } });
    const pickOf = (k, list, names) => ({ show: () => (names ? names[h().look[k]] : h().look[k]) || 'none', set: (d) => { h().look[k] = cycle(list, h().look[k] ?? null, d); } });
    // (A colour, or none at all.)
    const orNone = (k, list) => ({ get: () => h().look[k] || null, set: (d) => { h().look[k] = cycle(list, h().look[k] ?? null, d); } });
    const beards = [null, ...BEARD_STYLES];
    const rows = [
      { tab: 'basics', id: 'name', label: 'Name', type: 'name', about: 'Type to change your name. ←/→ picks another.' },
      { tab: 'basics', id: 'nameStyle', label: 'Names from', type: 'cycle', show: () => (h().nameStyle ? CULTURES[h().nameStyle].label : 'anywhere'), set: (d) => { h().nameStyle = cycle([null, ...Object.keys(CULTURES)], h().nameStyle ?? null, d); }, about: 'Which people\'s names ←/→ on your name picks from.' },
      { tab: 'basics', id: 'origin', label: 'Origin', type: 'cycle', show: () => ORIGINS[h().origin].name, set: (d) => { h().origin = cycle(Object.keys(ORIGINS), h().origin, d); }, about: () => ORIGINS[h().origin].about },
      { tab: 'basics', id: 'kit', label: 'Starting gear', type: 'cycle', show: () => KITS[h().kit].name, set: (d) => { h().kit = cycle(Object.keys(KITS), h().kit, d); }, about: () => this.kitText() },
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
    ];
    for (const s of STATS) rows.push({ tab: 'stats', id: `stat:${s.key}`, label: s.name, type: 'stat', key: s.key, about: s.about });
    // (The good ones first, then the flaws.)
    const keys = Object.keys(TRAITS);
    for (const k of [...keys.filter((q) => !TRAITS[q].flaw), ...keys.filter((q) => TRAITS[q].flaw)]) rows.push({ tab: 'traits', id: `trait:${k}`, label: TRAITS[k].name, type: 'trait', key: k, flaw: !!TRAITS[k].flaw, about: TRAITS[k].about });
    return rows;
  }

  // The lines on the tab you're looking at.
  get tabRows() {
    const id = TABS[this.tab].id;
    return this.rows.filter((r) => r.tab === id);
  }

  setTab(i) {
    this.tab = (i + TABS.length) % TABS.length;
    this.sel = 0;
    this.scroll = 0;
    this.ui.audio?.play('select');
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
    const k = KITS[this.hero.kit];
    const all = new Map();
    for (const [it, n] of [...k.items, ...COMMON_KIT]) all.set(it, (all.get(it) || 0) + n);
    const names = [...all].map(([it, n]) => `${n > 1 ? `${n} ` : ''}${ITEMS[it]?.name || it}`);
    return `${names.join(', ')}${k.coins ? `, and ¤${k.coins}` : ''}.`;
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
    } else if (row.type === 'trait') {
      if (!this.toggle(row)) {
        this.ui.audio?.play('error');
        return;
      }
    } else if (row.set) row.set(d);
    h.look.hatColor = h.look.accent;
    this.ui.audio?.play('select');
  }

  // On or off. You may have TRAIT_PICKS good traits, one more for each flaw
  // (up to FLAW_MAX flaws). False if it can't be taken (all your picks are
  // used: take one off first, or a flaw).
  toggle(row) {
    const h = this.hero;
    const list = h.traits;
    const i = list.indexOf(row.key);
    if (i >= 0) {
      list.splice(i, 1);
      // Dropping a flaw drops the pick it gave (the last good one taken).
      if (row.flaw) {
        while (goodTraits(h).length > traitPicks(h)) list.splice(list.lastIndexOf(goodTraits(h).at(-1)), 1);
      }
      this.note = null;
      return true;
    }
    if (row.flaw) {
      if (list.filter((k) => TRAITS[k].flaw).length >= FLAW_MAX) {
        this.note = `You can take at most ${FLAW_MAX} flaws.`;
        return false;
      }
    } else if (goodTraits(h).length >= traitPicks(h)) {
      this.note = 'All your picks are used. Take one off, or take a flaw for another pick.';
      return false;
    }
    list.push(row.key);
    this.note = null;
    return true;
  }

  draw(g) {
    const h = this.hero;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#0b0912');
    g.center(1, 'W H O   W I L L   Y O U   B E ?', C.hi);
    // Tabs.
    let tx = 2;
    TABS.forEach((t, i) => {
      const label = ` ${i + 1} ${t.name} `;
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
      g.text(3, y, r.label, sel ? C.white : C.dim);
      g.text(19, y, '◄', C.hi);
      if (r.type === 'swatch') {
        const c = r.get();
        if (c) {
          g.text(21, y, '███', c);
          g.text(25, y, r.name ? r.name(c) : c, C.faint);
        } else g.text(21, y, 'none', C.fg);
      } else if (r.type === 'name') {
        g.text(21, y, `${h.name}${sel && Math.floor(this.ui.time * 2) % 2 ? '_' : ''}`, C.white);
      } else g.text(21, y, cap(String(r.show())), C.fg);
      g.text(48, y, '►', C.hi);
      this.hit(19, y, 2, 1, () => {
        this.sel = i;
        this.change(r, -1);
      });
      this.hit(46, y, 4, 1, () => {
        this.sel = i;
        this.change(r, 1);
      });
      this.hit(2, y, 17, 1, () => {
        this.sel = i;
      });
      this.hit(21, y, 25, 1, () => {
        this.sel = i;
        if (r.type !== 'name') this.change(r, 1);
      });
    };
    const tab = TABS[this.tab].id;
    if (tab === 'basics') {
      const R = (id) => rows.find((r) => r.id === id);
      cyc(R('name'), 6);
      cyc(R('nameStyle'), 7);
      cyc(R('origin'), 9);
      wrap(ORIGINS[h.origin].about, 48).slice(0, 3).forEach((l, i) => g.text(4, 10 + i, l, C.faint));
      cyc(R('kit'), 14);
      wrap(this.kitText(), 48).slice(0, 3).forEach((l, i) => g.text(4, 15 + i, l, C.faint));
      g.text(3, 20, 'Summary', C.cyan);
      g.text(4, 21, `Stats: ${STATS.map((s) => `${s.name.slice(0, 3)} ${h.stats[s.key]}`).join(' · ')}`.slice(0, 48), C.dim);
      wrap(`Traits: ${h.traits.map((k) => TRAITS[k].name).join(', ') || 'none'}`, 48).slice(0, 3).forEach((l, i) => g.text(4, 22 + i, l, C.dim));
    } else if (tab === 'looks') {
      // (More than fits: it scrolls.)
      const V = Math.floor((this.h - 4 - 6) / 2) + 1;
      const s0 = this.scrolled(rows.length, V);
      rows.slice(s0, s0 + V).forEach((r, i) => cyc(r, 6 + i * 2));
      this.scrollbar(g, 52, 6, V * 2 - 1, rows.length, V);
    }
    else if (tab === 'stats') {
      const left = pointsLeft(h);
      g.text(3, 6, `${left} point${left === 1 ? '' : 's'} to spend`, left > 0 ? C.hi : C.faint);
      rows.forEach((r, j) => {
        const y = 8 + j * 3;
        const { sel, i } = rowAt(r, 2, y, 50);
        g.text(3, y, r.label, sel ? C.white : C.dim);
        g.text(19, y, '[-]', C.hi);
        const v = h.stats[r.key];
        for (let k = 0; k < STAT_MAX; k++) g.text(23 + k * 2, y, k < v ? '■' : '□', k < v ? (v > STAT_BASE && k >= STAT_BASE ? C.green : C.fg) : C.faint);
        g.text(34, y, '[+]', C.hi);
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
    } else {
      // One list: the good traits, a line, then the flaws. It scrolls.
      const good = goodTraits(h).length;
      const picks = traitPicks(h);
      const flaws = h.traits.length - good;
      g.text(3, 6, `Good traits: ${good}/${picks}`, good < picks ? C.hi : C.fg);
      g.text(24, 6, `Flaws: ${flaws}/${FLAW_MAX}`, flaws ? C.orange : C.faint);
      // (What's on the list: a heading, the good ones, the divider, the flaws.)
      const lines = [{ head: `GOOD TRAITS  (pick up to ${picks})` }];
      rows.forEach((r, j) => {
        if (r.flaw && !lines.some((q) => q.divider)) lines.push({ divider: true });
        lines.push({ r, j });
      });
      const y0 = 8;
      const V = this.h - y0 - 6;
      // (Kept on the line you're on, when you move with the keys.)
      const at = lines.findIndex((q) => q.r && q.j === this.sel);
      if (this.follow) {
        if (at < this.scroll + 1) this.scroll = Math.max(0, at - 1);
        else if (at >= this.scroll + V) this.scroll = at - V + 1;
        this.follow = false;
      }
      this.scroll = Math.max(0, Math.min(Math.max(0, lines.length - V), this.scroll));
      this.view = { n: lines.length, V };
      lines.slice(this.scroll, this.scroll + V).forEach((q, k) => {
        const y = y0 + k;
        if (q.head) {
          g.text(3, y, q.head, C.cyan);
          return;
        }
        if (q.divider) {
          const t = ' FLAWS: each gives one more good pick ';
          g.text(2, y, `${'─'.repeat(3)}${t}${'─'.repeat(Math.max(0, 47 - t.length))}`, C.orange);
          return;
        }
        const r = q.r;
        const { sel, i } = rowAt(r, 2, y, 49);
        const on = h.traits.includes(r.key);
        g.text(3, y, on ? '[x]' : '[ ]', on ? (r.flaw ? C.orange : C.green) : C.faint);
        g.text(7, y, r.label.slice(0, 18), sel ? C.white : on ? (r.flaw ? C.orange : C.fg) : r.flaw ? '#a87050' : C.dim);
        g.text(26, y, (typeof r.about === 'string' ? r.about : '').slice(0, 24) + ((r.about || '').length > 24 ? '…' : ''), C.faint);
        this.hit(2, y, 49, 1, () => {
          this.sel = i;
          this.change(r, 1);
        });
      });
      this.scrollbar(g, 52, y0, V, lines.length, V);
      const cur = hovAbout || rows[this.sel];
      const yA = y0 + V + 1;
      if (this.note) wrap(this.note, 48).slice(0, 2).forEach((l, i) => g.text(3, yA + i, l, C.orange));
      else if (cur) {
        g.text(3, yA, cur.label, cur.flaw ? C.orange : C.cyan);
        wrap(cur.about, 48).slice(0, 2).forEach((l, i) => g.text(3, yA + 1 + i, l, C.dim));
      }
    }

    // The preview, and what the line you're on does.
    const px = 56;
    g.box(px - 1, 3, 29, 16, { fg: C.faint, bg: '#141020' });
    g.center(4, h.name.toUpperCase(), C.hi, undefined, px, 27);
    this.previewAt = { x: px + 9, y: 6 };
    const hp = 20 + hpBonus(h);
    g.text(px + 1, 17, `Health ${hp}`, C.red);
    g.text(px + 13, 17, ORIGINS[h.origin].name.slice(0, 13), C.cyan);
    const cur = hovAbout || rows[this.sel];
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
    g.text(2, this.h - 1, '1-4/TAB switch tab · ↑↓ choose · ←→ change · type to rename', C.faint);
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
    this.hero = randomHero((this.seed + ++this.rolls * 104729 + Date.now()) >>> 0);
    this.hero.name = name;
    this.hero.nameStyle = nameStyle;
    this.ui.audio?.play('craft');
  }

  begin() {
    const h = this.hero;
    if (!h.name.trim()) h.name = heroName(this.seed, null);
    h.name = h.name.trim().slice(0, 16);
    h.look.hatColor = h.look.accent;
    this.ui.audio?.play('coin');
    this.close();
    this.onDone(JSON.parse(JSON.stringify(h)));
  }

  onKey(k) {
    const rows = this.tabRows;
    const row = rows[this.sel];
    const n = rows.length;
    const digit = /^Digit([0-4])$/.exec(k.code);
    if (k.code === 'Escape') this.close();
    else if (k.code === 'Enter') this.begin();
    else if (k.code === 'Tab') this.setTab(this.tab + (k.shift ? -1 : 1));
    else if (digit && digit[1] === '0') this.randomise();
    else if (digit) this.setTab(Number(digit[1]) - 1);
    else if (k.code === 'ArrowUp') {
      this.sel = (this.sel + n - 1) % n;
      this.follow = true;
    } else if (k.code === 'ArrowDown') {
      this.sel = (this.sel + 1) % n;
      this.follow = true;
    } else if (k.code === 'PageDown' || k.code === 'PageUp') this.onWheel(k.code === 'PageDown' ? 5 : -5);
    else if (k.code === 'ArrowLeft' && row) this.change(row, -1);
    else if (k.code === 'ArrowRight' && row) this.change(row, 1);
    else if (row && row.type === 'name') {
      if (k.code === 'Backspace') this.hero.name = this.hero.name.slice(0, -1);
      else if (k.key && k.key.length === 1 && /[\p{L}' -]/u.test(k.key) && this.hero.name.length < 16) this.hero.name += k.key;
    } else if (row && k.code === 'Space' && row.type === 'trait') this.change(row, 1);
    return true;
  }
}
