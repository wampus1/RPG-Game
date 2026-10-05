// Your achievements (see game/achievements.js): what each takes, which
// you've done, and the title each unlocks; pick one you've earned to go by
// (L in the game, or from your account).
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { FEATS } from '../game/achievements.js';

const PANEL = '#100c18';
const LIST_Y = 5;
const LIST_H = 20;

export class FeatsWindow extends Window {
  // `got()`: what's been done (id: when). `title()`: the title gone by now.
  // `setTitle(t)`: go by `t` ('' for none); false if there's no account to
  // wear it (null when there's no way to set one at all).
  constructor(ui, { got, title, setTitle = null }) {
    super(ui, 72, 34, { kind: 'feats' });
    this.got = got;
    this.title = title;
    this.setTitle = setTitle;
    this.sel = 0;
    this.top = 0;
    this.note = null;
  }

  draw(g) {
    const got = this.got() || {};
    const have = FEATS.filter((f) => got[f.id]).length;
    const cur = this.title() || '';
    g.fill(0, 0, this.w, this.h, ' ', C.fg, PANEL);
    g.box(0, 0, this.w, this.h, { bg: PANEL, double: true, title: 'ACHIEVEMENTS' });
    g.text(2, 2, `${have} of ${FEATS.length} done. Each unlocks a title to go by.`, C.dim);
    g.text(2, 3, `Your title: ${cur || 'none'}`, cur ? C.hi : C.faint);
    // The list (it scrolls).
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + LIST_H) this.top = this.sel - LIST_H + 1;
    for (let i = 0; i < LIST_H; i++) {
      const k = this.top + i;
      const f = FEATS[k];
      if (!f) break;
      const y = LIST_Y + i;
      const done = !!got[f.id];
      const sel = k === this.sel;
      const hov = this.hovering(1, y, this.w - 3, 1);
      g.fill(1, y, this.w - 3, 1, ' ', C.fg, sel ? C.bgSel : hov ? C.bgHi : undefined);
      g.text(2, y, done ? '■' : '□', done ? C.hi : C.faint);
      g.text(4, y, f.name, done ? C.white : C.dim, undefined, 26);
      const tag = done ? (f.title === cur ? `${f.title} (worn)` : f.title) : `${f.title} (locked)`;
      g.text(31, y, tag, done ? (f.title === cur ? C.hi : C.cyan) : C.faint, undefined, this.w - 34);
      this.hit(1, y, this.w - 3, 1, () => {
        if (this.sel === k) this.wear(f, got);
        this.sel = k;
      });
    }
    // (Where you are in it.)
    if (FEATS.length > LIST_H) {
      const bar = Math.max(1, Math.round((LIST_H * LIST_H) / FEATS.length));
      const at = Math.round((this.top / (FEATS.length - LIST_H)) * (LIST_H - bar));
      for (let i = 0; i < LIST_H; i++) g.put(this.w - 2, LIST_Y + i, i >= at && i < at + bar ? '█' : '│', C.faint);
    }
    // What the chosen one takes.
    const f = FEATS[this.sel];
    if (f) {
      const done = got[f.id];
      const lines = wrap(f.about, this.w - 6);
      lines.slice(0, 2).forEach((l, i) => g.text(3, LIST_Y + LIST_H + 1 + i, l, C.fg));
      const when = done && done > 1 ? new Date(done).toLocaleDateString() : null;
      g.text(3, LIST_Y + LIST_H + 3, done ? `Done${when ? ` on ${when}` : ''}. Unlocks the title "${f.title}".` : `Not done yet. Unlocks the title "${f.title}".`, done ? C.green : C.faint);
    }
    if (this.note) g.text(3, this.h - 4, this.note, C.orange, undefined, this.w - 6);
    const hint = this.setTitle ? '↑↓ choose · ENTER go by this title (again: none) · ESC close' : '↑↓ choose · ESC close';
    g.text(2, this.h - 2, hint, C.faint);
  }

  // Go by the chosen one's title (or by none, if you already do).
  wear(f, got) {
    if (!this.setTitle) return;
    if (!got[f.id]) {
      this.note = 'Not unlocked yet.';
      this.ui.audio?.play('error');
      return;
    }
    const t = this.title() === f.title ? '' : f.title;
    const ok = this.setTitle(t);
    if (ok === false) {
      this.note = 'Make an account (the multiplayer menu) to go by a title.';
      return;
    }
    this.note = t ? `You now go by "${t}".` : 'You go by no title now.';
    this.ui.audio?.play('select');
  }

  onKey(k) {
    if (k.code === 'Escape' || k.code === 'KeyL') this.close();
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.sel = Math.max(0, this.sel - 1);
    else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.sel = Math.min(FEATS.length - 1, this.sel + 1);
    else if (k.code === 'PageUp') this.sel = Math.max(0, this.sel - LIST_H);
    else if (k.code === 'PageDown') this.sel = Math.min(FEATS.length - 1, this.sel + LIST_H);
    else if (k.code === 'Enter' || k.code === 'Space') this.wear(FEATS[this.sel], this.got() || {});
    return true;
  }

  onWheel(d) {
    this.sel = Math.max(0, Math.min(FEATS.length - 1, this.sel + Math.sign(d)));
  }
}
