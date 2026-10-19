// (Round 126) A book held open to read (see document.js): two pages side
// by side in their boards, the gutter shadowed between them, the edges of
// the pages still to read stacked on the right, and those read on the
// left. Its first spread is the inside of the cover and the title page;
// then the book, a chapter to a fresh page, its first letter a drop cap,
// the paragraphs set close and justified, a running head over each page
// and its number under it.
//
// What's here is the setting of it: the book's lines (see game/books)
// broken into pages for a page of a given size and type, and each page
// drawn. Laid out again whenever the type changes (the easier reading is
// set larger, in plain print).

// A book's lines, as books.js writes them: '\f' the next page; '# ' a
// chapter's heading; '## ' a heading within it; '> ' set to the right; '~'
// an ornament.
export function isBookDoc(doc) {
  return !!doc && doc.kind === 'book' && (!!doc.by || (doc.lines || []).some((l) => l === '\f' || /^# /.test(l)));
}

// Words broken into lines no wider than `widths[i]` (the i-th line's width;
// the last for the rest).
function breakLines(words, widths, measure) {
  const out = [];
  let line = [];
  let w = 0;
  const space = measure(' ');
  const width = () => widths[Math.min(out.length, widths.length - 1)];
  for (const word of words) {
    const ww = measure(word);
    if (line.length && w + space + ww > width()) {
      out.push({ words: line, w });
      line = [word];
      w = ww;
    } else {
      w = line.length ? w + space + ww : ww;
      line.push(word);
    }
  }
  if (line.length) out.push({ words: line, w });
  return out;
}

// The pages: each a list of rows ({ t: kind, ... , y, h }) with the chapter
// it's in. `o`: { w, h (the text's box), size, lh (line height, as a
// multiple of size), measure(text, size, style) }.
export function paginate(lines, o) {
  const { w, h, size, measure } = o;
  const lh = size * (o.lh || 1.32);
  const pages = [];
  let page = null;
  let y = 0;
  let chapter = '';
  let dropNext = false;
  const fresh = () => {
    page = { rows: [], chapter, n: pages.length + 1 };
    pages.push(page);
    y = 0;
  };
  const room = () => h - y;
  const add = (row) => {
    row.y = y;
    page.rows.push(row);
    y += row.h;
  };
  fresh();
  for (const raw of lines) {
    const l = String(raw ?? '');
    if (l === '\f') {
      // (A new chapter starts a new page, unless this one's still mostly
      // empty: then it starts a little way down.)
      if (page.rows.length && y > h * 0.4) fresh();
      continue;
    }
    if (/^# /.test(l)) {
      const text = l.slice(2);
      const hs = size * 1.32;
      const m = (t) => measure(t, hs, 'head');
      const rows = breakLines(text.split(/\s+/), [w * 0.86], m);
      const need = rows.length * hs * 1.25 + size * 2.2 + lh * 3;
      if (page.rows.length && room() < need) fresh();
      chapter = text.replace(/^[IVXLC]+\.\s*/, '');
      page.chapter = page.chapter || chapter;
      if (!page.rows.length) page.chapter = chapter;
      add({ t: 'gap', h: size * (page.rows.length ? 1 : 0.6) });
      for (const r of rows) add({ t: 'head', text: r.words.join(' '), w: r.w, size: hs, h: hs * 1.25 });
      add({ t: 'orn', h: size * 1.6 });
      dropNext = true;
      continue;
    }
    if (/^## /.test(l)) {
      const ss = size * 1.04;
      if (page.rows.length && room() < ss * 1.6 + lh * 3) fresh();
      add({ t: 'gap', h: page.rows.length ? size * 0.5 : 0 });
      add({ t: 'sub', text: l.slice(3), size: ss, h: ss * 1.5 });
      dropNext = false;
      continue;
    }
    if (l === '~') {
      if (room() < size * 2) fresh();
      add({ t: 'gap', h: size * 0.6 });
      add({ t: 'orn', h: size * 1.6, end: true });
      continue;
    }
    if (/^> /.test(l)) {
      const rows = breakLines(l.slice(2).split(/\s+/), [w * 0.8], (t) => measure(t, size * 0.92, 'sign'));
      if (room() < rows.length * lh + size) fresh();
      add({ t: 'gap', h: size * 0.4 });
      for (const r of rows) add({ t: 'sign', text: r.words.join(' '), w: r.w, size: size * 0.92, h: lh });
      continue;
    }
    if (!l.trim()) {
      add({ t: 'gap', h: lh * 0.5 });
      continue;
    }
    // A paragraph: indented (or, the first of a chapter, its first letter
    // dropped two lines deep), justified but for its last line.
    let words = l.split(/\s+/).filter(Boolean);
    let cap = null;
    const indent = size * 1.4;
    let widths = [w - indent, w];
    if (dropNext && /^[A-Za-z]/.test(words[0])) {
      const letter = words[0][0].toUpperCase();
      const cs = lh * 2 - size * 0.12;
      const cw = measure(letter, cs, 'cap') + size * 0.35;
      cap = { letter, size: cs, w: cw };
      words = [words[0].slice(1) || '', ...words.slice(1)];
      if (!words[0]) words.shift();
      widths = [w - cw, w - cw, w];
    }
    const m = (t) => measure(t, size, 'text');
    const rows = breakLines(words, widths, m);
    if (cap && room() < lh * 2) fresh();
    // (No line left alone at the top or the foot of a page: a break that
    // would leave one is made a line sooner.)
    const fit = Math.floor(room() / lh);
    const early = fit < rows.length && (rows.length - fit === 1 || fit === 1) && rows.length >= 3 ? (fit === 1 ? 0 : fit - 1) : -1;
    if (early === 0) fresh();
    rows.forEach((r, i) => {
      if (room() < lh || (early > 0 && i === early)) fresh();
      const x0 = cap && i < 2 ? cap.w : !cap && i === 0 ? indent : 0;
      add({ t: 'text', words: r.words, w: r.w, x0, width: (cap && i < 2 ? w - cap.w : !cap && i === 0 ? w - indent : w), last: i === rows.length - 1, cap: i === 0 ? cap : null, size, h: lh });
    });
    dropNext = false;
  }
  // (No empty page at the end.)
  while (pages.length > 1 && !pages[pages.length - 1].rows.some((r) => r.t !== 'gap')) pages.pop();
  return pages;
}

// ------------------------------------------------------------ drawing
function rngOf(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// The paper of a page: its colour, foxing, grain, the shadow of the gutter
// on its inner edge.
export function paintPaper(g, W, H, side, seed, grain, base = '#f1e6cc') {
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const r = rngOf(seed);
  for (let i = 0; i < 3; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = (0.08 + r() * 0.25) * W;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(150,100,40,${(0.04 + r() * 0.08).toFixed(3)})`);
    gr.addColorStop(1, 'rgba(150,100,40,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  // Darker toward the outer edges; the gutter's shadow on the inner one.
  const ed = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
  ed.addColorStop(0, 'rgba(0,0,0,0)');
  ed.addColorStop(1, 'rgba(120,90,50,0.3)');
  g.fillStyle = ed;
  g.fillRect(0, 0, W, H);
  const inner = side === 'left' ? W : 0;
  const gut = g.createLinearGradient(inner, 0, side === 'left' ? W - W * 0.16 : W * 0.16, 0);
  gut.addColorStop(0, 'rgba(70,45,20,0.42)');
  gut.addColorStop(0.35, 'rgba(90,60,30,0.12)');
  gut.addColorStop(1, 'rgba(90,60,30,0)');
  g.fillStyle = gut;
  g.fillRect(0, 0, W, H);
  if (grain) {
    g.fillStyle = g.createPattern(grain, 'repeat');
    g.fillRect(0, 0, W, H);
  }
}

// The inside of the cover: marbled endpaper.
export function paintEndpaper(g, W, H, seed, tint = [120, 60, 40]) {
  const r = rngOf(seed ^ 0x3e1d);
  const [cr, cg, cb] = tint;
  g.fillStyle = `rgb(${Math.min(255, cr + 80)},${Math.min(255, cg + 70)},${Math.min(255, cb + 60)})`;
  g.fillRect(0, 0, W, H);
  g.lineCap = 'round';
  // (Combed marbling: rows of drawn-out curls, close in colour.)
  const rows = 26;
  for (let j = 0; j < rows; j++) {
    const y0 = ((j + 0.5) / rows) * H;
    for (let i = 0; i < 9; i++) {
      const k = r();
      g.strokeStyle = k < 0.45 ? `rgba(${cr},${cg},${cb},0.32)` : k < 0.8 ? 'rgba(236,222,190,0.28)' : `rgba(${Math.max(0, cr - 40)},${Math.max(0, cg - 25)},${Math.max(0, cb - 10)},0.3)`;
      g.lineWidth = 1 + r() * 3;
      g.beginPath();
      let x = -10;
      let y = y0 + (r() - 0.5) * (H / rows);
      g.moveTo(x, y);
      while (x < W + 10) {
        const nx = x + 12 + r() * 22;
        g.quadraticCurveTo(x + (nx - x) / 2, y + (r() - 0.5) * (H / rows) * 1.6, nx, y);
        x = nx;
      }
      g.stroke();
    }
  }
  const ed = g.createLinearGradient(W, 0, W * 0.8, 0);
  ed.addColorStop(0, 'rgba(0,0,0,0.45)');
  ed.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = ed;
  g.fillRect(0, 0, W, H);
}

// A small ornament: a diamond between two rules.
export function ornament(g, cx, cy, s, ink) {
  g.save();
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.globalAlpha = 0.7;
  g.lineWidth = Math.max(1, s * 0.06);
  g.beginPath();
  g.moveTo(cx - s * 2.6, cy);
  g.lineTo(cx - s * 0.7, cy);
  g.moveTo(cx + s * 0.7, cy);
  g.lineTo(cx + s * 2.6, cy);
  g.stroke();
  g.beginPath();
  g.moveTo(cx, cy - s * 0.45);
  g.lineTo(cx + s * 0.45, cy);
  g.lineTo(cx, cy + s * 0.45);
  g.lineTo(cx - s * 0.45, cy);
  g.closePath();
  g.fill();
  g.restore();
}

// One page's words, set on it (`font(size, style)` the type).
export function paintRows(g, page, o) {
  const { x, y, w, font, ink, size } = o;
  g.textBaseline = 'alphabetic';
  g.fillStyle = ink;
  for (const row of page.rows) {
    const by = y + row.y;
    if (row.t === 'head') {
      g.font = font(row.size, 'head');
      g.fillText(row.text, x + (w - row.w) / 2, by + row.size);
    } else if (row.t === 'sub') {
      g.font = font(row.size, 'sub');
      g.fillText(row.text, x, by + row.size * 1.05);
      g.globalAlpha = 0.35;
      g.fillRect(x, by + row.size * 1.3, Math.min(w, g.measureText(row.text).width), 1);
      g.globalAlpha = 1;
    } else if (row.t === 'orn') {
      ornament(g, x + w / 2, by + row.h * 0.5, size * (row.end ? 0.9 : 0.7), ink);
    } else if (row.t === 'sign') {
      g.font = font(row.size, 'sign');
      g.fillText(row.text, x + w - row.w, by + row.size * 1.05);
    } else if (row.t === 'text') {
      g.font = font(row.size, 'text');
      const base = by + row.size * 1.02;
      if (row.cap) {
        g.save();
        g.font = font(row.cap.size, 'cap');
        g.fillStyle = o.capInk || ink;
        g.fillText(row.cap.letter, x, by + row.cap.size * 0.86);
        g.restore();
        g.font = font(row.size, 'text');
      }
      // (Justified, but the last line of a paragraph, and a line so short
      // spreading it would gape.)
      const gaps = row.words.length - 1;
      const extra = row.width - row.w;
      const spread = !row.last && gaps > 0 && extra < row.width * 0.25 ? extra / gaps : 0;
      let cx = x + row.x0;
      const sp = g.measureText(' ').width;
      for (const word of row.words) {
        g.fillText(word, cx, base);
        cx += g.measureText(word).width + sp + spread;
      }
    }
  }
}
