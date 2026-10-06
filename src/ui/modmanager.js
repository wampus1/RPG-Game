// The world's mods, from the pause menu (round 67): which are in it (the
// very versions it was made with), whether you've a newer one of each in
// your library, and the rest of your library to add. Mods taken out,
// updated or added come into the world when it's saved and loaded again,
// as a world keeps its mods' blocks by number from the start (see
// registry.installMods): the Apply button does both.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { picCanvas } from './modpick.js';

// What's to become of a mod: kept as it is, taken out, its newer version
// put in (one of the world's), or added (one of your library's).
export const KEEP = 'keep';
export const OUT = 'out';
export const NEWER = 'newer';
export const ADD = 'add';

// The plan as asked of whoever applies it: { remove, update, add } (ids).
export function planOf(rows) {
  const out = { remove: [], update: [], add: [] };
  for (const r of rows) {
    if (r.inWorld && r.to === OUT) out.remove.push(r.id);
    else if (r.inWorld && r.to === NEWER) out.update.push(r.id);
    else if (!r.inWorld && r.to === ADD) out.add.push(r.id);
  }
  return out;
}
export const planEmpty = (p) => !p.remove.length && !p.update.length && !p.add.length;

export class ModManagerWindow extends Window {
  // o: { world: [{ id, name, version, author, color, pic, things,
  // description, newer (a version string, or null) }], library: [same,
  // not in the world], locked (why it can't be changed now, or null),
  // onApply(plan), onWorkshop() }
  constructor(ui, o) {
    super(ui, 76, 30, { kind: 'modmanager' });
    this.o = o;
    this.rows = [
      ...o.world.map((m) => ({ ...m, inWorld: true, to: KEEP })),
      ...o.library.map((m) => ({ ...m, inWorld: false, to: KEEP })),
    ];
    this.at = 0;
    this.scroll = 0;
  }

  get shown() {
    // (Room for the two headings too.)
    return Math.floor((this.h - 13) / 2) - 1;
  }

  // A row's next state, clicked (or Space).
  cycle(r) {
    if (this.o.locked) return;
    if (!r.inWorld) r.to = r.to === ADD ? KEEP : ADD;
    else if (r.to === KEEP) r.to = r.newer ? NEWER : OUT;
    else if (r.to === NEWER) r.to = OUT;
    else r.to = KEEP;
  }

  draw(g) {
    const o = this.o;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#100c18');
    g.box(0, 0, this.w, this.h, { bg: '#100c18', double: true, title: 'THIS WORLD\'S MODS' });
    g.text(3, 2, (o.locked || 'Click a mod to change what becomes of it, then apply.').slice(0, this.w - 6), o.locked ? C.orange : C.dim);
    const rows = this.rows;
    if (!rows.length) g.text(3, 4, 'No mods in this world, and none in your library: make one in the Workshop.', C.fg);
    this.at = Math.max(0, Math.min(rows.length - 1, this.at));
    if (this.at < this.scroll) this.scroll = this.at;
    if (this.at >= this.scroll + this.shown) this.scroll = this.at - this.shown + 1;
    let y = 4;
    let lastIn = null;
    for (let i = 0; i < this.shown && this.scroll + i < rows.length; i++) {
      const r = rows[this.scroll + i];
      if (r.inWorld !== lastIn) {
        // (A heading over each group: the world's, then your library's.)
        g.text(3, y, r.inWorld ? 'IN THIS WORLD' : 'IN YOUR LIBRARY (NOT IN IT)', C.hi);
        y++;
        lastIn = r.inWorld;
      }
      if (y + 1 >= this.h - 6) break;
      const cur = this.scroll + i === this.at;
      const hov = this.hovering(2, y, this.w - 4, 2);
      g.fill(2, y, this.w - 4, 2, ' ', C.fg, cur ? '#2e2616' : hov ? '#1e1828' : '#100c18');
      const pc = picCanvas(r.pic);
      if (pc) g.image(3, y, pc, 2, 0);
      else g.text(4, y, '■', r.color || C.hi);
      const gone = r.inWorld && r.to === OUT;
      g.text(7, y, `${r.name}`.slice(0, 34), gone ? C.faint : C.white);
      g.text(7 + Math.min(34, r.name.length) + 1, y, `v${r.version || '1.0.0'}`, C.faint);
      const [tag, col] = r.inWorld
        ? r.to === OUT ? ['TAKEN OUT', C.orange] : r.to === NEWER ? [`UPDATE TO v${r.newer}`, C.hi] : ['IN', C.green || C.hi]
        : r.to === ADD ? ['ADDED', C.hi] : ['not in it', C.faint];
      g.text(this.w - 4 - tag.length, y, tag, col);
      const sub = [r.author ? `by ${r.author}` : null, `${r.things || 0} thing${r.things === 1 ? '' : 's'}`, r.inWorld && r.newer && r.to !== NEWER ? `you have v${r.newer}` : null, r.description ? wrap(r.description, 40)[0] : null].filter(Boolean).join(' · ');
      g.text(7, y + 1, sub.slice(0, this.w - 12), C.dim);
      this.hit(2, y, this.w - 4, 2, () => {
        this.at = this.scroll + i;
        this.cycle(r);
      });
      y += 2;
    }
    if (rows.length > this.shown) g.text(this.w - 12, 3, `${this.scroll + 1}-${Math.min(rows.length, this.scroll + this.shown)}/${rows.length}`, C.faint);
    const plan = planOf(rows);
    const n = plan.remove.length + plan.update.length + plan.add.length;
    const note = n ? `${n} change${n > 1 ? 's' : ''}: the world is saved and loaded again with ${n > 1 ? 'them' : 'it'}. Blocks of a mod taken out are left as gaps.` : '[SPACE] change  [UP/DOWN] choose';
    wrap(note, this.w - 6).slice(0, 2).forEach((l, i) => g.text(3, this.h - 6 + i, l, n ? C.orange : C.faint));
    const by = this.h - 3;
    const btn = (x, label, fn, col) => {
      const w = label.length + 2;
      const hov = this.hovering(x, by, w, 1);
      g.fill(x, by, w, 1, ' ', C.fg, hov ? C.bgHi : '#1a1622');
      g.text(x + 1, by, label, hov ? C.white : col);
      this.hit(x, by, w, 1, fn);
      return x + w + 2;
    };
    let x = 3;
    if (n && !o.locked) x = btn(x, '[ENTER] Apply (save and reload)', () => this.apply(), C.hi);
    if (n) btn(x, '[R] Undo changes', () => this.reset(), C.fg);
    btn(this.w - 13, '[ESC] Back', () => this.close(), C.dim);
  }

  reset() {
    for (const r of this.rows) r.to = KEEP;
  }

  apply() {
    const plan = planOf(this.rows);
    if (planEmpty(plan) || this.o.locked) return;
    this.close();
    this.o.onApply(plan);
  }

  onKey(k) {
    const rows = this.rows;
    if (k.code === 'ArrowDown') this.at = Math.min(rows.length - 1, this.at + 1);
    else if (k.code === 'ArrowUp') this.at = Math.max(0, this.at - 1);
    else if (k.code === 'Space' && rows[this.at]) this.cycle(rows[this.at]);
    else if (k.code === 'Enter') this.apply();
    else if (k.code === 'KeyR') this.reset();
    else if (k.code === 'Escape') this.close();
    else return false;
    return true;
  }

  onWheel(d) {
    this.at = Math.max(0, Math.min(this.rows.length - 1, this.at + (d > 0 ? 1 : -1)));
  }
}
