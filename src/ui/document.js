// (Round 125) A letter, a note, a page of a book, held up to read: the
// thing itself, drawn as paper over the darkened game, tilting a little as
// the mouse moves (as a page in the hand does), lit by a sheen that slides
// across it. It's written in its writer's own hand (see hands.js): every
// writer a hand of their own. Click the page for the easier reading of it:
// the world behind blurred away, the page held flat and still, the words
// in plain print. Click it again for the hand; Esc (or a click off the
// page) to put it down.
//
// It's drawn on a layer of its own, twice as fine as the view each way
// (see render/overlay.js): fine enough for handwriting, a little coarse
// still, and it goes through the screen's CRT with everything else. In a
// test, with nothing to draw on, the window still holds what it says.
import { Window } from './window.js';
import { handFor, signerOf, loadHands, PRINT } from './hands.js';
import { isBookDoc, paginate, paintPaper, paintEndpaper, paintRows, ornament } from './bookview.js';
import { typeFor } from './booktype.js';
import { overlay, overlayCtx, OVER_W, OVER_H, OVER_SCALE } from '../render/overlay.js';
import { drawText, textWidth } from '../render/font.js';
import { COLS, ROWS } from '../config.js';

// Paper of each kind: how wide (of the screen), its colour, its marks.
const PAPERS = {
  letter: { w: 0.5, base: '#efe2c0', edge: 'rgba(120,80,30,0.5)', folds: true, seal: true },
  note: { w: 0.38, base: '#ece0c4', edge: 'rgba(110,80,40,0.45)', torn: true, tilt: -2.2 },
  map: { w: 0.55, base: '#e2cf9e', edge: 'rgba(110,70,20,0.55)', folds: true },
  book: { w: 0.5, base: '#f1e6cc', edge: 'rgba(120,90,50,0.38)', ruled: true },
  page: { w: 0.48, base: '#efe4c8', edge: 'rgba(120,90,50,0.42)' },
};
const PRINT_FONT = "Georgia, 'Times New Roman', serif";
const PERSPECTIVE = 1400 * (OVER_W / 1024);

