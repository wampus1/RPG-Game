// The character screen: who you'll be before a new game starts, in five
// tabs: the basics (name, origin, starting gear), looks, stats, skills and
// traits. Everything can be changed with the mouse (click the tabs, arrows
// and boxes) or the keys: 1-5 or Tab switch tabs, ↑↓ pick a line, ←→
// change it, and you type to edit your name.
import { COLS, ROWS } from '../config.js';
import { Window, cap } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS } from '../world/items.js';
import { humanoidSheet, SHEET_H, SPR_PAD } from '../render/sprites.js';
import {
  STATS, STAT_BASE, STAT_MAX, SPECIALTIES, TRAITS, ORIGINS, KITS, SKINS, HAIRS, HAIR_STYLES, CLOTHES, PANTS, SHOES,
  DETAILS, HATS, PATTERNS, OUTFITS, pointsLeft, randomHero, heroName, hpBonus, COMMON_KIT,
} from '../game/hero.js';

const cycle = (list, v, d) => list[(list.indexOf(v) + d + list.length) % list.length];
const DETAIL_NAMES = { null: 'none', mustache: 'moustache', freckles: 'freckles', glasses: 'glasses', earring: 'earrings', scar: 'a scar', eyepatch: 'an eyepatch' };
const OUTFIT_NAMES = { plain: 'plain shirt', vest: 'waistcoat', hunter: 'hunter\'s tunic', plaid: 'plaid shirt', noble: 'fine doublet', apron: 'apron', fisher: 'fisher\'s vest', farmer: 'overalls', robe_blue: 'blue robe', robe_green: 'green robe', robe_white: 'white robe' };
export const TABS = [
  { id: 'basics', name: 'BASICS' },
  { id: 'looks', name: 'LOOKS' },
  { id: 'stats', name: 'STATS' },
  { id: 'skills', name: 'SKILLS' },
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
    this.rows = this.makeRows();
  }

  makeRows() {
    const h = () => this.hero;
    const look = (k, list) => ({ get: () => h().look[k], set: (d) => { h().look[k] = cycle(list, h().look[k], d); } });
    const pickOf = (k, list, names) => ({ show: () => (names ? names[h().look[k]] : h().look[k]) || 'none', set: (d) => { h().look[k] = cycle(list, h().look[k] ?? null, d); } });
    const rows = [
      { tab: 'basics', id: 'name', label: 'Name', type: 'name', about: 'Type to change your name. ←/→ picks another.' },
      { tab: 'basics', id: 'origin', label: 'Origin', type: 'cycle', show: () => ORIGINS[h().origin].name, set: (d) => { h().origin = cycle(Object.keys(ORIGINS), h().origin, d); }, about: () => ORIGINS[h().origin].about },
      { tab: 'basics', id: 'kit', label: 'Starting gear', type: 'cycle', show: () => KITS[h().kit].name, set: (d) => { h().kit = cycle(Object.keys(KITS), h().kit, d); }, about: () => this.kitText() },
      { tab: 'looks', id: 'skin', label: 'Skin', type: 'swatch', ...look('skin', SKINS) },
      { tab: 'looks', id: 'hair', label: 'Hair colour', type: 'swatch', ...look('hair', HAIRS) },
      { tab: 'looks', id: 'hairStyle', label: 'Hair style', type: 'cycle', ...pickOf('hairStyle', HAIR_STYLES) },
      { tab: 'looks', id: 'beard', label: 'Beard', type: 'cycle', show: () => (h().look.beard ? 'beard' : 'none'), set: () => { h().look.beard = !h().look.beard; } },
      { tab: 'looks', id: 'acc', label: 'Face', type: 'cycle', ...pickOf('acc', DETAILS, DETAIL_NAMES) },
      { tab: 'looks', id: 'hat', label: 'Hat', type: 'cycle', ...pickOf('hat', HATS) },
      { tab: 'looks', id: 'outfit', label: 'Clothes', type: 'cycle', ...pickOf('outfit', OUTFITS, OUTFIT_NAMES) },
      { tab: 'looks', id: 'shirt', label: 'Shirt colour', type: 'swatch', ...look('shirt', CLOTHES) },
      { tab: 'looks', id: 'pattern', label: 'Pattern', type: 'cycle', ...pickOf('pattern', PATTERNS) },
      { tab: 'looks', id: 'pants', label: 'Trousers', type: 'swatch', ...look('pants', PANTS) },
      { tab: 'looks', id: 'shoes', label: 'Shoes', type: 'swatch', ...look('shoes', SHOES) },
      { tab: 'looks', id: 'accent', label: 'Accent', type: 'swatch', ...look('accent', CLOTHES), about: 'The colour of trims, sashes and some hats.' },
      { tab: 'looks', id: 'stoop', label: 'Stance', type: 'cycle', show: () => (h().look.stoop ? 'stooped' : 'upright'), set: () => { h().look.stoop = !h().look.stoop; } },
    ];
    for (const s of STATS) rows.push({ tab: 'stats', id: `stat:${s.key}`, label: s.name, type: 'stat', key: s.key, about: s.about });
    for (const k of Object.keys(SPECIALTIES)) rows.push({ tab: 'skills', id: `spec:${k}`, label: SPECIALTIES[k].name, type: 'spec', key: k, about: SPECIALTIES[k].about });
    for (const k of Object.keys(TRAITS)) rows.push({ tab: 'traits', id: `trait:${k}`, label: TRAITS[k].name, type: 'trait', key: k, about: TRAITS[k].about });
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
    this.ui.audio?.play('select');
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
    if (row.type === 'name') h.name = heroName((this.seed + ++this.rolls * 7919) >>> 0, null);
    else if (row.type === 'stat') {
      const v = h.stats[row.key];
      if (d > 0 && v < STAT_MAX && pointsLeft(h) > 0) h.stats[row.key]++;
      else if (d < 0 && v > 1) h.stats[row.key]--;
      else {
        this.ui.audio?.play('error');
        return;
      }
    } else if (row.type === 'spec' || row.type === 'trait') this.toggle(row);
    else if (row.set) row.set(d);
    h.look.hatColor = h.look.accent;
    this.ui.audio?.play('select');
  }

  toggle(row) {
    const h = this.hero;
    const list = row.type === 'spec' ? h.specialties : h.traits;
    const i = list.indexOf(row.key);
    if (i >= 0) {
      list.splice(i, 1);
      // Dropping a flaw takes its stat point back.
      while (pointsLeft(h) < 0) {
        const k = STATS.map((s) => s.key).sort((a, b) => h.stats[b] - h.stats[a])[0];
        h.stats[k]--;
      }
      return;
    }
    if (list.length >= 2) list.shift();
    list.push(row.key);
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
        g.text(21, y, '███', r.get());
        g.text(25, y, r.get(), C.faint);
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
      cyc(R('origin'), 8);
      wrap(ORIGINS[h.origin].about, 48).slice(0, 3).forEach((l, i) => g.text(4, 9 + i, l, C.faint));
      cyc(R('kit'), 13);
      wrap(this.kitText(), 48).slice(0, 3).forEach((l, i) => g.text(4, 14 + i, l, C.faint));
      g.text(3, 19, 'Summary', C.cyan);
      const sum = [
        `Stats: ${STATS.map((s) => `${s.name.slice(0, 3)} ${h.stats[s.key]}`).join(' · ')}`,
        `Skills: ${h.specialties.map((k) => SPECIALTIES[k].name).join(', ') || 'none'}`,
        `Traits: ${h.traits.map((k) => TRAITS[k].name).join(', ') || 'none'}`,
      ];
      sum.forEach((l, i) => g.text(4, 20 + i, l.slice(0, 48), C.dim));
    } else if (tab === 'looks') rows.forEach((r, i) => cyc(r, 6 + i * 2));
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
      const list = tab === 'skills' ? h.specialties : h.traits;
      g.text(3, 6, tab === 'skills' ? 'Pick two specialties.' : 'Up to two traits. Flaws (orange) give a stat point back.', C.dim);
      rows.forEach((r, j) => {
        const y = 8 + j * 3;
        const { sel, i } = rowAt(r, 2, y, 50);
        const on = list.includes(r.key);
        const flaw = r.type === 'trait' && TRAITS[r.key].flaw;
        g.text(3, y, on ? '[x]' : '[ ]', on ? C.green : C.faint);
        g.text(7, y, r.label, sel ? C.white : on ? (flaw ? C.orange : C.fg) : flaw ? '#a87050' : C.dim);
        g.text(7, y + 1, r.about.slice(0, 45), C.faint);
        this.hit(2, y, 50, 2, () => {
          this.sel = i;
          this.change(r, 1);
        });
      });
    }

    // The preview, and what the line you're on does.
    const px = 56;
    g.box(px - 1, 3, 29, 16, { fg: C.faint, bg: '#141020' });
    g.center(4, h.name.toUpperCase(), C.hi, undefined, px, 27);
    this.previewAt = { x: px + 9, y: 6 };
    const hp = 20 + hpBonus(h);
    g.text(px + 1, 17, `Health ${hp}`, C.red);
    g.text(px + 13, 17, ORIGINS[h.origin].name.split(' ')[0], C.cyan);
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
    g.text(2, this.h - 1, '1-5/TAB switch tab · ↑↓ choose · ←→ change · type to rename', C.faint);
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
    ctx.drawImage(sheet, f * 16, row * SHEET_H, 16, SHEET_H, x, y, 16 * s, SHEET_H * s);
  }

  randomise() {
    const name = this.hero.name;
    this.hero = randomHero((this.seed + ++this.rolls * 104729 + Date.now()) >>> 0);
    this.hero.name = name;
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
    const digit = /^Digit([0-5])$/.exec(k.code);
    if (k.code === 'Escape') this.close();
    else if (k.code === 'Enter') this.begin();
    else if (k.code === 'Tab') this.setTab(this.tab + (k.shift ? -1 : 1));
    else if (digit && digit[1] === '0') this.randomise();
    else if (digit) this.setTab(Number(digit[1]) - 1);
    else if (k.code === 'ArrowUp') this.sel = (this.sel + n - 1) % n;
    else if (k.code === 'ArrowDown') this.sel = (this.sel + 1) % n;
    else if (k.code === 'ArrowLeft' && row) this.change(row, -1);
    else if (k.code === 'ArrowRight' && row) this.change(row, 1);
    else if (row && row.type === 'name') {
      if (k.code === 'Backspace') this.hero.name = this.hero.name.slice(0, -1);
      else if (k.key && k.key.length === 1 && /[\p{L}' -]/u.test(k.key) && this.hero.name.length < 16) this.hero.name += k.key;
    } else if (row && k.code === 'Space' && (row.type === 'spec' || row.type === 'trait')) this.change(row, 1);
    return true;
  }
}
