// (Round 125) A letter, a note, a page of a book, held up to read: the
// thing itself, drawn as paper over the darkened game, tilting a little as
// the mouse moves (as a page in the hand does), lit by a sheen that slides
// across it. It's written in its writer's own hand (see hands.js): every
// writer a hand of their own. Click the page for the easier reading of it:
// the world behind blurred away, the page held flat and still, the words
// in plain print. Click it again for the hand; Esc (or a click off the
// page) to put it down.
//
// The page is drawn by the browser over the screen (the game's own pixels
// are too few for handwriting), lined up with it and kept so as the window
// changes size. In a test, with no page to draw on, the window still holds
// what it says.
import { Window } from './window.js';
import { handFor, signerOf, loadHands, PRINT } from './hands.js';

const STYLE_ID = 'tessera-doc-style';
const CSS = `
.tdoc-stage { position: fixed; z-index: 40; perspective: 1400px; overflow: hidden; user-select: none; cursor: default; }
.tdoc-back { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, rgba(30,22,14,0.35), rgba(6,4,2,0.78)); transition: backdrop-filter 0.35s, background 0.35s; }
.tdoc-stage.easy .tdoc-back { backdrop-filter: blur(7px) brightness(0.55) saturate(0.7); -webkit-backdrop-filter: blur(7px) brightness(0.55) saturate(0.7); background: rgba(8,6,4,0.45); }
.tdoc-wrap { position: absolute; left: 50%; top: 50%; transform-style: preserve-3d; }
.tdoc-sheet { position: relative; box-sizing: border-box; transform-style: preserve-3d; transition: filter 0.3s, background-color 0.3s; cursor: zoom-in; }
.tdoc-stage.easy .tdoc-sheet { cursor: zoom-out; }
.tdoc-paper { position: absolute; inset: 0; border-radius: 2px; }
.tdoc-sheen { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: soft-light; transition: opacity 0.3s; }
.tdoc-stage.easy .tdoc-sheen { opacity: 0.25; }
.tdoc-shadow { position: absolute; inset: 0; border-radius: 4px; background: rgba(0,0,0,0.55); filter: blur(18px); transform: translateZ(-40px); }
.tdoc-text { position: relative; }
.tdoc-hand h1 { font-weight: normal; margin: 0 0 0.45em 0; line-height: 1.05; }
.tdoc-hand p { margin: 0 0 0.12em 0; line-height: 1.22; white-space: pre-wrap; }
.tdoc-print { display: none; font-family: Georgia, 'Times New Roman', serif; color: #1a1410; }
.tdoc-print h1 { font-size: 1.25em; margin: 0 0 0.6em 0; letter-spacing: 0.02em; }
.tdoc-print p { margin: 0 0 0.45em 0; line-height: 1.5; }
.tdoc-stage.easy .tdoc-hand { display: none; }
.tdoc-stage.easy .tdoc-print { display: block; }
.tdoc-seal { position: absolute; border-radius: 50%; background: radial-gradient(circle at 38% 34%, #d8584a, #9a1e1a 55%, #5a0c0a); box-shadow: 0 2px 4px rgba(0,0,0,0.45), inset 0 -2px 4px rgba(0,0,0,0.35); }
.tdoc-seal::after { content: ''; position: absolute; inset: 22%; border-radius: 50%; border: 2px solid rgba(255,190,170,0.35); }
.tdoc-stage.easy .tdoc-seal { opacity: 0.35; }
.tdoc-hint { position: absolute; left: 0; right: 0; bottom: 2.2%; text-align: center; font-family: monospace; color: #c8b890; opacity: 0.85; letter-spacing: 0.04em; text-shadow: 0 1px 2px #000; pointer-events: none; }
`;

// Paper of each kind: its colour, its marks.
const PAPERS = {
  letter: { w: 0.5, base: '#efe2c0', edge: 'rgba(120,80,30,0.42)', folds: true, seal: true },
  note: { w: 0.38, base: '#ece0c4', edge: 'rgba(110,80,40,0.38)', torn: true, tilt: -2.2 },
  map: { w: 0.55, base: '#e2cf9e', edge: 'rgba(110,70,20,0.5)', folds: true },
  book: { w: 0.5, base: '#f1e6cc', edge: 'rgba(120,90,50,0.3)', ruled: true },
  page: { w: 0.48, base: '#efe4c8', edge: 'rgba(120,90,50,0.34)' },
};

