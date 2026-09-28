// The character screen: who you'll be before a new game starts. Everything
// can be changed with the mouse (click the arrows and boxes) or the keys
// (↑↓ to pick a line, ←→ to change it, type to edit your name).
import { COLS, ROWS } from '../config.js';
import { Window, cap } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS } from '../world/items.js';
import { humanoidSheet, SHEET_H, SPR_PAD } from '../render/sprites.js';
import {
  STATS, STAT_BASE, STAT_MAX, SPECIALTIES, TRAITS, ORIGINS, KITS, SKINS, HAIRS, HAIR_STYLES, CLOTHES, PANTS, FACES,
  pointsLeft, randomHero, heroName, hpBonus, COMMON_KIT,
} from '../game/hero.js';

const cycle = (list, v, d) => list[(list.indexOf(v) + d + list.length) % list.length];
const FACE_NAMES = { null: 'clean-shaven', beard: 'beard', mustache: 'moustache', freckles: 'freckles', glasses: 'glasses', earring: 'earrings', scar: 'scar', eyepatch: 'eyepatch' };

export class CharacterWindow extends Window {
  constructor(ui, seed, onDone) {
    super(ui, COLS, ROWS, { kind: 'create', x: 0, y: 0 });
    this.seed = seed;
    this.onDone = onDone;
    this.rolls = 0;
    this.hero = randomHero((seed ^ Date.now()) >>> 0);
    this.sel = 0;
    this.rows = this.makeRows();
  }

  makeRows() {
    const h = () => this.hero;
    const look = (k, list) => ({ get: () => h().look[k], set: (d) => { h().look[k] = cycle(list, h().look[k], d); } });
    const rows = [
      { id: 'name', label: 'Name', type: 'name', about: 'Type to change your name. ←/→ picks another.' },
      { id: 'origin', label: 'Origin', type: 'cycle', show: () => ORIGINS[h().origin].name, set: (d) => { h().origin = cycle(Object.keys(ORIGINS), h().origin, d); }, about: () => ORIGINS[h().origin].about },
      { id: 'kit', label: 'Starting gear', type: 'cycle', show: () => KITS[h().kit].name, set: (d) => { h().kit = cycle(Object.keys(KITS), h().kit, d); }, about: () => this.kitText() },
      { id: 'skin', label: 'Skin', type: 'swatch', ...look('skin', SKINS) },
      { id: 'hair', label: 'Hair colour', type: 'swatch', ...look('hair', HAIRS) },
      { id: 'hairStyle', label: 'Hair style', type: 'cycle', show: () => h().look.hairStyle, set: (d) => { h().look.hairStyle = cycle(HAIR_STYLES, h().look.hairStyle, d); } },
      { id: 'face', label: 'Face', type: 'cycle', show: () => FACE_NAMES[this.face()], set: (d) => this.setFace(cycle(FACES, this.face(), d)) },
      { id: 'shirt', label: 'Shirt', type: 'swatch', ...look('shirt', CLOTHES) },
      { id: 'pants', label: 'Trousers', type: 'swatch', ...look('pants', PANTS) },
      { id: 'accent', label: 'Accent', type: 'swatch', ...look('accent', CLOTHES) },
    ];
    for (const s of STATS) rows.push({ id: `stat:${s.key}`, label: s.name, type: 'stat', key: s.key, about: s.about });
    for (const k of Object.keys(SPECIALTIES)) rows.push({ id: `spec:${k}`, label: SPECIALTIES[k].name, type: 'spec', key: k, about: SPECIALTIES[k].about });
    for (const k of Object.keys(TRAITS)) rows.push({ id: `trait:${k}`, label: TRAITS[k].name, type: 'trait', key: k, about: TRAITS[k].about });
    return rows;
  }

  face() {
    const l = this.hero.look;
    return l.beard ? 'beard' : l.acc || null;
  }

  setFace(f) {
    const l = this.hero.look;
    l.beard = f === 'beard';
    l.acc = f && f !== 'beard' ? f : null;
  }

