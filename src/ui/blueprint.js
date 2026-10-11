// (Round 69) A ship's blueprint table (see world/shipmodels.js: in her
// captain's cabin, or below in a sloop's hold): her plans spread on it,
// and on them her name, her colours and her paint, to be changed. Type to
// rename her; click a colour, a mark, a paint; ENTER (or Save) to have it
// so.
// (Round 86) Laid out afresh: her hull (paint and trim), her sails (their
// cloth, the mark on the mainsail and its colour), and her flag built up
// in layers, a field and up to five shapes laid over it in turn, each
// with its own colour; and her drawn as she'll look on the right.
import { Window } from './window.js';
import { C } from './ascii.js';
import { markAt, MARKS, FLAG_LAYERS_MAX, flagColorAt, cleanLayers } from '../render/shipvox.js';

export const FLAG_COLORS = ['#e0c040', '#a02020', '#2050a0', '#208040', '#f0f0e8', '#1a1a1a', '#8040a0', '#e07020', '#40b0c0', '#c03070'];
// (Round 86) All the colours to be had for a flag's layers and her mark.
export const PALETTE = [...FLAG_COLORS, '#c8a060', '#60a0e0', '#80c040', '#603018', '#808080', '#f0a0b0'];
export const EMBLEMS = [null, ...MARKS];
export const HULL_PAINTS = ['#8a2a1e', '#2a4a8a', '#1e1e24', '#2a5a32', '#6a4a2a', '#e8e0d0', '#5a2a5a', '#a07820'];
export const TRIMS = ['#1a1a20', '#e8e0d0', '#a07820', '#5a1a14', '#1a3a5a', '#2a4a2a'];
export const SAILS = ['#f0ead8', '#e8d8b0', '#c8b8a0', '#a83a30', '#3a3a40', '#d8c070'];
const NAME_MAX = 24;
const PLAIN_CLOTH = '#f0ead8';

// Flags to start from.
const PRESETS = [
  ['plain', { flag: '#a02020', flagLayers: [] }],
  ['jolly roger', { flag: '#1a1a1a', flagLayers: [{ shape: 'skull', color: '#f0f0e8' }] }],
  ['red jack', { flag: '#a02020', flagLayers: [{ shape: 'swords', color: '#f0f0e8' }, { shape: 'border', color: '#1a1a1a' }] }],
  ['sun', { flag: '#2050a0', flagLayers: [{ shape: 'disc', color: '#e0c040' }, { shape: 'ring', color: '#e07020' }] }],
  ['union', { flag: '#2050a0', flagLayers: [{ shape: 'saltire', color: '#f0f0e8' }, { shape: 'cross', color: '#a02020' }] }],
];

const W = 80;
const H = 33;
const RX = 56; // where the drawing of her starts

export class BlueprintWindow extends Window {
  constructor(ui, game, S) {
    super(ui, W, H, { kind: 'blueprint' });
    this.game = game;
    this.S = S;
    this.name = String(S.name || '');
    this.flag = S.flag || FLAG_COLORS[0];
    this.flagLayers = cleanLayers(S.flagLayers);
    this.emblem = S.emblem || null;
    this.markColor = S.markColor || null;
    this.paint = S.paint || HULL_PAINTS[0];
    this.paint2 = S.paint2 || TRIMS[0];
    this.sailCloth = S.sailCloth || PLAIN_CLOTH;
    // Which of the flag's layers is being worked on (-1: its field).
    this.sel = this.flagLayers.length ? this.flagLayers.length - 1 : -1;
    this.closeOnOutside = true;
  }