// A ragged edge, all the way round (or torn across the top, for a scrap).
function edgePath(seed, torn) {
  let s = seed >>> 0 || 1;
  const r = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i++) pts.push([(i / n) * 100, torn ? 1.5 + r() * 3.5 : r() * 0.6]);
  for (let i = 1; i <= n; i++) pts.push([100 - r() * 0.6, (i / n) * 100]);
  for (let i = n - 1; i >= 0; i--) pts.push([(i / n) * 100, 100 - r() * 0.6]);
  for (let i = n - 1; i > 0; i--) pts.push([r() * 0.6, (i / n) * 100]);
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})`;
}

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class DocumentWindow extends Window {
  // `doc`: { title, lines, kind (letter, note, map, book, page), from
  // (whoever wrote it, for their hand) }.
  // (`mirror`: another's page, shown on a player's screen in someone
  // else's world: see net/uiwire.js.)
  constructor(ui, doc, { mirror = false } = {}) {
    super(ui, 1, 1, { kind: 'document', x: 0, y: 0 });
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
    this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    this.t = 0;
    this.el = null;
    // (Drawn only on this screen's own: the host keeps its players'
    // windows too, and shows them none of it.)
    if (mirror || (typeof window !== 'undefined' && window.__ui === ui)) this.mount();
  }

  // Put down: a page that's the host's is put down there (as though Esc
  // were pressed), the rest here.
  putDown() {
    if (this.mirror && typeof window !== 'undefined') {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
      window.dispatchEvent(new window.KeyboardEvent('keyup', { code: 'Escape', key: 'Escape' }));
      return;
    }
    this.close();
  }

  // ------------------------------------------------------------ the page
  mount() {
    if (typeof document === 'undefined' || !document.body) return;
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement('style');
      st.id = STYLE_ID;
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const d = this.doc;
    const H = this.hand;
    const P = this.paper;
    const stage = document.createElement('div');
    stage.className = 'tdoc-stage';
    const seed = [...`${d.title}${d.lines.join('')}`].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
    let wob = seed >>> 0;
    const jit = () => {
      wob = (Math.imul(wob, 1664525) + 1013904223) >>> 0;
      return wob / 4294967296 - 0.5;
    };
    const handLines = d.lines.map((l) => (l ? `<p style="transform: rotate(${(jit() * (H.wobble || 0.3) * 1.2).toFixed(2)}deg) translateX(${(jit() * 0.6).toFixed(2)}em)">${esc(l)}</p>` : '<p>&nbsp;</p>')).join('');
    const printLines = d.lines.map((l) => (l ? `<p>${esc(l)}</p>` : '')).join('');
    stage.innerHTML = `
      <div class="tdoc-back"></div>
      <div class="tdoc-wrap">
        <div class="tdoc-shadow"></div>
        <div class="tdoc-sheet">
          <div class="tdoc-paper"></div>
          <div class="tdoc-sheen"></div>
          <div class="tdoc-text">
            <div class="tdoc-hand">${d.title ? `<h1>${esc(d.title)}</h1>` : ''}${handLines}</div>
            <div class="tdoc-print">${d.title ? `<h1>${esc(d.title)}</h1>` : ''}${printLines}</div>
          </div>
          ${P.seal ? '<div class="tdoc-seal"></div>' : ''}
        </div>
      </div>
      <div class="tdoc-hint">click the page: ${this.printed ? 'larger print' : 'read it in plain print'} &middot; Esc: put it down</div>`;
    const paper = stage.querySelector('.tdoc-paper');
    // The paper: its colour, foxing and stains, darker toward its edges;
    // the folds of a letter; the ruled margin of a book's page; a grain.
    const grain = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/><feColorMatrix values=\'0 0 0 0 0.35  0 0 0 0 0.24  0 0 0 0 0.1  0 0 0 0.42 0\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\'/></svg>")';
    const stains = [
      `radial-gradient(ellipse at ${20 + (seed & 31)}% ${30 + ((seed >> 5) & 31)}%, rgba(150,100,40,0.16), transparent 30%)`,
      `radial-gradient(ellipse at ${60 + ((seed >> 10) & 31)}% ${55 + ((seed >> 15) & 31)}%, rgba(140,90,30,0.13), transparent 22%)`,
      `radial-gradient(circle at ${70 + ((seed >> 20) & 15)}% ${12 + ((seed >> 24) & 15)}%, rgba(120,70,20,0.12), rgba(120,70,20,0.05) 5%, transparent 7%)`,
    ];
    const folds = P.folds ? ['linear-gradient(to bottom, transparent 33%, rgba(90,60,20,0.16) 33.3%, rgba(255,250,235,0.25) 33.8%, transparent 34.4%, transparent 66.2%, rgba(90,60,20,0.16) 66.5%, rgba(255,250,235,0.25) 67%, transparent 67.6%)'] : [];
    const ruled = P.ruled ? ['linear-gradient(to right, transparent 9%, rgba(170,60,50,0.28) 9.2%, transparent 9.6%)'] : [];
    paper.style.background = [...folds, ...ruled, ...stains, grain, `radial-gradient(ellipse at 50% 50%, ${P.base} 55%, ${P.base})`].join(',');
    paper.style.boxShadow = `inset 0 0 90px ${P.edge}, inset 0 0 22px ${P.edge}, inset 0 0 4px rgba(80,50,20,0.45)`;
    paper.style.clipPath = edgePath(seed, !!P.torn);
    this.el = stage;
    this.sheet = stage.querySelector('.tdoc-sheet');
    this.wrap = stage.querySelector('.tdoc-wrap');
    this.shadow = stage.querySelector('.tdoc-shadow');
    this.sheen = stage.querySelector('.tdoc-sheen');
    this.handEl = stage.querySelector('.tdoc-hand');
    this.printEl = stage.querySelector('.tdoc-print');
    this.seal = stage.querySelector('.tdoc-seal');
    // The hand: its font, its ink, its slant.
    this.handEl.style.fontFamily = `'${H.font}', cursive`;
    this.handEl.style.color = H.ink;
    this.handEl.style.letterSpacing = `${H.spacing || 0}em`;
    this.handEl.style.transform = `skewX(${H.slant || 0}deg)`;
    // Mouse: the page leans toward it; a click on it, the easier reading;
    // a click off it, put down.
    stage.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      const mx = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
      const my = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
      this.tilt.ty = mx * 22;
      this.tilt.tx = -my * 15;
    });
    stage.addEventListener('mouseleave', () => {
      this.tilt.tx = 0;
      this.tilt.ty = 0;
    });
    this.sheet.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleEasy();
    });
    stage.addEventListener('click', () => this.putDown());
    stage.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.putDown();
    });
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scrollBy(e.deltaY);
    }, { passive: false });
    document.body.appendChild(stage);
    this.layout();
    // (Laid out again once the hands are in: their letters are their own
    // sizes.)
    loadHands().then(() => {
      if (this.el) this.layout();
    });
    this.raf = () => {
      if (!this.el) return;
      this.frame();
      requestAnimationFrame(this.raf);
    };
    requestAnimationFrame(this.raf);
  }

  // Over the game's screen, the page sized to it; its words fitted to the
  // page (smaller, for a long letter).
  layout() {
    const scr = document.getElementById('screen');
    const r = scr ? scr.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const st = this.el.style;
    st.left = `${r.left}px`;
    st.top = `${r.top}px`;
    st.width = `${r.width}px`;
    st.height = `${r.height}px`;
    this.box = { w: r.width, h: r.height };
    const P = this.paper;
    const easy = this.easy;
    const w = Math.round(r.width * (easy ? Math.max(0.56, P.w + 0.08) : P.w));
    const pad = Math.round(w * 0.085);
    this.sheet.style.width = `${w}px`;
    this.sheet.style.padding = `${Math.round(pad * (P.torn ? 1.15 : 1))}px ${pad}px ${pad}px ${Math.round(pad * (P.ruled ? 1.5 : 1))}px`;
    const maxH = r.height * 0.84;
    let base = r.width * (easy ? 0.0175 : 0.0195) * (easy ? 1 : this.hand.size);
    const text = easy ? this.printEl : this.handEl;
    text.style.fontSize = `${base}px`;
    // (Measured as it would stand on its own: no height held from before.)
    Object.assign(this.sheet.style, { height: 'auto', minHeight: '0px', maxHeight: 'none', overflow: 'visible' });
    for (let i = 0; i < 8 && this.sheet.offsetHeight > maxH; i++) {
      base *= 0.9;
      text.style.fontSize = `${base}px`;
    }
    this.handEl.querySelector('h1')?.style.setProperty('font-size', '1.45em');
    this.sheet.style.minHeight = `${Math.round(Math.min(maxH, w * (this.doc.kind === 'note' ? 0.55 : 1.18)))}px`;
    this.sheet.style.maxHeight = `${Math.round(maxH)}px`;
    this.sheet.style.overflow = 'hidden';
    this.shadow.style.width = `${w}px`;
    this.shadow.style.height = `${this.sheet.offsetHeight}px`;
    this.wrap.style.width = `${w}px`;
    this.wrap.style.marginLeft = `${-w / 2}px`;
    this.wrap.style.marginTop = `${-this.sheet.offsetHeight / 2}px`;
    if (this.seal) {
      const s = Math.round(w * 0.11);
      Object.assign(this.seal.style, { width: `${s}px`, height: `${s}px`, right: `${Math.round(w * 0.08)}px`, bottom: `${Math.round(w * 0.07)}px` });
    }
    this.el.querySelector('.tdoc-hint').style.fontSize = `${Math.max(10, Math.round(r.width * 0.0135))}px`;
    this.scrollY = 0;
    this.scrollBy(0);
  }

  // A long page, read down with the wheel.
  scrollBy(d) {
    const text = this.el && this.el.querySelector('.tdoc-text');
    if (!text) return;
    const over = Math.max(0, text.scrollHeight - (this.sheet.clientHeight - parseFloat(window.getComputedStyle(this.sheet).paddingTop) * 2));
    this.scrollY = Math.max(0, Math.min(over, (this.scrollY || 0) + d * 0.6));
    text.style.transform = `translateY(${-this.scrollY}px)`;
  }

  frame() {
    // (Lined up with the screen, if the window's changed size.)
    const scr = document.getElementById('screen');
    if (scr) {
      const r = scr.getBoundingClientRect();
      if (!this.box || Math.abs(r.width - this.box.w) > 1 || Math.abs(r.height - this.box.h) > 1) this.layout();
    }
    const T = this.tilt;
    const k = 0.12;
    const gx = this.easy ? 0 : T.tx;
    const gy = this.easy ? 0 : T.ty;
    T.x += (gx - T.x) * k;
    T.y += (gy - T.y) * k;
    const base = this.easy ? 0 : this.paper.tilt || 0;
    const lift = this.easy ? 60 : 0;
    this.sheet.style.transform = `translateZ(${lift}px) rotateX(${T.x.toFixed(2)}deg) rotateY(${T.y.toFixed(2)}deg) rotateZ(${base}deg)`;
    this.shadow.style.transform = `translate(${(-T.y * 1.6).toFixed(1)}px, ${(T.x * 1.6 + 14).toFixed(1)}px) translateZ(-40px) rotateZ(${base}deg)`;
    // The light across it, sliding as it leans.
    const ang = 115 + T.y * 3;
    const pos = 50 + T.y * 3 - T.x * 2;
    this.sheen.style.background = `linear-gradient(${ang.toFixed(0)}deg, rgba(255,255,255,0) ${pos - 30}%, rgba(255,248,225,0.55) ${pos}%, rgba(255,255,255,0) ${pos + 26}%)`;
  }

  toggleEasy() {
    this.easy = !this.easy;
    if (this.el) {
      this.el.classList.toggle('easy', this.easy);
      this.layout();
    }
    this.ui.audio?.play('page');
  }

  // ------------------------------------------------------------ the window
  draw() {}

  contains() {
    return true;
  }

  onKey(k) {
    if (k.code === 'Escape' || k.code === 'Enter' || k.code === 'KeyE') {
      this.close();
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

  onClose() {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
