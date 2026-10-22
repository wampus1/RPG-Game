// A player's windows, over the network (see host.js and guest.js). The
// host keeps each player's windows itself (their inventory, a chest, a
// trader, a conversation...), working on the one true world; it draws
// them as they'd look, cell by cell, and sends that to the player, whose
// screen shows them; what the player clicks and presses goes back.
import { Window } from '../ui/window.js';
import { Grid } from '../ui/ascii.js';
import { DocumentWindow } from '../ui/document.js';
import { FestWindow } from '../ui/festwin.js';
import { ForgeWindow } from '../ui/forgewin.js';
import { HAVEN_WINDOWS } from '../ui/havenwin.js';
import { CHAR_W, CHAR_H } from '../config.js';

// A grid of cells as text: its characters, and its colours by number in
// a palette.
export function packGrid(g) {
  const pal = [];
  const at = new Map();
  const idx = (c) => {
    const k = c === null || c === undefined ? '' : c;
    let i = at.get(k);
    if (i === undefined) {
      i = pal.length;
      pal.push(k);
      at.set(k, i);
    }
    return String.fromCharCode(48 + i);
  };
  let fg = '';
  let bg = '';
  for (let i = 0; i < g.ch.length; i++) {
    fg += idx(g.fg[i]);
    bg += idx(g.bg[i]);
  }
  return {
    w: g.w,
    h: g.h,
    ch: g.ch.join(''),
    fg,
    bg,
    pal,
    icons: g.icons.map((q) => [q.x, q.y, q.key, q.count, q.px, q.py]),
    // (Pictures by name: an account's, for one.)
    images: g.images.map((q) => (q.canvas && q.canvas.avatarKey ? [q.x, q.y, q.canvas.avatarKey, q.px, q.py] : null)).filter(Boolean),
  };
}

export function unpackGrid(p, g = new Grid(p.w, p.h), image = null) {
  if (g.w !== p.w || g.h !== p.h) g = new Grid(p.w, p.h);
  const n = p.w * p.h;
  const chars = Array.from(p.ch);
  for (let i = 0; i < n; i++) {
    g.ch[i] = chars[i] ?? ' ';
    const f = p.pal[p.fg.charCodeAt(i) - 48];
    const b = p.pal[p.bg.charCodeAt(i) - 48];
    g.fg[i] = f || '#e8d8b0';
    g.bg[i] = b === '' || b === undefined ? null : b;
  }
  g.icons.length = 0;
  for (const [x, y, key, count, px, py] of p.icons || []) g.icons.push({ x, y, key, count, px, py });
  g.images.length = 0;
  if (image) for (const [x, y, key, px, py] of p.images || []) {
    const c = image(key);
    if (c) g.images.push({ x, y, canvas: c, px, py });
  }
  return g;
}