  kitText() {
    const k = KITS[this.hero.kit];
    const all = new Map();
    for (const [it, n] of [...k.items, ...COMMON_KIT]) all.set(it, (all.get(it) || 0) + n);
    const names = [...all].map(([it, n]) => `${n > 1 ? `${n} ` : ''}${ITEMS[it]?.name || it}`);
    return `${names.join(', ')}, and ¤${k.coins}.`;
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
    let hovAbout = null;
    const rowAt = (r, x, y, w) => {
      const i = this.rows.indexOf(r);
      const hov = this.hovering(x, y, w, 1);
      if (hov) hovAbout = r;
      const sel = this.sel === i;
      g.fill(x, y, w, 1, ' ', C.fg, sel ? C.bgHi : hov ? 'rgba(60,52,80,0.9)' : undefined);
      return { sel, hov, i };
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
    const R = (id) => this.rows.find((r) => r.id === id);
    cyc(R('name'), 3);
    cyc(R('origin'), 4);
    wrap(ORIGINS[h.origin].about, 48).slice(0, 2).forEach((l, i) => g.text(4, 5 + i, l, C.faint));
    cyc(R('kit'), 7);
    wrap(this.kitText(), 48).slice(0, 2).forEach((l, i) => g.text(4, 8 + i, l, C.faint));
    g.text(2, 11, 'LOOKS', C.cyan);
    ['skin', 'hair', 'hairStyle', 'face', 'shirt', 'pants', 'accent'].forEach((id, i) => cyc(R(id), 12 + i));
    const left = pointsLeft(h);
    g.text(2, 20, 'STATS', C.cyan);
    g.text(10, 20, `${left} point${left === 1 ? '' : 's'} to spend`, left > 0 ? C.hi : C.faint);
    STATS.forEach((s, j) => {
      const r = R(`stat:${s.key}`);
      const y = 21 + j;
      const { sel, i } = rowAt(r, 2, y, 50);
      g.text(3, y, s.name, sel ? C.white : C.dim);
      g.text(19, y, '[-]', C.hi);
      const v = h.stats[s.key];
      for (let k = 0; k < STAT_MAX; k++) g.text(23 + k * 2, y, k < v ? '■' : '□', k < v ? (v > STAT_BASE && k >= STAT_BASE ? C.green : C.fg) : C.faint);
      g.text(34, y, '[+]', C.hi);
      this.hit(19, y, 3, 1, () => {
        this.sel = i;
        this.change(r, -1);
      });
      this.hit(34, y, 3, 1, () => {
        this.sel = i;
        this.change(r, 1);
      });
    });
    const toggles = (type, title, y0, keys, list) => {
      g.text(2, y0, title, C.cyan);
      keys.forEach((k, j) => {
        const r = R(`${type}:${k}`);
        const x = 3 + (j % 2) * 25;
        const y = y0 + 1 + Math.floor(j / 2);
        const { sel, i } = rowAt(r, x - 1, y, 24);
        const on = list.includes(k);
        const flaw = type === 'trait' && TRAITS[k].flaw;
        g.text(x, y, on ? '[x]' : '[ ]', on ? C.green : C.faint);
        g.text(x + 4, y, r.label, sel ? C.white : on ? (flaw ? C.orange : C.fg) : C.dim);
        this.hit(x - 1, y, 24, 1, () => {
          this.sel = i;
          this.change(r, 1);
        });
      });
    };
    toggles('spec', 'SPECIALTIES (pick 2)', 25, Object.keys(SPECIALTIES), h.specialties);
    toggles('trait', 'TRAITS (up to 2; flaws give a point)', 30, Object.keys(TRAITS), h.traits);

    // The preview, and what the line you're on does.
    const px = 56;
    g.box(px - 1, 3, 29, 16, { fg: C.faint, bg: '#141020' });
    g.center(4, h.name.toUpperCase(), C.hi, undefined, px, 27);
    this.previewAt = { x: px + 9, y: 6 };
    const hp = 20 + hpBonus(h);
    g.text(px + 1, 17, `Health ${hp}`, C.red);
    g.text(px + 13, 17, ORIGINS[h.origin].name.split(' ')[0], C.cyan);
    const cur = hovAbout || this.rows[this.sel];
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
    btn(30, '[TAB]    Randomise', () => this.randomise());
    btn(32, '[ESC]    Back', () => this.close());
    g.text(2, this.h - 1, '↑↓ choose a line · ←→ change it · type to rename', C.faint);
  }

  drawPixels(ctx) {
    if (!this.previewAt) return;
    const sheet = humanoidSheet(this.hero.look);
    const dir = Math.floor(this.ui.time * 0.8) % 4;
    const row = [0, 3, 2, 1][dir];
    const frame = Math.floor(this.ui.time * 4) % 3;
    const f = frame === 0 ? 0 : frame;
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
    this.ui.audio?.play('coin');
    this.close();
    this.onDone(JSON.parse(JSON.stringify(h)));
  }

  onKey(k) {
    const row = this.rows[this.sel];
    const n = this.rows.length;
    if (k.code === 'Escape') this.close();
    else if (k.code === 'Enter') this.begin();
    else if (k.code === 'Tab') this.randomise();
    else if (k.code === 'ArrowUp') this.sel = (this.sel + n - 1) % n;
    else if (k.code === 'ArrowDown') this.sel = (this.sel + 1) % n;
    else if (k.code === 'ArrowLeft') this.change(row, -1);
    else if (k.code === 'ArrowRight') this.change(row, 1);
    else if (row.type === 'name') {
      if (k.code === 'Backspace') this.hero.name = this.hero.name.slice(0, -1);
      else if (k.key && k.key.length === 1 && /[\p{L}' -]/u.test(k.key) && this.hero.name.length < 16) this.hero.name += k.key;
    } else if (k.code === 'Space' && (row.type === 'spec' || row.type === 'trait')) this.change(row, 1);
    return true;
  }
}
