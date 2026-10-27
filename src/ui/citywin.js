// (Round 146) The window on one of a town's great places (see
// game/cityplay.js for what's in it): what's on today and what came of
// it, its services, its board (the arena's card and the odds, the race
// card, the repertoire, the auction, the contracts, the swords for hire),
// and its story. Drawn from the quarter as it stands each time, so it's
// the same on every screen; what's chosen is done on the host, as
// whoever chose it.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { quarterView, quarterAct } from '../game/cityplay.js';
import { countItem } from '../game/inventory.js';

const W = 74;
const H = 32;

export class QuarterWindow extends Window {
  constructor(ui, sid, i, page = 'main') {
    super(ui, W, H, { kind: 'quarter' });
    this.sid = sid;
    this.qi = i;
    this.page = page;
    this.top = 0;
  }

  draw(g, game = this.ui.game) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, C.bg);
    const v = game && quarterView(game, this.sid, this.qi, this.page);
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: v ? v.title.toUpperCase() : 'CLOSED' });
    if (!v) {
      g.center(4, 'There\'s nothing here now.', C.faint);
      return;
    }
    // The heading: what it is, and what it's known for.
    g.center(1, v.sub, C.cyan);
    wrap(v.blurb, this.w - 8).slice(0, 2).forEach((l, k) => g.center(2 + k, l, C.dim));
    // The tabs.
    let x = 3;
    for (const t of v.tabs) {
      const on = t.id === this.page;
      const label = ` ${t.label} `;
      const hov = !on && this.hovering(x, 5, label.length, 1);
      g.text(x, 5, label, on ? '#1a1420' : hov ? C.white : C.fg, on ? C.hi : hov ? C.bgHi : C.bg2);
      if (!on) this.hit(x, 5, label.length, 1, () => {
        this.page = t.id;
        this.top = 0;
      });
      x += label.length + 1;
    }
    for (let k = 1; k < this.w - 1; k++) g.put(k, 6, '─', C.faint);
    // The page: its words, then what's to be done (scrolled if it's long).
    const out = [];
    for (const l of v.lines) for (const w of wrap(l.t, this.w - 6)) out.push({ t: w, c: l.c || C.fg });
    if (v.rows.length && out.length) out.push({ t: '' });
    for (const r of v.rows) out.push({ row: r });
    const y0 = 7;
    const rows = this.h - y0 - 3;
    this.top = Math.max(0, Math.min(this.top, out.length - rows));
    out.slice(this.top, this.top + rows).forEach((o, k) => {
      const y = y0 + k;
      if (!o.row) {
        g.text(3, y, o.t, o.c);
        return;
      }
      const r = o.row;
      const on = r.on !== false;
      const hov = on && this.hovering(2, y, this.w - 4, 1);
      if (hov) g.fill(2, y, this.w - 4, 1, ' ', C.fg, C.bgHi);
      g.text(3, y, `${on ? '›' : '·'} ${r.label}`.slice(0, this.w - 16), on ? (hov ? C.white : r.col || C.hi) : C.faint);
      if (r.right) g.text(this.w - 3 - r.right.length, y, r.right, on ? C.cyan : C.faint);
      if (on) this.hit(2, y, this.w - 4, 1, (ck, gm) => quarterAct(gm || game, this.sid, this.qi, r.act));
    });
    if (out.length > rows) {
      g.text(this.w - 3, y0, this.top > 0 ? '▲' : ' ', C.dim);
      g.text(this.w - 3, y0 + rows - 1, this.top + rows < out.length ? '▼' : ' ', C.dim);
    }
    // The foot: your purse, and the way out.
    for (let k = 1; k < this.w - 1; k++) g.put(k, this.h - 3, '─', C.faint);
    g.text(3, this.h - 2, `Your purse: ¤${countItem(game.player.inv, 'coin')}`, C.hi);
    g.text(this.w - 18, this.h - 2, 'ESC: close', C.dim);
  }

  onWheel(d) {
    this.top = Math.max(0, this.top + (d > 0 ? 2 : -2));
  }

  onKey(k) {
    if (k.code === 'Escape') {
      this.close();
      return true;
    }
    if (k.code === 'ArrowDown' || k.code === 'PageDown') {
      this.top += k.code === 'PageDown' ? 10 : 1;
      return true;
    }
    if (k.code === 'ArrowUp' || k.code === 'PageUp') {
      this.top = Math.max(0, this.top - (k.code === 'PageUp' ? 10 : 1));
      return true;
    }
    return false;
  }
}