// The host's side: what a player's windows look like now (drawn as them),
// each with the parts that have changed since `last`.
export function uiFrame(ui, game, last, pixels = null) {
  const out = { wins: [], tip: null, stack: null };
  ui.tooltip = null;
  let n = last.n || 0;
  for (const w of ui.windows) {
    if (!w.netId) w.netId = ++n;
    w.grid.clear();
    w.hits = [];
    try {
      w.draw(w.grid, game);
    } catch (e) {
      // (A window that can't be drawn this once is sent as it was.)
      void e;
    }
    const grid = JSON.stringify(packGrid(w.grid));
    const prev = last.grids && last.grids.get(w.netId);
    const win = { id: w.netId, kind: w.kind, x: w.x, y: w.y, w: w.w, h: w.h, modal: !!w.modal, state: w.state, p: Math.round(w.p * 100) / 100, seed: w.seed };
    if (prev !== grid) {
      win.grid = grid;
      (last.grids ||= new Map()).set(w.netId, grid);
    }
    // (Pictures a window draws itself, a lock or a map: as an image.)
    if (w.drawPixels && pixels && !w.fest && !w.mir && !w.forge) {
      const url = pixels(w);
      const was = last.px && last.px.get(w.netId);
      if (url && url !== was) {
        win.px = url;
        (last.px ||= new Map()).set(w.netId, url);
      }
    }
    // (Round 125) A letter or a page held up to read: what it says, for
    // the player's own screen to draw (see ui/document.js).
    // (Round 128: sent once; a whole book is too much to send again each
    // time something else on the screen changes.)
    if (w.doc) {
      last.docs ||= new Set();
      if (last.docs.has(w.netId)) win.docd = 1;
      else {
        win.doc = w.doc;
        last.docs.add(w.netId);
      }
    }
    // (Round 129) A festival's game: what's to be played, for the player's
    // own screen to play it (sent again when the standings come back).
    if (w.fest) {
      const j = JSON.stringify(w.fest);
      last.fests ||= new Map();
      if (last.fests.get(w.netId) === j) win.festd = 1;
      else {
        win.fest = w.fest;
        last.fests.set(w.netId, j);
      }
    }
    // (Round 132) The forge's games: what's to be made, for the player's
    // own screen to play (sent again when the piece comes back).
    if (w.forge) {
      const j = JSON.stringify(w.forge);
      last.forges ||= new Map();
      if (last.forges.get(w.netId) === j) win.forged = 1;
      else {
        win.forge = w.forge;
        last.forges.set(w.netId, j);
      }
    }
    // (Round 130) A window that draws itself on the player's own screen
    // (a haven's card, its council, a treasure map): what it shows, sent
    // when it changes (see ui/havenwin.js).
    if (w.mir) {
      const j = JSON.stringify(w.mir);
      last.mirs ||= new Map();
      if (last.mirs.get(w.netId) === j) win.mird = 1;
      else {
        win.mir = w.mir;
        last.mirs.set(w.netId, j);
      }
    }
    out.wins.push(win);
  }
  last.n = n;
  if (last.mirs) for (const id of [...last.mirs.keys()]) if (!ui.windows.some((w) => w.netId === id)) last.mirs.delete(id);
  if (last.fests) for (const id of [...last.fests.keys()]) if (!ui.windows.some((w) => w.netId === id)) last.fests.delete(id);
  if (last.forges) for (const id of [...last.forges.keys()]) if (!ui.windows.some((w) => w.netId === id)) last.forges.delete(id);
  if (last.grids) for (const id of [...last.grids.keys()]) if (!ui.windows.some((w) => w.netId === id)) last.grids.delete(id);
  if (last.docs) for (const id of [...last.docs]) if (!ui.windows.some((w) => w.netId === id)) last.docs.delete(id);
  out.tip = ui.tooltip || null;
  out.stack = ui.cursorStack ? { item: ui.cursorStack.item, count: ui.cursorStack.count } : null;
  out.fade = ui.fade || 0;
  out.ko = ui.ko ? { ...ui.ko } : null;
  return out;
}

// The host's side: a window's own pictures (a face, a lock, a map) drawn
// on `canvas` (its size), as an image to send; not more than ten times a
// second.
export function windowPixels(w, game, canvas, now) {
  if (w.pxAt !== undefined && now - w.pxAt < 100) return w.pxUrl;
  canvas.width = w.w * CHAR_W;
  canvas.height = w.h * CHAR_H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-w.x * CHAR_W, -w.y * CHAR_H);
  try {
    w.drawPixels(ctx, game);
  } catch (e) {
    void e;
  }
  ctx.restore();
  w.pxAt = now;
  // (Round 134: made into an image to send only if it's changed since the
  // last: a quick sum over its pixels first, which costs a fraction of the
  // picture's packing.)
  let h = 2166136261 >>> 0;
  try {
    const px = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i], 16777619);
    h = (h ^ (canvas.width * 65536 + canvas.height)) >>> 0;
  } catch {
    h = null;
  }
  if (h === null || h !== w.pxHash || !w.pxUrl) {
    w.pxHash = h;
    w.pxUrl = canvas.toDataURL();
  }
  return w.pxUrl;
}

// The player's side: one of the host's windows, as last sent.
export class RemoteWindow extends Window {
  constructor(ui, f) {
    super(ui, f.w, f.h, { kind: f.kind, x: f.x, y: f.y, modal: f.modal });
    this.remote = true;
    this.netId = f.id;
    this.packed = null;
    this.pixels = null;
    this.set(f);
  }

