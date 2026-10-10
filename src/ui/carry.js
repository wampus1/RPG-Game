// (Round 81) Bringing your worlds from the browser version into the desktop
// app (see game/carry.js): asked once, the first time the app's opened
// (and from Settings, General, after). What was found on this computer,
// to bring in at a click; or a folder or file to pick; or not now.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { agoText } from '../game/saves.js';
import { importBundle, reportLines, bundleSummary, CARRY_KEY } from '../game/carry.js';

const BG = '#100c18';

function button(w, g, x, y, width, label, fn, { color = C.fg, off = false } = {}) {
  const hov = !off && w.hovering(x, y, width, 1);
  g.fill(x, y, width, 1, ' ', C.fg, off ? '#15121b' : hov ? C.bgHi : '#1c1726');
  g.text(x + 1, y, label, off ? C.faint : hov ? C.white : color, undefined, width - 2);
  if (!off) w.hit(x, y, width, 1, fn);
}

// (A long path, its end kept.)
const tail = (p, n) => (p.length > n ? `…${p.slice(-(n - 1))}` : p);
// (The app's errors come with "Error invoking remote method ...: Error: ".)
const why = (e) => String((e && e.message) || e).replace(/^Error invoking remote method '[^']*': (Error: )?/, '');

export class CarryWindow extends Window {
  // `ctx`: { app, storage, store, modLib, onDone(changed) }. (`first`:
  // the app's first opening: "not now" is remembered, and not asked again.)
  constructor(ui, ctx, { first = false } = {}) {
    super(ui, 70, 26, { kind: 'carry' });
    this.ctx = ctx;
    this.first = first;
    this.step = 'look';
    this.found = [];
    this.lines = [];
    this.error = null;
    this.changed = false;
    ctx.app.carryFind().then((f) => {
      this.found = (f || []).filter((q) => q.summary && (q.summary.worlds.length || q.summary.account));
      if (this.step === 'look') this.step = 'ask';
    }, () => {
      if (this.step === 'look') this.step = 'ask';
    });
  }

  // A bundle (or its promise) brought in.
  async bring(get) {
    this.step = 'busy';
    this.error = null;
    try {
      const b = await get();
      if (!b) {
        // (Nothing picked.)
        this.step = 'ask';
        return;
      }
      const r = await importBundle(b, this.ctx);
      this.lines = reportLines(r);
      this.changed = this.changed || r.worlds.some((w) => ['added', 'newer', 'moved'].includes(w.status)) || !!r.account || r.mods > 0 || r.settings;
      this.step = 'done';
      this.ui.audio?.play('save');
    } catch (e) {
      this.error = why(e);
      this.step = 'ask';
      this.ui.audio?.play('error');
    }
  }

  // Not now: not asked again (Settings has it).
  skip() {
    if (this.first && this.ctx.storage.getItem(CARRY_KEY) === null) this.ctx.storage.setItem(CARRY_KEY, JSON.stringify({ state: 'skipped', at: Date.now() }));
    this.finish();
  }

  finish() {
    this.close();
    this.ctx.onDone && this.ctx.onDone(this.changed);
  }

  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, BG);
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, title: 'YOUR WORLDS FROM THE BROWSER' });
    let y = 2;
    const para = (text, col = C.fg) => {
      for (const l of wrap(text, this.w - 6)) g.text(3, y++, l, col);
    };
    if (this.step === 'look') {
      para('Tessera keeps its worlds in a folder of its own on this computer now. Looking for the ones you played in the browser version...', C.fg);
      return;
    }
    if (this.step === 'busy') {
      para('Bringing them in...', C.hi);
      return;
    }
    if (this.step === 'done') {
      for (const l of this.lines) {
        para(l, l.startsWith('Brought') ? C.green : l.startsWith('Made with') || l.includes('couldn\'t') ? C.orange : C.fg);
        y++;
      }
      button(this, g, 3, this.h - 3, 20, 'Done', () => this.finish(), { color: C.hi });
      return;
    }
    // Asking.
    para('Tessera keeps its worlds in a folder of its own on this computer now. Bring in the ones you played in the browser version?');
    y++;
    if (this.error) {
      para(this.error, C.red);
      y++;
    }
    if (!this.found.length) {
      para('None were found where they\'re usually kept. If you played it, pick the folder you ran it from (the one with "saves" in it), or a file the browser version saved everything to (Settings, General).', C.dim);
      y++;
    }
    for (const f of this.found.slice(0, 2)) {
      const s = f.summary;
      g.text(3, y++, `Found in ${tail(f.dir, this.w - 15)}:`, C.dim);
      for (const w of s.worlds.slice(0, 4)) {
        const m = w.meta;
        const name = m.world ? `"${m.world}" (hosted)` : `${m.name || 'Someone'}, day ${m.day ?? '?'}${m.place ? ` (${m.place})` : ''}`;
        g.text(5, y, `· ${name}`.slice(0, this.w - 22), C.fg);
        if (m.savedAt) g.text(this.w - 16, y, agoText(m.savedAt).slice(0, 13), C.faint);
        y++;
      }
      if (s.worlds.length > 4) g.text(5, y++, `and ${s.worlds.length - 4} more`, C.faint);
      if (s.account) g.text(5, y++, `· your account (${s.account})`.slice(0, this.w - 8), C.fg);
      button(this, g, 5, y++, 24, 'Bring them in', () => this.bring(() => this.ctx.app.carryRead(f.dir)), { color: C.hi });
      y++;
    }
    const by = this.h - 3;
    button(this, g, 3, by, 21, 'Pick a folder...', () => this.bring(() => this.ctx.app.carryPick('folder')));
    button(this, g, 25, by, 19, 'Pick a file...', () => this.bring(() => this.ctx.app.carryPick('file')));
    button(this, g, 45, by, 22, this.found.length ? 'Not now' : 'Start fresh', () => this.skip(), { color: C.dim });
    g.text(3, this.h - 2, 'You can do this later from Settings, General.', C.faint);
  }

  onKey(k) {
    if (k.code === 'Escape' && (this.step === 'ask' || this.step === 'done')) {
      if (this.step === 'done') this.finish();
      else this.skip();
    } else if ((k.code === 'Enter' || k.code === 'NumpadEnter') && this.step === 'done') this.finish();
    else if ((k.code === 'Enter' || k.code === 'NumpadEnter') && this.step === 'ask' && this.found.length) this.bring(() => this.ctx.app.carryRead(this.found[0].dir));
    return true;
  }
}

export { bundleSummary };
