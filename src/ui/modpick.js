// Mods for a new world (round 62): those in your library (made in the
// Workshop, or brought in from a file or from a world you joined), ticked
// to go into it. A world keeps the very versions it was made with, so it
// always plays the same; others joining it are offered them.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';

export class ModPickWindow extends Window {
  // o: { list: [{ id, name, version, author, color, description, things,
  // mine }], chosen: [ids], title, go (label), onDone(ids), onBack(),
  // onWorkshop() }
  constructor(ui, o) {
    super(ui, 74, Math.min(30, 13 + Math.max(3, o.list.length) * 2), { kind: 'modpick' });
    this.o = o;
    this.chosen = new Set(o.chosen || []);
    this.at = 0;
    this.scroll = 0;
  }

  get rows() {
    return Math.max(3, Math.floor((this.h - 12) / 2));
  }

  draw(g) {
    const o = this.o;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#100c18');
    g.box(0, 0, this.w, this.h, { bg: '#100c18', double: true, title: o.title || 'MODS FOR THIS WORLD' });
    g.text(3, 2, 'Tick the mods to put in it (it keeps these versions for good).', C.dim);
    const list = o.list;
    if (!list.length) g.text(3, 4, 'No mods yet: make one in the Workshop (W), or import one there.', C.fg);
    this.at = Math.max(0, Math.min(list.length - 1, this.at));
    if (this.at < this.scroll) this.scroll = this.at;
    if (this.at >= this.scroll + this.rows) this.scroll = this.at - this.rows + 1;
    for (let i = 0; i < this.rows && this.scroll + i < list.length; i++) {
      const m = list[this.scroll + i];
      const y = 4 + i * 2;
      const on = this.chosen.has(m.id);
      const hov = this.hovering(2, y, this.w - 4, 2);
      const cur = this.scroll + i === this.at;
      g.fill(2, y, this.w - 4, 2, ' ', C.fg, cur ? '#2e2616' : hov ? '#1e1828' : '#100c18');
      g.text(3, y, on ? '[x]' : '[ ]', on ? C.hi : C.dim);
      g.text(7, y, '■', m.color || C.hi);
      g.text(9, y, `${m.name}`.slice(0, 40), on ? C.white : C.fg);
      g.text(9 + Math.min(40, m.name.length) + 1, y, `v${m.version || '1.0.0'}`, C.faint);
      g.text(this.w - 22, y, `${m.things || 0} thing${m.things === 1 ? '' : 's'}`.padStart(18), C.faint);
      const sub = [m.author ? `by ${m.author}` : null, m.mine ? 'yours' : 'from someone else', m.description ? wrap(m.description, 44)[0] : null].filter(Boolean).join(' · ');
      g.text(9, y + 1, sub.slice(0, this.w - 14), C.dim);
      this.hit(2, y, this.w - 4, 2, () => {
        this.at = this.scroll + i;
        this.toggle(m.id);
      });
    }
    if (list.length > this.rows) g.text(this.w - 12, 3, `${this.scroll + 1}-${Math.min(list.length, this.scroll + this.rows)}/${list.length}`, C.faint);
    const y = this.h - 3;
    const btn = (x, label, fn, col) => {
      const w = label.length + 2;
      const hov = this.hovering(x, y, w, 1);
      g.fill(x, y, w, 1, ' ', C.fg, hov ? C.bgHi : '#1a1622');
      g.text(x + 1, y, label, hov ? C.white : col);
      this.hit(x, y, w, 1, fn);
      return x + w + 2;
    };
    const x = btn(3, `[ENTER] ${o.go || 'Next'}${this.chosen.size ? ` (${this.chosen.size} mod${this.chosen.size > 1 ? 's' : ''})` : ' (no mods)'}`, () => this.done(), C.hi);
    if (o.onWorkshop) btn(x, '[W] Workshop', () => {
      this.close();
      o.onWorkshop();
    }, C.fg);
    btn(this.w - 13, '[ESC] Back', () => this.back(), C.dim);
    g.text(3, this.h - 5, '[SPACE] tick  [UP/DOWN] choose  [A] all/none', C.faint);
  }

  toggle(id) {
    if (this.chosen.has(id)) this.chosen.delete(id);
    else this.chosen.add(id);
  }

  done() {
    this.close();
    this.o.onDone([...this.chosen]);
  }

  back() {
    this.close();
    this.o.onBack?.();
  }

  onKey(k) {
    const list = this.o.list;
    if (k.code === 'ArrowUp') this.at = Math.max(0, this.at - 1);
    else if (k.code === 'ArrowDown') this.at = Math.min(list.length - 1, this.at + 1);
    else if (k.code === 'Space' && list[this.at]) this.toggle(list[this.at].id);
    else if (k.code === 'KeyA') {
      if (this.chosen.size === list.length) this.chosen.clear();
      else for (const m of list) this.chosen.add(m.id);
    } else if (k.code === 'Enter') this.done();
    else if (k.code === 'KeyW' && this.o.onWorkshop) {
      this.close();
      this.o.onWorkshop();
    } else if (k.code === 'Escape') this.back();
    return true;
  }

  onWheel(d) {
    this.at = Math.max(0, Math.min(this.o.list.length - 1, this.at + (d > 0 ? 1 : -1)));
  }
}