  draw(g) {
    g.box(0, 0, W, H, { bg: 'rgba(20,30,48,0.96)', double: true, title: 'BLUEPRINT TABLE', fg: '#7ab0e0' });
    // (The plans: a faint grid.)
    for (let y = 2; y < H - 1; y += 2) g.text(2, y, '·'.repeat(W - 4), 'rgba(122,176,224,0.14)');
    for (let y = 2; y < H - 3; y++) g.text(RX - 2, y, '│', 'rgba(122,176,224,0.35)');
    const head = (y, t) => g.text(3, y, t, '#7ab0e0');
    const lab = (x, y, t) => g.text(x, y, t, '#a8c8e8');
    // ---- her name
    head(2, 'HER NAME');
    const cur = Math.floor(Date.now() / 450) % 2 ? '_' : ' ';
    g.fill(3, 3, RX - 7, 1, ' ', C.fg, 'rgba(232,224,200,0.12)');
    g.text(4, 3, `${this.name}${cur}`, '#fff0c0', undefined, RX - 9);
    g.text(3, 4, '(type to rename her; backspace to rub out)', C.faint);
    // ---- her hull
    head(6, 'HER HULL');
    lab(4, 7, 'Paint');
    this.swatches(g, 12, 7, HULL_PAINTS, this.paint, (c) => this.set('paint', c));
    lab(4, 8, 'Trim');
    this.swatches(g, 12, 8, TRIMS, this.paint2, (c) => this.set('paint2', c));
    // ---- her sails
    head(10, 'HER SAILS');
    lab(4, 11, 'Cloth');
    this.swatches(g, 12, 11, SAILS, this.sailCloth, (c) => this.set('sailCloth', c));
    lab(4, 12, 'Mark');
    this.cycler(g, 12, 12, this.emblem || 'none', (d) => this.set('emblem', EMBLEMS[(EMBLEMS.indexOf(this.emblem) + d + EMBLEMS.length) % EMBLEMS.length]));
    lab(4, 13, 'Colour');
    {
      const asFlag = !this.markColor;
      const hv = this.hovering(12, 13, 9, 1);
      g.text(12, 13, `${asFlag ? '[' : ' '}as flag${asFlag ? ']' : ' '}`, asFlag ? C.hi : hv ? C.white : C.fg);
      this.hit(12, 13, 9, 1, () => this.set('markColor', null));
      this.swatches(g, 22, 13, PALETTE.slice(0, 9), this.markColor, (c) => this.set('markColor', c));
    }
    // ---- her flag, in layers
    head(15, `HER FLAG  (layers: ${this.flagLayers.length}/${FLAG_LAYERS_MAX}, the last on top)`);
    this.layerRow(g, 16, -1);
    this.flagLayers.forEach((L, i) => this.layerRow(g, 17 + i, i));
    {
      const y = 17 + this.flagLayers.length;
      const can = this.flagLayers.length < FLAG_LAYERS_MAX;
      const hv = can && this.hovering(4, y, 15, 1);
      g.text(4, y, '+ add a layer', can ? (hv ? C.white : C.hi) : C.faint);
      if (can) this.hit(4, y, 15, 1, () => this.addLayer());
    }
    // The shape of the layer being worked on.
    const sy = 24;
    const L = this.flagLayers[this.sel];
    lab(4, sy - 1, L ? `Shape of layer ${this.sel + 1}` : 'Shape  (pick a layer above, or add one)');
    let x = 4;
    let y = sy;
    for (const sh of MARKS) {
      if (x + sh.length + 2 > RX - 3) {
        x = 4;
        y++;
      }
      const on = L && L.shape === sh;
      const hv = L && this.hovering(x, y, sh.length + 2, 1);
      g.text(x, y, `${on ? '[' : ' '}${sh}${on ? ']' : ' '}`, !L ? C.faint : on ? C.hi : hv ? C.white : C.fg);
      if (L) this.hit(x, y, sh.length + 2, 1, () => this.setLayer('shape', sh));
      x += sh.length + 2;
    }
    // Its colour (or the field's).
    lab(4, y + 1, L ? `Colour of layer ${this.sel + 1}` : 'Colour of the field');
    this.swatches(g, 4, y + 2, PALETTE, L ? L.color : this.flag, (c) => (L ? this.setLayer('color', c) : this.set('flag', c)));
    // ---- how she'll look
    g.text(RX, 2, 'HOW SHE\'LL LOOK', '#7ab0e0');
    this.drawFlag(g, RX, 4, 22, 7);
    g.text(RX, 12, 'Her mainsail', '#a8c8e8');
    this.drawSail(g, RX + 2, 14, 18, 7);
    g.text(RX, 21, 'Her hull', '#a8c8e8');
    this.drawHull(g, RX, 22, 22);
    lab(RX, 25, 'Start from');
    PRESETS.forEach(([nm, P], i) => {
      const yy = 26 + i;
      const hv = this.hovering(RX + 1, yy, nm.length + 2, 1);
      g.text(RX + 1, yy, `· ${nm}`, hv ? C.white : C.fg);
      this.hit(RX + 1, yy, nm.length + 2, 1, () => {
        this.flag = P.flag;
        this.flagLayers = P.flagLayers.map((q) => ({ ...q }));
        this.sel = this.flagLayers.length - 1;
        this.ui.audio?.play('select');
      });
    });
    // ---- save, or leave it as it was
    const by = H - 2;
    const sv = this.hovering(6, by, 15, 1);
    g.text(6, by, '[ Save  ENTER ]', sv ? C.hi : '#c8e8c8', sv ? C.bgHi : undefined);
    this.hit(6, by, 15, 1, () => this.save());
    const cv = this.hovering(25, by, 9, 1);
    g.text(25, by, '[ Leave ]', cv ? C.hi : C.fg, cv ? C.bgHi : undefined);
    this.hit(25, by, 9, 1, () => this.close());
    g.text(37, by, '↑↓ layer  ←→ shape', C.faint);
  }