function rngOf(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// The grain of paper: flecks and fibres, laid over it (once).
let grain = null;
function grainOf() {
  if (grain || typeof document === 'undefined') return grain;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const r = rngOf(77);
  for (let i = 0; i < 2600; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? `rgba(90,60,20,${(0.04 + r() * 0.08).toFixed(3)})` : `rgba(255,250,235,${(0.05 + r() * 0.08).toFixed(3)})`;
    g.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), 1 + (r() < 0.15 ? 1 : 0), 1);
  }
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(110,80,40,${(0.05 + r() * 0.06).toFixed(3)})`;
    g.beginPath();
    const x = r() * 128;
    const y = r() * 128;
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 6);
    g.stroke();
  }
  grain = c;
  return grain;
}

// Words wrapped to a width, in the context's font.
function wrapTo(g, text, w) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && g.measureText(next).width > w) {
      out.push(line);
      line = word;
    } else line = next;
  }
  out.push(line);
  return out;
}

export class DocumentWindow extends Window {
  // `doc`: { title, lines, kind (letter, note, map, book, page), from
  // (whoever wrote it, for their hand), key (failing that, whose papers
  // these are: a story's) }.
  // (`mirror`: another's page, shown on a player's screen in someone
  // else's world: see net/uiwire.js.)
  constructor(ui, doc, { mirror = false } = {}) {
    // (The whole screen: a click anywhere is the page's, or puts it down.)
    super(ui, COLS, ROWS, { kind: 'document', x: 0, y: 0 });
    this.mirror = mirror;
    this.doc = { kind: 'page', ...doc, lines: (doc.lines || []).map((l) => String(l ?? '')) };
    const k = this.doc.kind;
    this.paper = PAPERS[k] || PAPERS.page;
    this.printed = k === 'book';
    this.signer = this.doc.signer || signerOf(this.doc.lines);
    // (Whoever wrote it, or signed it; else one hand for all of a story's
    // papers.)
    this.hand = this.printed ? PRINT : handFor(this.doc.from || this.signer || this.doc.key || this.doc.title);
    this.easy = false;
    // (Round 126) A book: held open, two pages at a time (see bookview.js).
    this.bookMode = isBookDoc(this.doc);
    // (Round 128) Set as its writer's people set their books (booktype.js).
    this.type = this.bookMode ? typeFor(this.doc) : null;
    this.spread = 0;
    this.turn = null;
    this.laid = null;
    this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    this.scroll = 0;
    this.page = null;
    this.dirty = true;
    this.poly = null;
    this.seed = [...`${this.doc.title}${this.doc.lines.join('')}`].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
    loadHands().then(() => {
      this.dirty = true;
    });
  }

  // Put down: a page that's the host's is put down there too.
  putDown() {
    this.close();
  }

  close() {
    if (this.mirror && this.state !== 'closing') {
      (this.ui.forward ||= []).push({ code: 'Escape', key: 'Escape' });
      (this.ui.putDown ||= new Set()).add(this.mirrorOf);
    }
    super.close();
  }

  toggleEasy() {
    this.easy = !this.easy;
    this.scroll = 0;
    this.dirty = true;
    this.turn = null;
    this.ui.audio?.play('page');
  }

  // ------------------------------------------------------------ a book
  // How many spreads the book has (two pages each: the inside of the cover
  // and the title page first).
  get spreads() {
    return this.laid ? this.laid.leaves.length / 2 : 1;
  }

  // Turn to the next spread (or back), with the leaf turning over.
  turnPage(dir) {
    if (!this.bookMode) return false;
    if (!this.laid && typeof document !== 'undefined') this.paint();
    const to = this.spread + dir;
    if (to < 0 || to >= this.spreads) return false;
    // (Turned again before the last leaf's down: that one's down at once.)
    this.turn = typeof document !== 'undefined' ? { from: this.spread, to, dir, t: 0 } : null;
    this.spread = to;
    this.dirty = true;
    this.ui.audio?.play('page');
    return true;
  }

  // The book set in type for the page it's on: its pages, and what's on
  // each of the leaves in order (the endpapers, the title page, the text).
  layBook(g) {
    const easy = this.easy;
    const key = easy ? 'easy' : 'print';
    if (this.laid && this.laid.key === key) return this.laid;
    const PW = Math.round(OVER_W * (easy ? 0.44 : 0.41));
    const PH = Math.round(OVER_H * (easy ? 0.87 : 0.86));
    const board = Math.round(PW * 0.035);
    const size = OVER_W * (easy ? 0.0158 : 0.0166);
    const ty = this.type;
    const face = (style) => (!ty ? PRINT.font : style === 'head' ? ty.head : style === 'cap' ? ty.cap : ty.body);
    const font = (sz, style) => {
      const it = style === 'sign' || style === 'sub' ? 'italic ' : '';
      return easy ? `${style === 'head' ? 'bold ' : ''}${it}${sz.toFixed(1)}px ${PRINT_FONT}` : `${it}${sz.toFixed(1)}px '${face(style)}', '${PRINT.font}', Georgia, serif`;
    };
    // (Headings spread letter by letter, where the people set them so.)
    const spread = !easy && ty && ty.heads === 'spaced';
    const measure = (t, sz, style) => {
      g.font = font(sz, style);
      return g.measureText(t).width + (spread && style === 'head' ? String(t).length * size * 0.14 : 0);
    };
    const pad = { top: PH * 0.095, bottom: PH * 0.095, outer: PW * 0.11, inner: PW * 0.095 };
    const pages = paginate(this.doc.lines, { w: PW - pad.outer - pad.inner, h: PH - pad.top - pad.bottom, size, measure, lh: easy ? 1.42 : 1.3, type: easy ? null : ty });
    const leaves = ['end', 'title', ...pages];
    if (leaves.length % 2) leaves.push('blank');
    leaves.push('blank', 'end');
    const old = this.laid;
    this.laid = { key, PW, PH, board, size, font, pad, pages, leaves, W: PW * 2 + board * 2, H: PH + board * 2, cache: new Map() };
    // (Where the reader was, as near as the new setting allows.)
    if (old) this.spread = Math.min(this.laid.leaves.length / 2 - 1, Math.round((this.spread / Math.max(1, old.leaves.length / 2 - 1)) * (this.laid.leaves.length / 2 - 1)));
    return this.laid;
  }

  // One leaf of the book, drawn (and kept).
  leafCanvas(i) {
    const B = this.laid;
    let c = B.cache.get(i);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = B.PW;
    c.height = B.PH;
    const g = c.getContext('2d');
    const leaf = B.leaves[i];
    const side = i % 2 ? 'right' : 'left';
    const ty = this.easy ? null : this.type;
    const ink = this.easy ? '#1a1410' : ty ? ty.ink : PRINT.ink;
    const tint = this.coverTint();
    if (leaf === 'end') paintEndpaper(g, B.PW, B.PH, this.seed + i, tint);
    else {
      paintPaper(g, B.PW, B.PH, side, this.seed ^ (i * 7919), grainOf(), this.easy ? '#f6efdc' : ty ? ty.paper : '#f1e6cc');
      const x = side === 'left' ? B.pad.outer : B.pad.inner;
      const w = B.PW - B.pad.outer - B.pad.inner;
      if (leaf === 'title') this.paintTitle(g, x, w, ink);
      else if (leaf !== 'blank') {
        const n = B.pages.indexOf(leaf) + 1;
        // The running head: the book's title over the left page, the
        // chapter over the right.
        g.save();
        g.fillStyle = ink;
        g.globalAlpha = 0.55;
        g.font = B.font(B.size * 0.72, 'text');
        if ('letterSpacing' in g) g.letterSpacing = `${(B.size * 0.12).toFixed(1)}px`;
        const head = (side === 'left' ? this.doc.title : leaf.chapter || this.doc.title).toUpperCase();
        const hw = g.measureText(head).width;
        if (hw < w) g.fillText(head, x + (w - hw) / 2, B.pad.top * 0.55);
        if ('letterSpacing' in g) g.letterSpacing = '0px';
        g.font = B.font(B.size * 0.82, 'text');
        const num = String(n);
        g.fillText(num, x + (w - g.measureText(num).width) / 2, B.PH - B.pad.bottom * 0.42);
        g.restore();
        paintRows(g, leaf, { x, y: B.pad.top, w, font: B.font, ink, size: B.size, capInk: this.easy ? '#5a1a10' : ty ? ty.capInk : '#6a2014', type: ty });
      }
    }
    B.cache.set(i, c);
    return c;
  }

  // The title page: the title, an ornament, whose book it is, the year.
  paintTitle(g, x, w, ink) {
    const B = this.laid;
    const ts = B.size * 2.05;
    g.fillStyle = ink;
    g.font = B.font(ts, 'head');
    const words = String(this.doc.title || '').split(/\s+/);
    const lines = [];
    let line = '';
    for (const wd of words) {
      const next = line ? `${line} ${wd}` : wd;
      if (line && g.measureText(next).width > w) {
        lines.push(line);
        line = wd;
      } else line = next;
    }
    if (line) lines.push(line);
    let y = B.PH * 0.26;
    for (const l of lines) {
      g.fillText(l, x + (w - g.measureText(l).width) / 2, y);
      y += ts * 1.18;
    }
    const ty = this.easy ? null : this.type;
    ornament(g, x + w / 2, y + B.size * 0.8, B.size * 1.1, ty ? ty.capInk : ink, ty ? ty.orn : 'diamond');
    y += B.size * 3.4;
    const by = this.doc.by;
    if (by) {
      g.font = B.font(B.size * 0.95, 'sign');
      const t = 'written by';
      g.fillText(t, x + (w - g.measureText(t).width) / 2, y);
      y += B.size * 1.8;
      g.font = B.font(B.size * 1.3, 'text');
      g.fillText(by, x + (w - g.measureText(by).width) / 2, y);
      y += B.size * 1.6;
      const rest = String(this.doc.sign || '').replace(by, '').replace(/^,\s*/, '');
      if (rest) {
        g.font = B.font(B.size * 0.95, 'sign');
        g.fillText(rest, x + (w - Math.min(w, g.measureText(rest).width)) / 2, y, w);
      }
    }
    if (this.doc.year) {
      g.font = B.font(B.size * 0.95, 'text');
      const t = `In the year ${this.doc.year}`;
      g.fillText(t, x + (w - g.measureText(t).width) / 2, B.PH * 0.86);
    }
  }

  // The colour of its boards (the same for a book every time).
  coverTint() {
    const T = [[110, 40, 30], [40, 60, 90], [50, 80, 50], [90, 60, 30], [70, 40, 80], [30, 30, 30]];
    return T[this.seed % T.length];
  }

  // A spread laid flat: the boards, the edges of the pages, the two pages,
  // the gutter.
  composeSpread(c, left, right) {
    const B = this.laid;
    c.width = B.W;
    c.height = B.H;
    const g = c.getContext('2d');
    const [r, gg, b] = this.coverTint();
    g.clearRect(0, 0, B.W, B.H);
    // The boards, in leather.
    const rr = B.board * 1.3;
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.beginPath();
    g.moveTo(rr, 0);
    g.lineTo(B.W - rr, 0);
    g.quadraticCurveTo(B.W, 0, B.W, rr);
    g.lineTo(B.W, B.H - rr);
    g.quadraticCurveTo(B.W, B.H, B.W - rr, B.H);
    g.lineTo(rr, B.H);
    g.quadraticCurveTo(0, B.H, 0, B.H - rr);
    g.lineTo(0, rr);
    g.quadraticCurveTo(0, 0, rr, 0);
    g.fill();
    const lg = g.createLinearGradient(0, 0, 0, B.H);
    lg.addColorStop(0, 'rgba(255,255,255,0.12)');
    lg.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = lg;
    g.fill();
    // The edges of the pages: more on the side not yet read.
    const total = B.leaves.length / 2;
    const readFrac = this.spread / Math.max(1, total - 1);
    const stack = (x, dir, n) => {
      for (let k = 0; k < n; k++) {
        g.fillStyle = k % 2 ? '#d8c8a0' : '#efe2c0';
        g.fillRect(x + dir * k, B.board - 1 + k * 0.3, 1, B.PH + 2 - k * 0.6);
      }
    };
    stack(B.board - 1, -1, Math.round(1 + readFrac * 5));
    stack(B.board + B.PW * 2, 1, Math.round(1 + (1 - readFrac) * 5));
    if (left) g.drawImage(left, B.board, B.board);
    if (right) g.drawImage(right, B.board + B.PW, B.board);
    // The gutter.
    const mid = B.board + B.PW;
    const gt = g.createLinearGradient(mid - 10, 0, mid + 10, 0);
    gt.addColorStop(0, 'rgba(40,25,10,0)');
    gt.addColorStop(0.5, 'rgba(40,25,10,0.45)');
    gt.addColorStop(1, 'rgba(40,25,10,0)');
    g.fillStyle = gt;
    g.fillRect(mid - 10, B.board, 20, B.PH);
  }

  paintBook() {
    const c = this.page || (this.page = document.createElement('canvas'));
    const B = this.layBook(c.getContext('2d'));
    const s = Math.min(this.spread, B.leaves.length / 2 - 1);
    this.spread = s;
    const T = this.turn;
    // (While a leaf turns: the pages under it, the old and the new.)
    if (T) {
      const fwd = T.dir > 0;
      const L = this.leafCanvas(fwd ? 2 * T.from : 2 * T.to);
      const R = this.leafCanvas(fwd ? 2 * T.to + 1 : 2 * T.from + 1);
      this.composeSpread(c, L, R);
      T.front = this.leafCanvas(fwd ? 2 * T.from + 1 : 2 * T.from);
      T.back = this.leafCanvas(fwd ? 2 * T.to : 2 * T.to + 1);
    } else this.composeSpread(c, this.leafCanvas(2 * s), this.leafCanvas(2 * s + 1));
    this.overflow = 0;
    this.dirty = false;
  }

  // ------------------------------------------------------------ the page
  // The page, flat, at the layer's own scale: its paper, its marks, its
  // words (in the hand, or in print), its seal. Laid out again only when
  // something about it changes.
  paint() {
    if (this.bookMode) {
      this.paintBook();
      return;
    }
    const P = this.paper;
    const H = this.hand;
    const easy = this.easy;
    const w = Math.round(OVER_W * (easy ? Math.max(0.56, P.w + 0.08) : P.w));
    const pad = Math.round(w * 0.085);
    const padL = Math.round(pad * (P.ruled ? 1.5 : 1));
    const padT = Math.round(pad * (P.torn ? 1.15 : 1));
    const maxH = Math.round(OVER_H * 0.84);
    const c = this.page || (this.page = document.createElement('canvas'));
    const g = c.getContext('2d');
    // The words, laid out: the title, then each line wrapped.
    let size = OVER_W * (easy ? 0.0175 : 0.0195) * (easy ? 1 : H.size);
    const font = (s, title) => (easy ? `${title ? 'bold ' : ''}${s}px ${PRINT_FONT}` : `${s}px '${H.font}', cursive`);
    const lh = easy ? 1.5 : 1.22;
    const tw = w - padL - pad;
    const layout = (s) => {
      const rows = [];
      if (this.doc.title) {
        g.font = font(s * (easy ? 1.25 : 1.45), true);
        for (const l of wrapTo(g, this.doc.title, tw)) rows.push({ t: l, title: true, h: s * (easy ? 1.25 : 1.45) * 1.1 });
        rows.push({ t: '', h: s * 0.4 });
      }
      g.font = font(s);
      for (const l of this.doc.lines) {
        if (!l) {
          rows.push({ t: '', h: s * lh * 0.6 });
          continue;
        }
        for (const p of wrapTo(g, l, tw)) rows.push({ t: p, h: s * lh });
        if (easy) rows.push({ t: '', h: s * 0.35 });
      }
      return rows;
    };
    let rows = layout(size);
    let textH = rows.reduce((n, r) => n + r.h, 0);
    // (A long letter in smaller writing, down to a point; past that, read
    // down with the wheel.)
    for (let i = 0; i < 6 && textH + padT + pad > maxH; i++) {
      size *= 0.9;
      rows = layout(size);
      textH = rows.reduce((n, r) => n + r.h, 0);
    }
    const h = Math.round(Math.min(maxH, Math.max(textH + padT + pad, w * (this.doc.kind === 'note' ? 0.55 : 1.18))));
    this.overflow = Math.max(0, textH + padT + pad - h);
    this.scroll = Math.max(0, Math.min(this.overflow, this.scroll));
    c.width = w;
    c.height = h;
    // The paper: its ragged edge (torn across the top, for a scrap).
    const r = rngOf(this.seed);
    const pts = [];
    const n = 18;
    const j = (k) => r() * k;
    for (let i = 0; i <= n; i++) pts.push([(i / n) * w, P.torn ? h * 0.015 + j(h * 0.035) : j(2)]);
    for (let i = 1; i <= n; i++) pts.push([w - j(2), (i / n) * h]);
    for (let i = n - 1; i >= 0; i--) pts.push([(i / n) * w, h - j(2)]);
    for (let i = n - 1; i > 0; i--) pts.push([j(2), (i / n) * h]);
    g.save();
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    g.fillStyle = P.base;
    g.fillRect(0, 0, w, h);
    // Stains and foxing; darker toward the edges.
    const s = this.seed;
    for (const [x, y, rad, a] of [[0.2 + (s & 31) / 100, 0.3 + ((s >> 5) & 31) / 100, 0.3, 0.16], [0.6 + ((s >> 10) & 31) / 100, 0.55 + ((s >> 15) & 31) / 100, 0.22, 0.13], [0.7 + ((s >> 20) & 15) / 100, 0.12 + ((s >> 24) & 15) / 100, 0.07, 0.14]]) {
      const gr = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, rad * w);
      gr.addColorStop(0, `rgba(150,100,40,${a})`);
      gr.addColorStop(1, 'rgba(150,100,40,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    const ed = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    ed.addColorStop(0, 'rgba(0,0,0,0)');
    ed.addColorStop(1, P.edge);
    g.fillStyle = ed;
    g.fillRect(0, 0, w, h);
    const gp = grainOf();
    if (gp) {
      g.fillStyle = g.createPattern(gp, 'repeat');
      g.fillRect(0, 0, w, h);
    }
    // The folds of a letter; the ruled margin of a book's page.
    if (P.folds) for (const f of [1 / 3, 2 / 3]) {
      const y = Math.round(h * f);
      g.fillStyle = 'rgba(90,60,20,0.18)';
      g.fillRect(0, y, w, 2);
      g.fillStyle = 'rgba(255,250,235,0.3)';
      g.fillRect(0, y + 2, w, 3);
    }
    if (P.ruled) {
      g.fillStyle = 'rgba(170,60,50,0.3)';
      g.fillRect(Math.round(padL * 0.62), 0, 2, h);
    }
    // The words.
    g.save();
    g.beginPath();
    g.rect(0, padT * 0.6, w, h - padT * 0.6 - pad * 0.4);
    g.clip();
    g.textBaseline = 'alphabetic';
    let y = padT - this.scroll;
    const jr = rngOf(this.seed ^ 0x51);
    for (const row of rows) {
      y += row.h;
      if (!row.t) continue;
      g.font = font(row.title ? size * (easy ? 1.25 : 1.45) : size, row.title);
      g.fillStyle = easy ? '#1a1410' : H.ink;
      if (easy) {
        g.fillText(row.t, padL, y - row.h * 0.25);
        continue;
      }
      // (In the hand: each line a little off level, the letters slanted as
      // they hold the pen.)
      g.save();
      g.translate(padL + (jr() - 0.5) * size * 0.5, y - row.h * 0.2);
      g.rotate(((jr() - 0.5) * (H.wobble || 0.3) * 1.2 * Math.PI) / 180);
      g.transform(1, 0, -Math.tan(((H.slant || 0) * Math.PI) / 180), 1, 0, 0);
      if (H.spacing && 'letterSpacing' in g) g.letterSpacing = `${(H.spacing * size).toFixed(1)}px`;
      g.fillText(row.t, 0, 0);
      g.restore();
    }
    g.restore();
    // A letter's seal.
    if (P.seal) {
      const sr = w * 0.055;
      const sx = w - w * 0.08 - sr;
      const sy = h - w * 0.07 - sr;
      g.globalAlpha = easy ? 0.35 : 1;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.arc(sx + 2, sy + 3, sr, 0, Math.PI * 2);
      g.fill();
      const sg = g.createRadialGradient(sx - sr * 0.3, sy - sr * 0.35, sr * 0.1, sx, sy, sr);
      sg.addColorStop(0, '#d8584a');
      sg.addColorStop(0.55, '#9a1e1a');
      sg.addColorStop(1, '#5a0c0a');
      g.fillStyle = sg;
      g.beginPath();
      g.arc(sx, sy, sr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,190,170,0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx, sy, sr * 0.56, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    g.restore();
    // (Its edge, darkened.)
    g.strokeStyle = 'rgba(90,60,25,0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    pts.forEach(([x, py], i) => (i ? g.lineTo(x, py) : g.moveTo(x, py)));
    g.closePath();
    g.stroke();
    this.dirty = false;
  }

  // Where a point of the page lands on the layer, tilted as it is.
  project(u, v, lift0 = 0) {
    const c = this.page;
    const T = this.tilt;
    const base = ((this.easy || this.bookMode ? 0 : this.paper.tilt || 0) * Math.PI) / 180;
    let x = u - c.width / 2;
    let y = v - c.height / 2;
    let z = lift0;
    // (Round its middle: turned, then leaned left and right, then back.)
    [x, y] = [x * Math.cos(base) - y * Math.sin(base), x * Math.sin(base) + y * Math.cos(base)];
    const ay = (T.y * Math.PI) / 180;
    [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
    const ax = (T.x * Math.PI) / 180;
    [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
    const lift = this.easy ? 40 : 0;
    const k = PERSPECTIVE / (PERSPECTIVE - z - lift);
    return [OVER_W / 2 + x * k, OVER_H / 2 + y * k];
  }

  // ------------------------------------------------------------ each frame
  // Drawn over the frame on the finer layer (see render/overlay.js): the
  // game behind dimmed (or, for the easier reading, blurred away); the
  // page's shadow; the page, leaning; the light across it; a word on what
  // to do.
  drawPixels(ctx) {
    const o = overlayCtx();
    if (!o || typeof document === 'undefined') return;
    if (this.dirty || !this.page) this.paint();
    // Leaning toward the pointer, easing there.
    const m = this.ui.mouse || { x: 0, y: 0 };
    const mx = m.x / ctx.canvas.width - 0.5;
    const my = m.y / ctx.canvas.height - 0.5;
    const T = this.tilt;
    // (A book's heavier, and held in both hands: it leans less.)
    const lean = this.bookMode ? 0.5 : 1;
    T.tx = this.easy ? 0 : -my * 15 * lean;
    T.ty = this.easy ? 0 : mx * 22 * lean;
    T.x += (T.tx - T.x) * 0.12;
    T.y += (T.ty - T.y) * 0.12;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalAlpha = 1;
    o.globalCompositeOperation = 'source-over';
    o.filter = 'none';
    o.clearRect(0, 0, OVER_W, OVER_H);
    if (this.easy) {
      // (The world behind, blurred away and dimmed.)
      o.filter = 'blur(7px) brightness(0.5) saturate(0.7)';
      o.drawImage(ctx.canvas, 0, 0, OVER_W, OVER_H);
      o.filter = 'none';
    } else {
      const bg = o.createRadialGradient(OVER_W / 2, OVER_H * 0.45, OVER_H * 0.1, OVER_W / 2, OVER_H / 2, OVER_W * 0.6);
      bg.addColorStop(0, 'rgba(30,22,14,0.35)');
      bg.addColorStop(1, 'rgba(6,4,2,0.78)');
      o.fillStyle = bg;
      o.fillRect(0, 0, OVER_W, OVER_H);
    }
    const c = this.page;
    const W = c.width;
    const H = c.height;
    // The grid the page is drawn through, corner by corner.
    const NX = 8;
    const NY = 10;
    const pt = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const u = (i / NX) * W;
      const v = (j / NY) * H;
      const [x, y] = this.project(u, v);
      pt.push({ u, v, x, y });
    }
    const P = (i, j) => pt[j * (NX + 1) + i];
    this.poly = [P(0, 0), P(NX, 0), P(NX, NY), P(0, NY)].map((q) => [q.x, q.y]);
    // Its shadow, cast down and away from where it leans.
    o.save();
    o.filter = 'blur(14px)';
    o.fillStyle = 'rgba(0,0,0,0.55)';
    o.beginPath();
    this.poly.forEach(([x, y], i) => (i ? o.lineTo(x - T.y * 1.6, y + T.x * 1.6 + 16) : o.moveTo(x - T.y * 1.6, y + T.x * 1.6 + 16)));
    o.closePath();
    o.fill();
    o.restore();
    // The page: flat, at once; leaning, a triangle at a time.
    if (Math.abs(T.x) < 0.05 && Math.abs(T.y) < 0.05 && !(this.paper.tilt && !this.easy && !this.bookMode)) {
      const [x0, y0] = this.project(0, 0);
      const [x1, y1] = this.project(W, H);
      o.drawImage(c, x0, y0, x1 - x0, y1 - y0);
    } else {
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const a = P(i, j);
        const b = P(i + 1, j);
        const d = P(i, j + 1);
        const e = P(i + 1, j + 1);
        tri(o, c, a, b, e);
        tri(o, c, a, e, d);
      }
    }
    // A leaf turning over.
    if (this.bookMode && this.turn) this.drawLeaf(o);
    // The light across it, sliding as it leans.
    o.save();
    o.beginPath();
    this.poly.forEach(([x, y], i) => (i ? o.lineTo(x, y) : o.moveTo(x, y)));
    o.closePath();
    o.clip();
    const pos = 0.5 + T.y * 0.03 - T.x * 0.02;
    const [lx0, ly0] = this.poly[0];
    const [lx1, ly1] = this.poly[2];
    const sh = o.createLinearGradient(lx0, ly0, lx1, ly1);
    sh.addColorStop(Math.max(0, Math.min(1, pos - 0.3)), 'rgba(255,248,225,0)');
    sh.addColorStop(Math.max(0, Math.min(1, pos)), `rgba(255,248,225,${this.easy ? 0.05 : 0.16})`);
    sh.addColorStop(Math.max(0, Math.min(1, pos + 0.26)), 'rgba(255,248,225,0)');
    o.fillStyle = sh;
    o.fillRect(0, 0, OVER_W, OVER_H);
    o.restore();
    // (A book: arrows at its edges, to turn the page by.)
    if (this.bookMode && !this.turn) this.drawArrows(o, m);
    // What to do, in the game's own letters.
    const hint = this.bookMode
      ? `◄ ► turn the page  ·  click: ${this.easy ? 'as printed' : 'larger print'}  ·  Esc: put it down  ·  ${this.spread + 1}/${this.spreads}`
      : `click the page: ${this.printed ? 'larger print' : 'read it in plain print'}  ·  Esc: put it down${this.overflow ? '  ·  wheel: read on' : ''}`;
    o.save();
    o.scale(OVER_SCALE, OVER_SCALE);
    o.fillStyle = '#080604';
    o.fillRect(0, OVER_H / OVER_SCALE - 18, OVER_W / OVER_SCALE, 18);
    drawText(o, hint, Math.round((OVER_W / OVER_SCALE - textWidth(hint)) / 2), OVER_H / OVER_SCALE - 14, '#c8b890', '#000');
    o.restore();
    overlay.shown = true;
  }

  // The leaf as it turns: lifting off one page, standing up from the
  // gutter, coming down on the other; front, then back.
  drawLeaf(o) {
    const B = this.laid;
    const T = this.turn;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (T.start === undefined) T.start = now;
    const t = Math.min(1, (now - T.start) / 430);
    const e = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    const th = Math.PI * (T.dir > 0 ? e : 1 - e);
    const spine = B.board + B.PW;
    const onRight = th < Math.PI / 2;
    const img = onRight ? (T.dir > 0 ? T.front : T.back) : T.dir > 0 ? T.back : T.front;
    const NX = 10;
    const NY = 6;
    const pts = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const d = (i / NX) * B.PW;
      const v = (j / NY) * B.PH;
      // (A little curl in it as it stands up.)
      const bend = Math.sin((Math.PI * d) / B.PW) * 14 * Math.sin(th);
      const x = spine + d * Math.cos(th) - bend * 0.3 * Math.sign(Math.cos(th) || 1);
      const z = d * Math.sin(th) * 0.92 + bend;
      const [px, py] = this.project(x, B.board + v, z);
      pts.push({ u: onRight ? d : B.PW - d, v, x: px, y: py });
    }
    const P = (i, j) => pts[j * (NX + 1) + i];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = P(i, j);
      const b = P(i + 1, j);
      const d = P(i, j + 1);
      const q = P(i + 1, j + 1);
      tri(o, img, a, b, q);
      tri(o, img, a, q, d);
    }
    // (Darker as it stands edge-on to the light.)
    o.save();
    o.fillStyle = `rgba(30,20,8,${(0.28 * Math.sin(th)).toFixed(3)})`;
    o.beginPath();
    [P(0, 0), P(NX, 0), P(NX, NY), P(0, NY)].forEach((q, k) => (k ? o.lineTo(q.x, q.y) : o.moveTo(q.x, q.y)));
    o.closePath();
    o.fill();
    o.restore();
    if (t >= 1) {
      this.turn = null;
      this.dirty = true;
    }
  }

  // Where across the book a point of the view is (0 its left edge, 1 its
  // right), or null off it.
  across(vx, vy) {
    if (!this.poly || !this.onPage(vx, vy)) return null;
    const [p0, p1, p2, p3] = this.poly;
    const x = vx * OVER_SCALE;
    const l = (p0[0] + p3[0]) / 2;
    const r = (p1[0] + p2[0]) / 2;
    return (x - l) / Math.max(1, r - l);
  }

  drawArrows(o, m) {
    const f = this.across(m.x, m.y);
    const [p0, p1, p2, p3] = this.poly;
    const cy = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
    const arrow = (x, dir, hot) => {
      o.save();
      o.globalAlpha = hot ? 0.85 : 0.3;
      o.fillStyle = hot ? '#3a2410' : '#6a5030';
      o.beginPath();
      o.moveTo(x + dir * 12, cy);
      o.lineTo(x - dir * 4, cy - 14);
      o.lineTo(x - dir * 4, cy + 14);
      o.closePath();
      o.fill();
      o.restore();
    };
    if (this.spread < this.spreads - 1) arrow((p1[0] + p2[0]) / 2 - 26, 1, f !== null && f > 0.84);
    if (this.spread > 0) arrow((p0[0] + p3[0]) / 2 + 26, -1, f !== null && f < 0.16);
  }

  // Is a point of the view on the page?
  onPage(vx, vy) {
    if (!this.poly) return false;
    const x = vx * OVER_SCALE;
    const y = vy * OVER_SCALE;
    let inside = false;
    const p = this.poly;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i];
      const [xj, yj] = p[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // ------------------------------------------------------------ the window
  draw() {}

  contains() {
    return true;
  }

  onClick(ck) {
    const m = this.ui.mouse || { x: 0, y: 0 };
    if (ck && ck.button === 2) this.putDown();
    else if (this.bookMode && this.poly) {
      // (A book: its outer edges turn the page; the rest of it, the print.)
      const f = this.across(m.x, m.y);
      if (f === null) this.putDown();
      else if (f > 0.84) this.turnPage(1);
      else if (f < 0.16) this.turnPage(-1);
      else this.toggleEasy();
    } else if (this.onPage(m.x, m.y)) this.toggleEasy();
    else this.putDown();
    return true;
  }

  onWheel(d) {
    if (this.bookMode) this.turnPage(d > 0 ? 1 : -1);
    else this.scrollBy(d > 0 ? 40 : -40);
  }

  scrollBy(d) {
    if (!this.overflow) return;
    this.scroll = Math.max(0, Math.min(this.overflow, this.scroll + d));
    this.dirty = true;
  }

  onKey(k) {
    if (k.code === 'Escape' || k.code === 'Enter' || k.code === 'KeyE') {
      this.putDown();
      return true;
    }
    if (this.bookMode) {
      if (['ArrowRight', 'KeyD', 'PageDown', 'Space'].includes(k.code)) this.turnPage(1);
      else if (['ArrowLeft', 'KeyA', 'PageUp', 'Backspace'].includes(k.code)) this.turnPage(-1);
      else if (k.code === 'Tab') this.toggleEasy();
      return true;
    }
    if (k.code === 'Space' || k.code === 'Tab') {
      this.toggleEasy();
      return true;
    }
    if (k.code === 'ArrowDown' || k.code === 'KeyS') this.scrollBy(60);
    if (k.code === 'ArrowUp' || k.code === 'KeyW') this.scrollBy(-60);
    return true;
  }
}

// One triangle of the page, from where it is on the page to where it
// lands (a little overdrawn, so no seam shows between them).
function tri(o, img, a, b, c) {
  const cx = (a.x + b.x + c.x) / 3;
  const cy = (a.y + b.y + c.y) / 3;
  const grow = (q) => {
    const dx = q.x - cx;
    const dy = q.y - cy;
    const l = Math.hypot(dx, dy) || 1;
    return [q.x + (dx / l) * 0.8, q.y + (dy / l) * 0.8];
  };
  const [ax, ay] = grow(a);
  const [bx, by] = grow(b);
  const [qx, qy] = grow(c);
  o.save();
  o.beginPath();
  o.moveTo(ax, ay);
  o.lineTo(bx, by);
  o.lineTo(qx, qy);
  o.closePath();
  o.clip();
  const den = (b.u - a.u) * (c.v - a.v) - (c.u - a.u) * (b.v - a.v);
  if (Math.abs(den) > 1e-9) {
    const m11 = ((b.x - a.x) * (c.v - a.v) - (c.x - a.x) * (b.v - a.v)) / den;
    const m21 = ((c.x - a.x) * (b.u - a.u) - (b.x - a.x) * (c.u - a.u)) / den;
    const m12 = ((b.y - a.y) * (c.v - a.v) - (c.y - a.y) * (b.v - a.v)) / den;
    const m22 = ((c.y - a.y) * (b.u - a.u) - (b.y - a.y) * (c.u - a.u)) / den;
    o.transform(m11, m12, m21, m22, a.x - m11 * a.u - m21 * a.v, a.y - m12 * a.u - m22 * a.v);
    o.drawImage(img, 0, 0);
  }
  o.restore();
}
