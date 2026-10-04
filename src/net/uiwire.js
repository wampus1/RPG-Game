// A player's windows, over the network (see host.js and guest.js). The
// host keeps each player's windows itself (their inventory, a chest, a
// trader, a conversation...), working on the one true world; it draws
// them as they'd look, cell by cell, and sends that to the player, whose
// screen shows them; what the player clicks and presses goes back.
import { Window } from '../ui/window.js';
import { Grid } from '../ui/ascii.js';
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
    if (w.drawPixels && pixels) {
      const url = pixels(w);
      const was = last.px && last.px.get(w.netId);
      if (url && url !== was) {
        win.px = url;
        (last.px ||= new Map()).set(w.netId, url);
      }
    }
    out.wins.push(win);
  }
  last.n = n;
  if (last.grids) for (const id of [...last.grids.keys()]) if (!ui.windows.some((w) => w.netId === id)) last.grids.delete(id);
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
  w.pxUrl = canvas.toDataURL();
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
    let w = ui.windows.find((q) => q.remote && q.netId === wf.id);
    if (!w) {
      w = new RemoteWindow(ui, wf);
      ui.windows.push(w);
    } else w.set(wf);
  }
  // (Gone at the host: gone here, at once; the host already let it fade.)
  ui.windows = ui.windows.filter((w) => !w.remote || keep.has(w.netId));
  ui.remoteTip = f.tip || null;
  ui.remoteStack = f.stack || null;
  if (f.fade !== undefined) ui.fade = Math.max(ui.fade || 0, f.fade);
  ui.ko = f.ko || null;
}