  // A row of colours to pick from; the one chosen bracketed.
  swatches(g, x0, y, list, now, fn) {
    list.forEach((c, i) => {
      const x = x0 + i * 3;
      const on = c === now;
      g.text(x, y, on ? '[' : ' ', C.hi);
      g.text(x + 1, y, '█', c);
      g.text(x + 2, y, on ? ']' : ' ', C.hi);
      this.hit(x, y, 3, 1, () => fn(c));
    });
  }

  // ◄ a name ►, turned either way.
  cycler(g, x, y, text, fn) {
    const l = this.hovering(x, y, 2, 1);
    const r = this.hovering(x + 3 + 12, y, 2, 1);
    g.text(x, y, '◄', l ? C.white : C.hi);
    g.text(x + 2, y, text.padEnd(12).slice(0, 12), C.fg);
    g.text(x + 3 + 12, y, '►', r ? C.white : C.hi);
    this.hit(x, y, 2, 1, () => fn(-1));
    this.hit(x + 2, y, 13, 1, () => fn(1));
    this.hit(x + 3 + 12, y, 2, 1, () => fn(1));
  }

  // One of the flag's layers in the list (or its field, i = -1): picked
  // to work on by clicking it; moved up or down, or taken off.
  layerRow(g, y, i) {
    const L = i < 0 ? null : this.flagLayers[i];
    const on = this.sel === i;
    const hv = this.hovering(4, y, 24, 1);
    g.text(4, y, on ? '►' : ' ', C.hi);
    g.text(6, y, L ? `${i + 1}. ${L.shape}` : 'field', on ? C.hi : hv ? C.white : C.fg);
    g.text(22, y, '██', L ? L.color : this.flag);
    this.hit(4, y, 24, 1, () => {
      this.sel = i;
      this.ui.audio?.play('select');
    });
    if (!L) return;
    const btn = (x, t, ok, fn) => {
      const h = ok && this.hovering(x, y, 1, 1);
      g.text(x, y, t, !ok ? C.faint : h ? C.white : C.hi);
      if (ok) this.hit(x, y, 1, 1, fn);
    };
    btn(26, '▲', i > 0, () => this.moveLayer(i, -1));
    btn(28, '▼', i < this.flagLayers.length - 1, () => this.moveLayer(i, 1));
    btn(30, '×', true, () => this.dropLayer(i));
  }

