// Talking to one of a mod's people (round 62): their line, written out a
// letter at a time, and the answers to pick from (see the Workshop's Say
// nodes, and mod/hooks.js). A line with no answers goes on with "Go on".
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { ROWS } from '../config.js';
import { creatureSheet, humanoidSheet, CHAR_W, SHEET_H } from '../render/sprites.js';

export class ModTalkWindow extends Window {
  constructor(ui, o) {
    super(ui, 72, 15, { kind: 'modtalk', y: ROWS - 16 });
    this.o = o;
    this.set(o);
  }

  set(o) {
    this.o = o;
    this.lines = wrap(o.text || '', this.w - 18);
    this.shown = 0;
    this.choices = o.choices && o.choices.length ? o.choices : ['Go on.'];
    this.picked = false;
    this.last = null;
  }

  // The last line, and nothing more to say.
  end(text) {
    if (!text) return this.close();
    this.lines = wrap(text, this.w - 18);
    this.shown = 0;
    this.choices = ['Farewell.'];
    this.o = { ...this.o, onPick: null };
    this.last = true;
  }

  get speaker() {
    return this.o.speaker;
  }

  update(dt) {
    const full = this.lines.join(' ').length;
    if (this.shown < full) this.shown = Math.min(full, this.shown + dt * 60);
  }

  draw(g) {
    const sp = this.speaker;
    // (A ship's hand's name is their first and last: round 69.)
    const nm = sp && sp.name && typeof sp.name === 'object' ? `${sp.name.first || ''} ${sp.name.last || ''}`.trim() : sp && sp.name;
    const name = String(nm || 'Someone');
    const title = sp && sp.S && sp.S.title ? `, ${sp.S.title}` : '';
    g.box(0, 0, this.w, this.h, { bg: 'rgba(16,12,22,0.95)', double: true, title: `${name.toUpperCase()}${title}` });
    // Their picture.
    if (sp) {
      try {
        const img = sp.look ? humanoidSheet(sp.look) : creatureSheet(sp.species, sp.variant || 0);
        if (img) {
          const c = document.createElement('canvas');
          const big = !sp.look && img.height > 16;
          const fw = sp.look ? CHAR_W : img.height;
          const fh = sp.look ? SHEET_H : img.height;
          c.width = fw;
          c.height = fh;
          c.getContext('2d').drawImage(img, 0, 0, fw, fh, 0, 0, fw, fh);
          g.fill(2, 2, 12, 7, ' ', C.fg, 'rgba(40,32,52,0.9)');
          g.image(3 + (big ? 0 : 2), 2, c, 2, 4);
        }
      } catch {
        // (No picture to be had: the words alone.)
      }
    }
    // The words, as far as they've been said.
    let left = Math.floor(this.shown);
    this.lines.forEach((l, i) => {
      const s = l.slice(0, Math.max(0, left));
      left -= l.length + 1;
      g.text(16, 2 + i, s, C.white);
    });
    const done = Math.floor(this.shown) >= this.lines.join(' ').length;
    if (!done) {
      g.text(this.w - 22, this.h - 1, ' [SPACE] skip ', C.faint);
      this.hit(0, 0, this.w, this.h, () => (this.shown = 1e9));
      return;
    }
    const y0 = this.h - 1 - this.choices.length - 1;
    this.choices.forEach((t, i) => {
      const y = y0 + i;
      const hov = this.hovering(16, y, this.w - 18, 1);
      g.fill(16, y, this.w - 18, 1, ' ', C.fg, hov ? C.bgHi : 'rgba(30,24,40,0.9)');
      g.text(17, y, `${i + 1}. ${t}`, hov ? C.hi : C.fg, undefined, this.w - 20);
      this.hit(16, y, this.w - 18, 1, () => this.pick(i));
    });
    g.text(this.w - 16, this.h - 1, ' [ESC] leave ', C.faint);
  }

  pick(i) {
    if (this.picked) return;
    if (this.last || !this.o.onPick) return this.close();
    this.picked = true;
    const before = this.o;
    this.ui.audio?.play('select');
    try {
      this.o.onPick(i);
    } finally {
      // (Nothing more said after it: the talk's over.)
      if (this.o === before && !this.last) this.close();
    }
  }

  onKey(k) {
    const full = this.lines.join(' ').length;
    if ((k.code === 'Space' || k.code === 'Enter') && this.shown < full) {
      this.shown = 1e9;
      return true;
    }
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[k.code];
    if (n !== undefined && n < this.choices.length && this.shown >= full) {
      this.pick(n);
      return true;
    }
    if ((k.code === 'Space' || k.code === 'Enter') && this.choices.length === 1) {
      this.pick(0);
      return true;
    }
    return false;
  }

  close() {
    const sp = this.speaker;
    if (sp) sp.talkT = 0;
    super.close();
  }
}