  set(f) {
    this.kind = f.kind;
    this.x = f.x;
    this.y = f.y;
    this.modal = f.modal;
    this.state = f.state === 'closing' ? 'closing' : f.state;
    this.p = f.p;
    this.seed = f.seed;
    if (f.grid) this.packed = JSON.parse(f.grid);
    if (this.packed && (this.w !== this.packed.w || this.h !== this.packed.h)) {
      this.w = this.packed.w;
      this.h = this.packed.h;
      this.grid = new Grid(this.w, this.h);
    }
    // (The new picture shown once it's ready: the old one till then.)
    if (f.px && typeof globalThis.Image !== 'undefined') {
      const img = new globalThis.Image();
      img.onload = () => {
        this.pixels = img;
      };
      img.src = f.px;
    }
  }

  draw(g) {
    if (this.packed) unpackGrid(this.packed, g, this.ui.imageFor || null);
  }

  // (Its own pictures, over it, as the host drew them: see windowPixels.)
  drawPixels(ctx) {
    if (this.pixels) ctx.drawImage(this.pixels, this.x * CHAR_W, this.y * CHAR_H);
  }

  // Keys and clicks on it are the host's to deal with (see guest.js).
  onKey() {
    return false;
  }

  onClick() {
    return true;
  }
}

// Bring the player's screen's windows into line with a frame from the
// host: new ones opened, gone ones closed, the rest updated.
export function applyFrame(ui, f) {
  const keep = new Set();
  for (const wf of f.wins) {
    keep.add(wf.id);
    // (Round 125) A page held up to read: this screen's own window, drawn
    // and read here (put down, it's put down at the host too).
    if (wf.doc || wf.docd) {
      // (One put down here is waiting on the host to put it down too.)
      if (wf.doc && !ui.windows.some((q) => q.mirrorOf === wf.id) && !(ui.putDown && ui.putDown.has(wf.id))) {
        const d = new DocumentWindow(ui, wf.doc, { mirror: true });
        d.mirrorOf = wf.id;
        ui.windows.push(d);
      }
      continue;
    }
    // (Round 129) A festival's game: played here, on this screen.
    if (wf.fest || wf.festd) {
      const m = ui.windows.find((q) => q.mirrorOf === wf.id);
      if (!m && wf.fest && !(ui.putDown && ui.putDown.has(wf.id))) {
        const d = new FestWindow(ui, wf.fest, { mirror: true });
        d.mirrorOf = wf.id;
        ui.windows.push(d);
      } else if (m && wf.fest && wf.fest.reply) m.fest.reply = wf.fest.reply;
      continue;
    }
    // (Round 132) The forge: worked here, on this screen.
    if (wf.forge || wf.forged) {
      const m = ui.windows.find((q) => q.mirrorOf === wf.id);
      if (!m && wf.forge && !(ui.putDown && ui.putDown.has(wf.id))) {
        const d = new ForgeWindow(ui, wf.forge, { mirror: true });
        d.mirrorOf = wf.id;
        ui.windows.push(d);
      } else if (m && wf.forge && wf.forge.reply) m.forge.reply = wf.forge.reply;
      continue;
    }
    // (Round 130) One of a haven's windows: drawn here, on this screen.
    if (wf.mir || wf.mird) {
      const m = ui.windows.find((q) => q.mirrorOf === wf.id);
      const C = wf.mir && HAVEN_WINDOWS[wf.mir.k];
      if (!m && C && !(ui.putDown && ui.putDown.has(wf.id))) {
        const d = new C(ui, wf.mir.d, { mirror: true });
        d.mirrorOf = wf.id;
        ui.windows.push(d);
      } else if (m && wf.mir && m.remirror) m.remirror(wf.mir.d);
      continue;
    }
    let w = ui.windows.find((q) => q.remote && q.netId === wf.id);
    if (!w) {
      w = new RemoteWindow(ui, wf);
      ui.windows.push(w);
    } else w.set(wf);
  }
  // (Gone at the host: gone here, at once; the host already let it fade.)
  ui.windows = ui.windows.filter((w) => {
    const stay = w.mirrorOf ? keep.has(w.mirrorOf) || w.state === 'closing' : !w.remote || keep.has(w.netId);
    // (A game the host's put away: its tune stopped here too.)
    if (!stay && w.cleanup) w.cleanup();
    return stay;
  });
  if (ui.putDown) for (const id of [...ui.putDown]) if (!keep.has(id)) ui.putDown.delete(id);
  ui.remoteTip = f.tip || null;
  ui.remoteStack = f.stack || null;
  if (f.fade !== undefined) ui.fade = Math.max(ui.fade || 0, f.fade);
  ui.ko = f.ko || null;
}