  // Her flag, drawn in half-blocks (two of it to a cell, high and low).
  drawFlag(g, x0, y0, w, h) {
    for (let j = 0; j <= h; j++) g.text(x0, y0 + j, '│', '#8a6438');
    const F = { flag: this.flag, flagLayers: this.flagLayers };
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w - 2; i++) {
        const u = (i + 0.5) / (w - 2);
        const top = flagColorAt(F, u, (j * 2 + 0.5) / (h * 2));
        const bot = flagColorAt(F, u, (j * 2 + 1.5) / (h * 2));
        g.text(x0 + 1 + i, y0 + j, '▀', top, bot);
      }
    }
  }

  // Her mainsail, with its mark.
  drawSail(g, x0, y0, w, h) {
    g.text(x0 - 1, y0 - 1, '─'.repeat(w + 2), '#6a4a2a');
    const mc = this.markColor || this.flag;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const u = (i + 0.5) / w;
        const c = (v) => (markAt(this.emblem, u, v) ? mc : this.sailCloth);
        g.text(x0 + i, y0 + j, '▀', c((j * 2 + 0.5) / (h * 2)), c((j * 2 + 1.5) / (h * 2)));
      }
    }
  }

  // Her hull, side on: paint above the waterline, trim along her rail.
  drawHull(g, x0, y0, w) {
    g.text(x0 + 1, y0, '▄'.repeat(w - 2), this.paint2);
    g.text(x0, y0 + 1, `▜${'█'.repeat(w - 3)}▛`, this.paint);
    g.text(x0 + 1, y0 + 2, '▀'.repeat(w - 2), this.paint, 'rgba(40,90,140,0.7)');
  }

  set(k, v) {
    this[k] = v;
    this.ui.audio?.play('select');
  }

  setLayer(k, v) {
    const L = this.flagLayers[this.sel];
    if (!L) return;
    L[k] = v;
    this.ui.audio?.play('select');
  }

  addLayer() {
    if (this.flagLayers.length >= FLAG_LAYERS_MAX) return;
    // (A shape not yet on it, in a colour that stands out from the field.)
    const used = new Set(this.flagLayers.map((q) => q.shape));
    const shape = MARKS.find((s) => !used.has(s)) || 'stripe';
    const color = PALETTE.find((c) => c !== this.flag && !this.flagLayers.some((q) => q.color === c)) || '#f0f0e8';
    this.flagLayers.push({ shape, color });
    this.sel = this.flagLayers.length - 1;
    this.ui.audio?.play('select');
  }

  moveLayer(i, d) {
    const j = i + d;
    if (j < 0 || j >= this.flagLayers.length) return;
    [this.flagLayers[i], this.flagLayers[j]] = [this.flagLayers[j], this.flagLayers[i]];
    this.sel = j;
    this.ui.audio?.play('select');
  }

  dropLayer(i) {
    this.flagLayers.splice(i, 1);
    this.sel = Math.min(this.sel, this.flagLayers.length - 1);
    this.ui.audio?.play('select');
  }

  save() {
    const S = this.S;
    const name = this.name.trim();
    if (name) S.name = name;
    S.flag = this.flag;
    S.flagLayers = cleanLayers(this.flagLayers);
    S.emblem = this.emblem;
    S.markColor = this.markColor;
    S.paint = this.paint;
    S.paint2 = this.paint2;
    S.sailCloth = this.sailCloth && this.sailCloth !== PLAIN_CLOTH ? this.sailCloth : null;
    S.ver = (S.ver || 0) + 1;
    S.dyn = null;
    this.ui.audio?.play('page');
    this.game?.ui?.msg(`Her plans marked and signed: ${S.name}, under her own colours.`, '#a0d8ff');
    this.close();
  }

  onKey(k) {
    if (k.code === 'Escape') this.close();
    else if (k.code === 'Enter' || k.code === 'NumpadEnter') this.save();
    else if (k.code === 'Backspace') this.name = this.name.slice(0, -1);
    else if (k.code === 'ArrowUp') this.sel = Math.max(-1, this.sel - 1);
    else if (k.code === 'ArrowDown') this.sel = Math.min(this.flagLayers.length - 1, this.sel + 1);
    else if ((k.code === 'ArrowLeft' || k.code === 'ArrowRight') && this.flagLayers[this.sel]) {
      const L = this.flagLayers[this.sel];
      const d = k.code === 'ArrowLeft' ? -1 : 1;
      this.setLayer('shape', MARKS[(MARKS.indexOf(L.shape) + d + MARKS.length) % MARKS.length]);
    } else if (k.key && k.key.length === 1 && !k.ctrl && /[\p{L}\p{N}' ,.!&-]/u.test(k.key) && this.name.length < NAME_MAX) this.name += k.key;
    return true;
  }
}
