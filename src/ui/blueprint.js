// (Round 69) A ship's blueprint table (see world/shipmodels.js: in her
// captain's cabin, or below in a sloop's hold): her plans spread on it,
// and on them her name, her colours and her paint, to be changed. Type to
// rename her; click a colour, an emblem, a paint; ENTER (or Save) to
// have it so.
import { Window } from './window.js';
import { C } from './ascii.js';
import { markAt } from '../render/shipvox.js';

export const FLAG_COLORS = ['#e0c040', '#a02020', '#2050a0', '#208040', '#f0f0e8', '#1a1a1a', '#8040a0', '#e07020', '#40b0c0', '#c03070'];
export const EMBLEMS = [null, 'stripe', 'cross', 'disc', 'saltire', 'quarter', 'chevron'];
export const HULL_PAINTS = ['#8a2a1e', '#2a4a8a', '#1e1e24', '#2a5a32', '#6a4a2a', '#e8e0d0', '#5a2a5a', '#a07820'];
const NAME_MAX = 24;

export class BlueprintWindow extends Window {
  constructor(ui, game, S) {
    super(ui, 64, 21, { kind: 'blueprint' });
    this.game = game;
    this.S = S;
    this.name = String(S.name || '');
    this.flag = S.flag || FLAG_COLORS[0];
    this.emblem = S.emblem || null;
    this.paint = S.paint || HULL_PAINTS[0];
    this.closeOnOutside = true;
  }

  draw(g) {
    const W = this.w;
    g.box(0, 0, W, this.h, { bg: 'rgba(20,30,48,0.96)', double: true, title: 'BLUEPRINT TABLE', fg: '#7ab0e0' });
    // (The plans: a faint grid.)
    for (let y = 2; y < this.h - 1; y += 2) g.text(2, y, '·'.repeat(W - 4), 'rgba(122,176,224,0.18)');
    g.text(3, 2, 'Her name', '#a8c8e8');
    const cur = Math.floor(Date.now() / 450) % 2 ? '_' : ' ';
    g.fill(3, 3, W - 6, 1, ' ', C.fg, 'rgba(232,224,200,0.12)');
    g.text(4, 3, `${this.name}${cur}`, '#fff0c0', undefined, W - 8);
    g.text(3, 4, '(type to rename her; backspace to rub out)', C.faint);
    // Her flag's colour.
    g.text(3, 6, 'Her colours', '#a8c8e8');
    FLAG_COLORS.forEach((c, i) => {
      const x = 4 + i * 4;
      const on = c === this.flag;
      g.text(x, 7, on ? '[' : ' ', C.hi);
      g.text(x + 1, 7, '██', c);
      g.text(x + 3, 7, on ? ']' : ' ', C.hi);
      this.hit(x, 7, 4, 1, () => this.set('flag', c));
    });
    // The mark on her mainsail.
    g.text(3, 9, 'The mark on her mainsail', '#a8c8e8');
    let x = 4;
    for (const em of EMBLEMS) {
      const t = em || 'none';
      const on = em === this.emblem;
      const hov = this.hovering(x, 10, t.length + 2, 1);
      g.text(x, 10, `${on ? '[' : ' '}${t}${on ? ']' : ' '}`, on ? C.hi : hov ? C.white : C.fg);
      this.hit(x, 10, t.length + 2, 1, () => this.set('emblem', em));
      x += t.length + 3;
    }
    // Her hull's paint.
    g.text(3, 12, 'Her paint', '#a8c8e8');
    HULL_PAINTS.forEach((c, i) => {
      const xx = 4 + i * 4;
      const on = c === this.paint;
      g.text(xx, 13, on ? '[' : ' ', C.hi);
      g.text(xx + 1, 13, '██', c);
      g.text(xx + 3, 13, on ? ']' : ' ', C.hi);
      this.hit(xx, 13, 4, 1, () => this.set('paint', c));
    });
    // How she'll look: her flag, and the mark on her sail.
    g.text(W - 19, 12, 'How she\'ll look', '#a8c8e8');
    this.preview(g, W - 18, 13);
    // Save, or leave it as it was.
    const sy = this.h - 3;
    const sv = this.hovering(6, sy, 15, 1);
    g.text(6, sy, '[ Save  ENTER ]', sv ? C.hi : '#c8e8c8', sv ? C.bgHi : undefined);
    this.hit(6, sy, 15, 1, () => this.save());
    const cv = this.hovering(25, sy, 14, 1);
    g.text(25, sy, '[ Leave  ESC ]', cv ? C.hi : C.fg, cv ? C.bgHi : undefined);
    this.hit(25, sy, 14, 1, () => this.close());
  }

  // A little flag, and her mainsail with its mark.
  preview(g, x0, y0) {
    g.text(x0, y0, '|', '#8a6438');
    g.text(x0 + 1, y0, '███', this.flag);
    for (let j = 1; j <= 5; j++) g.text(x0, y0 + j, '|', '#8a6438');
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 12; i++) {
        const u = (i + 0.5) / 12;
        const v = (j + 0.5) / 4;
        g.text(x0 + 2 + i, y0 + 1 + j, '█', markAt(this.emblem, u, v) ? this.flag : '#e8e0c8');
      }
    }
  }

  set(k, v) {
    this[k] = v;
    this.ui.audio?.play('select');
  }

  save() {
    const S = this.S;
    const name = this.name.trim();
    if (name) S.name = name;
    S.flag = this.flag;
    S.emblem = this.emblem;
    S.paint = this.paint;
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
    else if (k.key && k.key.length === 1 && !k.ctrl && /[\p{L}\p{N}' ,.!&-]/u.test(k.key) && this.name.length < NAME_MAX) this.name += k.key;
    return true;
  }
}
