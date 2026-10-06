// A canvas of nodes and wires (round 62), for the Graph tool (entities)
// and the Story tool. Nodes are boxes you can drag about, with sockets:
// drag from one socket to another to wire them (only sockets that fit
// light up), or drop a wire on empty space to pick a node to go there,
// wired already. Drag the empty space to look about, the wheel to zoom;
// Shift-drag (or a drag from empty space with Ctrl) to select several.
// Right-click for more; Delete, Ctrl+C/V/D as you'd expect; F to see it
// all.
import { h, ic, clear, menu, contextMenu, textInput, numberInput, check, colorButton, select, chips, scrubber, soundPicker } from './kit.js';
import { SOUNDS } from '../mod/nodes.js';
import { shown } from '../mod/graph.js';

let clip = null;

export class NodeCanvas {
  // o: { defs (kind -> def), fits(fromType, toType), colors (type ->
  // colour), cats (category order), graph(), onChange(kind), onSelect(ids),
  // widget(node, port, onChange) -> element (an input's own field),
  // propWidget(node, prop, onChange), nodeExtra(node, el), canAdd(def),
  // onDrop(payload, at), checkpoint() }
  constructor(o) {
    this.o = o;
    this.zoom = 1;
    this.panX = 40;
    this.panY = 40;
    this.sel = new Set();
    this.els = new Map();
    this.wireDirty = true;
    this.el = h('div', { class: 'nc', tabindex: '0' });
    this.world = h('div', { class: 'nc-world' });
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'nc-wires');
    this.notesLayer = h('div', { class: 'nc-notes' });
    this.world.append(this.notesLayer, this.svg);
    this.box = h('div', { class: 'nc-box' });
    this.el.append(this.world, this.box);
    this.bind();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  destroy() {
    window.cancelAnimationFrame(this.raf);
    this.el.remove();
  }

  get g() {
    return this.o.graph();
  }

  // ------------------------------------------------------------ drawing
  render() {
    const g = this.g;
    clear(this.world);
    clear(this.notesLayer);
    this.world.append(this.notesLayer, this.svg);
    this.els.clear();
    for (const nt of g.notes || []) this.notesLayer.append(this.noteEl(nt));
    for (const n of g.nodes) {
      const el = this.nodeEl(n);
      this.world.append(el);
      this.els.set(n.id, el);
    }
    this.applyView();
    this.wireDirty = true;
  }

  applyView() {
    this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.el.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
    this.el.style.backgroundSize = `${24 * this.zoom}px ${24 * this.zoom}px`;
    this.o.onView?.(this.zoom);
  }

  loop() {
    this.raf = requestAnimationFrame(() => this.loop());
    if (this.wireDirty) {
      this.wireDirty = false;
      this.drawWires();
    }
  }

  // Where a socket is, in the world's own units.
  portPos(nid, pid, out) {
    const el = this.els.get(nid);
    if (!el) return null;
    const p = el.querySelector(`.nc-port[data-p="${window.CSS.escape(pid)}"][data-dir="${out ? 'out' : 'in'}"]`);
    if (!p) return null;
    const n = this.nodeOf(nid);
    let x = n.x;
    let y = n.y;
    let q = p;
    let dx = q.offsetWidth / 2;
    let dy = q.offsetHeight / 2;
    while (q && q !== el) {
      dx += q.offsetLeft;
      dy += q.offsetTop;
      q = q.offsetParent;
    }
    x += dx;
    y += dy;
    return { x, y };
  }

  nodeOf(id) {
    return this.g.nodes.find((n) => n.id === id);
  }

  drawWires() {
    const g = this.g;
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    const add = (d, color, cls = '', data = null) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('stroke', color);
      p.setAttribute('class', `nc-wire ${cls}`);
      if (data) {
        p.dataset.id = data;
        p.addEventListener('contextmenu', (e) => {
          const l = g.links.find((q) => q.id === data);
          if (!l) return;
          contextMenu(e, [{ label: 'Remove this wire', icon: 'close', danger: true, onClick: () => this.removeLinks([l]) }]);
        });
        p.addEventListener('dblclick', () => {
          const l = g.links.find((q) => q.id === data);
          if (l) this.removeLinks([l]);
        });
      }
      this.svg.append(p);
      return p;
    };
    for (const l of g.links) {
      const a = this.portPos(l.from[0], l.from[1], true);
      const b = this.portPos(l.to[0], l.to[1], false);
      if (!a || !b) continue;
      const t = this.portType(l.from[0], l.from[1], true);
      const flow = t === 'flow';
      const hot = this.sel.has(l.from[0]) || this.sel.has(l.to[0]);
      add(curve(a, b), (this.o.colors[t] || '#aaa'), `${flow ? 'flow' : 'data'}${hot ? ' hot' : ''}`, l.id);
    }
    if (this.dragWire) {
      const w = this.dragWire;
      add(w.out ? curve(w.a, w.b) : curve(w.b, w.a), this.o.colors[w.type] || '#fff', 'drag');
    }
  }

  portType(nid, pid, out) {
    const n = this.nodeOf(nid);
    const d = n && this.o.defs[n.type];
    if (!d) return 'any';
    const p = (out ? d.outMap : d.inMap)[pid];
    return p ? p.t : 'any';
  }

  // ------------------------------------------------------------ a node
  nodeEl(n) {
    const d = this.o.defs[n.type];
    const el = h('div', { class: `nc-node${this.sel.has(n.id) ? ' sel' : ''}${d && d.root ? ' root' : ''}${d ? '' : ' bad'}`, dataset: { id: n.id } });
    el.style.left = `${n.x}px`;
    el.style.top = `${n.y}px`;
    if (!d) {
      el.append(h('div', { class: 'nc-head', style: { background: '#5a2a2a' } }, h('span', null, `Unknown: ${n.type}`)));
      this.bindNode(el, n);
      return el;
    }
    const head = h('div', { class: 'nc-head', style: { background: `linear-gradient(90deg, ${d.color}, ${shadeHex(d.color, 0.7)})` } });
    const flowIn = d.in.find((p) => p.t === 'flow');
    if (flowIn) head.append(this.port(n, flowIn, false, true));
    head.append(h('span', { class: 'nc-title' }, d.title));
    if (d.help) {
      const q = h('span', { class: 'nc-help', 'data-tip': d.help }, '?');
      head.append(q);
    }
    el.append(head);
    const body = h('div', { class: 'nc-body' });
    const expanded = !!n.open;
    // (A setting that changes what else it has: the box again, as it is now.)
    const after = () => {
      this.changed(n);
      if (d.dyn) this.refreshNode(n);
    };
    const wiredIn = (p) => this.g.links.some((l) => l.to[0] === n.id && l.to[1] === p.id);
    const wiredOut = (p) => this.g.links.some((l) => l.from[0] === n.id && l.from[1] === p.id);
    // Props first (choices), then inputs, then outputs (each only if, as
    // it's set, it has it: see graph.shown).
    for (const p of d.props) {
      if (!shown(n, p)) continue;
      if (p.adv && !expanded) continue;
      if (p.t === 'multi' && !expanded) {
        const v = (n.p && n.p[p.id]) || p.def || [];
        body.append(h('div', { class: 'nc-row' }, h('span', { class: 'nc-lbl' }, p.label), h('span', { class: 'nc-val' }, v.length ? `${v.length} chosen` : 'none')));
        continue;
      }
      const w = this.o.propWidget(n, p, after);
      body.append(h('div', { class: 'nc-row' }, h('span', { class: 'nc-lbl' }, p.label), w));
    }
    for (const p of d.in) {
      if (p.t === 'flow') continue;
      const wired = wiredIn(p);
      if (!wired && !shown(n, p)) continue;
      if (p.adv && !expanded && !wired) continue;
      const row = h('div', { class: 'nc-row in' }, this.port(n, p, false));
      const lbl = h('span', { class: 'nc-lbl', 'data-tip': `${p.label} (${p.t})` }, p.label);
      row.append(lbl);
      if (!wired) {
        const w = this.o.widget(n, p, after);
        if (w) {
          row.append(w);
          if (p.t === 'number') scrubber(lbl, { get: () => (typeof (n.v && n.v[p.id]) === 'string' ? 0 : (n.v && n.v[p.id]) ?? p.def ?? 0), set: (v) => {
            n.v[p.id] = v;
            if (w.setValue) w.setValue(v);
            this.changed(n, true);
          }, step: p.step || 1, min: p.min ?? -Infinity, max: p.max ?? Infinity });
        }
      } else row.append(h('span', { class: 'nc-val wired' }, ic('chevLeft', 8), 'wired'));
      body.append(row);
    }
    const hasAdv = d.in.some((p) => p.adv && shown(n, p)) || d.props.some((p) => (p.adv || p.t === 'multi') && shown(n, p));
    if (hasAdv) {
      const more = h('div', { class: 'nc-more' }, ic(expanded ? 'chevUp' : 'chevDown', 8), expanded ? 'fewer' : 'more');
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        n.open = !n.open;
        this.refreshNode(n);
      });
      body.append(more);
    }
    const outs = d.out.filter((p) => wiredOut(p) || shown(n, p));
    if (outs.length) {
      const og = h('div', { class: 'nc-outs' });
      for (const p of outs) og.append(h('div', { class: `nc-row out${p.t === 'flow' ? ' flow' : ''}` }, h('span', { class: 'nc-lbl' }, p.label), this.port(n, p, true)));
      body.append(og);
    }
    this.o.nodeExtra?.(n, body);
    el.append(body);
    this.bindNode(el, n);
    return el;
  }

  port(n, p, out, inHead = false) {
    const t = p.t;
    const el = h('span', { class: `nc-port ${t === 'flow' ? 'flow' : 'data'}${inHead ? ' head' : ''}`, dataset: { p: p.id, dir: out ? 'out' : 'in', t }, 'data-tip': `${p.label || p.id}${t === 'flow' ? '' : ` · ${t}`}` });
    el.style.setProperty('--pc', this.o.colors[t] || '#aaa');
    const wired = out ? this.g.links.some((l) => l.from[0] === n.id && l.from[1] === p.id) : this.g.links.some((l) => l.to[0] === n.id && l.to[1] === p.id);
    if (wired) el.classList.add('on');
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.startWire(n, p, out, e);
    });
    return el;
  }

  refreshNode(n) {
    const old = this.els.get(n.id);
    const el = this.nodeEl(n);
    if (old) old.replaceWith(el);
    else this.world.append(el);
    this.els.set(n.id, el);
    this.wireDirty = true;
  }

  changed(n, quiet = false) {
    this.o.onChange?.(quiet ? 'value' : 'value');
    void n;
  }

  noteEl(nt) {
    const el = h('div', { class: 'nc-note', style: { left: `${nt.x}px`, top: `${nt.y}px`, width: `${nt.w}px`, height: `${nt.h}px`, borderColor: nt.color || '#5a5470' } });
    const t = h('div', { class: 'nc-note-t', contenteditable: 'true', spellcheck: 'false' }, nt.text || 'Note');
    t.addEventListener('keydown', (e) => e.stopPropagation());
    t.addEventListener('blur', () => {
      if (t.textContent !== nt.text) {
        this.o.checkpoint?.();
        nt.text = t.textContent.slice(0, 400);
        this.o.onChange?.('note');
      }
    });
    const grip = h('div', { class: 'nc-note-grip' });
    el.append(t, grip);
    el.addEventListener('pointerdown', (e) => {
      if (e.target === t || e.button !== 0) return;
      e.stopPropagation();
      this.o.checkpoint?.();
      const x0 = e.clientX;
      const y0 = e.clientY;
      const sx = nt.x;
      const sy = nt.y;
      const sw = nt.w;
      const sh = nt.h;
      const resize = e.target === grip;
      const move = (ev) => {
        const dx = (ev.clientX - x0) / this.zoom;
        const dy = (ev.clientY - y0) / this.zoom;
        if (resize) {
          nt.w = Math.max(120, Math.round(sw + dx));
          nt.h = Math.max(60, Math.round(sh + dy));
        } else {
          nt.x = Math.round(sx + dx);
          nt.y = Math.round(sy + dy);
        }
        el.style.left = `${nt.x}px`;
        el.style.top = `${nt.y}px`;
        el.style.width = `${nt.w}px`;
        el.style.height = `${nt.h}px`;
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        this.o.onChange?.('note');
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    el.addEventListener('contextmenu', (e) => contextMenu(e, [
      { head: 'Colour' },
      ...['#5a5470', '#7a5a2a', '#2a5a3a', '#2a4a6a', '#6a2a2a', '#5a3a6a'].map((c) => ({ label: c, swatch: c, onClick: () => {
        nt.color = c;
        el.style.borderColor = c;
        this.o.onChange?.('note');
      } })),
      { sep: true },
      { label: 'Delete note', icon: 'trash', danger: true, onClick: () => {
        this.o.checkpoint?.();
        this.g.notes = (this.g.notes || []).filter((q) => q !== nt);
        el.remove();
        this.o.onChange?.('note');
      } },
    ]));
    return el;
  }

  // ------------------------------------------------------------ moving nodes
  bindNode(el, n) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const tag = e.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag) || e.target.closest('.ref, .chip, .check, .swatch-btn, .nc-more, .nc-port')) {
        if (!this.sel.has(n.id)) this.select([n.id], e.shiftKey);
        return;
      }
      e.stopPropagation();
      if (!this.sel.has(n.id)) this.select([n.id], e.shiftKey);
      else if (e.shiftKey) {
        this.sel.delete(n.id);
        this.paintSel();
        return;
      }
      const x0 = e.clientX;
      const y0 = e.clientY;
      const starts = [...this.sel].map((id) => ({ n: this.nodeOf(id), x: this.nodeOf(id)?.x, y: this.nodeOf(id)?.y })).filter((q) => q.n);
      let moved = false;
      const move = (ev) => {
        const dx = (ev.clientX - x0) / this.zoom;
        const dy = (ev.clientY - y0) / this.zoom;
        if (!moved && Math.hypot(dx, dy) < 3) return;
        if (!moved) this.o.checkpoint?.();
        moved = true;
        for (const s of starts) {
          s.n.x = Math.round((s.x + dx) / 4) * 4;
          s.n.y = Math.round((s.y + dy) / 4) * 4;
          const ne = this.els.get(s.n.id);
          if (ne) {
            ne.style.left = `${s.n.x}px`;
            ne.style.top = `${s.n.y}px`;
          }
        }
        this.wireDirty = true;
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (moved) this.o.onChange?.('move');
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    el.addEventListener('contextmenu', (e) => {
      if (!this.sel.has(n.id)) this.select([n.id]);
      contextMenu(e, [
        { label: 'Duplicate', icon: 'copy', key: 'Ctrl+D', onClick: () => this.duplicate() },
        { label: 'Copy', key: 'Ctrl+C', onClick: () => this.copy() },
        { label: 'Remove its wires', icon: 'close', onClick: () => this.removeLinks(this.g.links.filter((l) => this.sel.has(l.from[0]) || this.sel.has(l.to[0]))) },
        { label: n.open ? 'Show fewer fields' : 'Show every field', onClick: () => {
          n.open = !n.open;
          this.refreshNode(n);
        } },
        ...(this.sel.size > 1 ? [
          { label: 'Line up in a column', onClick: () => this.lineUp('column') },
          { label: 'Line up in a row', onClick: () => this.lineUp('row') },
        ] : []),
        ...(this.o.nodeMenu ? this.o.nodeMenu(n) : []),
        { sep: true },
        { label: 'Delete', icon: 'trash', danger: true, key: 'Del', onClick: () => this.deleteSel(), off: this.o.defs[n.type]?.root },
      ]);
    });
  }

  // (Round 64) The chosen nodes put in a tidy column (or row), in the order
  // they're in now, a little apart.
  lineUp(how) {
    const list = [...this.sel].map((id) => this.nodeOf(id)).filter(Boolean);
    if (list.length < 2) return;
    this.o.checkpoint?.();
    const col = how === 'column';
    list.sort((a, b) => (col ? a.y - b.y : a.x - b.x));
    const x0 = Math.min(...list.map((q) => q.x));
    const y0 = Math.min(...list.map((q) => q.y));
    let at = col ? y0 : x0;
    for (const q of list) {
      const el = this.els.get(q.id);
      if (col) {
        q.x = x0;
        q.y = at;
        at += (el ? el.offsetHeight : 80) + 24;
      } else {
        q.y = y0;
        q.x = at;
        at += (el ? el.offsetWidth : 200) + 40;
      }
      if (el) {
        el.style.left = `${q.x}px`;
        el.style.top = `${q.y}px`;
      }
    }
    this.wireDirty = true;
    this.o.onChange?.('move');
  }

  select(ids, add = false) {
    if (!add) this.sel.clear();
    for (const id of ids) this.sel.add(id);
    this.paintSel();
  }

  paintSel() {
    for (const [id, el] of this.els) el.classList.toggle('sel', this.sel.has(id));
    this.wireDirty = true;
    this.o.onSelect?.([...this.sel]);
  }

  // ------------------------------------------------------------ wires
  startWire(n, p, out, e) {
    const g = this.g;
    // Pulling a wire off an input that has one: it's lifted, to be put
    // elsewhere (or dropped).
    if (!out) {
      const had = g.links.find((l) => l.to[0] === n.id && l.to[1] === p.id);
      if (had && p.t !== 'flow') {
        this.o.checkpoint?.();
        g.links = g.links.filter((l) => l !== had);
        const src = this.nodeOf(had.from[0]);
        const sp = this.o.defs[src.type].outMap[had.from[1]];
        this.refreshNode(n);
        return this.startWire(src, sp, true, e);
      }
    }
    const a = this.portPos(n.id, p.id, out);
    if (!a) return;
    this.dragWire = { n, p, out, type: p.t, a, b: a };
    // Sockets it could go into light up; the rest go dim.
    for (const el of this.world.querySelectorAll('.nc-port')) {
      const dir = el.dataset.dir;
      const ok = out ? dir === 'in' && this.o.fits(p.t, el.dataset.t) : dir === 'out' && this.o.fits(el.dataset.t, p.t);
      el.classList.toggle('ok', ok);
      el.classList.toggle('no', !ok);
    }
    const move = (ev) => {
      this.dragWire.b = this.toWorld(ev.clientX, ev.clientY);
      this.wireDirty = true;
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      for (const el of this.world.querySelectorAll('.nc-port')) el.classList.remove('ok', 'no');
      const w = this.dragWire;
      this.dragWire = null;
      this.wireDirty = true;
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const pe = target && target.closest && target.closest('.nc-port');
      if (pe) {
        const ne = pe.closest('.nc-node');
        const other = ne && this.nodeOf(ne.dataset.id);
        if (other && other !== w.n) {
          const op = (pe.dataset.dir === 'out' ? this.o.defs[other.type].outMap : this.o.defs[other.type].inMap)[pe.dataset.p];
          if (op && pe.dataset.dir !== (w.out ? 'out' : 'in')) {
            if (w.out) this.link(w.n, w.p, other, op);
            else this.link(other, op, w.n, w.p);
          }
        }
        return;
      }
      // Dropped on nothing: what goes there?
      if (!target || !target.closest('.nc-node')) {
        const at = this.toWorld(ev.clientX, ev.clientY);
        this.addMenu(ev.clientX, ev.clientY, at, { from: w });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Wire output `ap` of `a` into input `bp` of `b` (if they fit). A data
  // input takes one wire (a new one replaces it); a flow output goes on to
  // one place (likewise).
  link(a, ap, b, bp) {
    if (!this.o.fits(ap.t, bp.t)) return false;
    const g = this.g;
    this.o.checkpoint?.();
    if (bp.t !== 'flow') g.links = g.links.filter((l) => !(l.to[0] === b.id && l.to[1] === bp.id));
    if (ap.t === 'flow') g.links = g.links.filter((l) => !(l.from[0] === a.id && l.from[1] === ap.id));
    g.links.push({ id: `l${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, from: [a.id, ap.id], to: [b.id, bp.id] });
    this.refreshNode(a);
    this.refreshNode(b);
    this.o.onChange?.('link');
    return true;
  }

  removeLinks(list) {
    if (!list.length) return;
    this.o.checkpoint?.();
    const g = this.g;
    const ids = new Set(list.map((l) => l.id));
    const touched = new Set();
    for (const l of list) {
      touched.add(l.from[0]);
      touched.add(l.to[0]);
    }
    g.links = g.links.filter((l) => !ids.has(l.id));
    for (const id of touched) {
      const n = this.nodeOf(id);
      if (n) this.refreshNode(n);
    }
    this.o.onChange?.('link');
  }

  // ------------------------------------------------------------ adding
  // The list of what can be added (searchable). `wire`: dropped from a
  // wire, so only what fits it, wired once made.
  addMenu(cx, cy, at, wire = null) {
    const o = this.o;
    const w = wire && wire.from;
    const fitsDef = (d) => {
      if (o.canAdd && !o.canAdd(d)) return false;
      if (!w) return true;
      if (w.out) return d.in.some((p) => o.fits(w.type, p.t));
      return d.out.some((p) => o.fits(p.t, w.type));
    };
    const defs = Object.values(o.defs).filter(fitsDef);
    const box = h('div', { class: 'menu nc-add', style: { width: '300px' } });
    const q = textInput({ placeholder: w ? `Find a node for this ${w.type} wire...` : 'Find a node...' });
    const list = h('div', { class: 'scroll', style: { maxHeight: '360px', overflow: 'auto' } });
    let hits = [];
    let at2 = 0;
    const draw = () => {
      clear(list);
      const f = q.value.toLowerCase().trim();
      hits = [];
      const cats = o.cats.filter((c) => defs.some((d) => d.cat === c));
      for (const c of cats) {
        const ds = defs.filter((d) => d.cat === c && (!f || d.title.toLowerCase().includes(f) || (d.help || '').toLowerCase().includes(f) || c.toLowerCase().includes(f)));
        if (!ds.length) continue;
        list.append(h('div', { class: 'mh' }, c));
        for (const d of ds) {
          const i = hits.length;
          hits.push(d);
          const mi = h('div', { class: `mi${i === at2 ? ' hot' : ''}`, 'data-tip': d.help || null }, h('span', { class: 'ic' }, h('span', { style: { width: '9px', height: '9px', borderRadius: '2px', background: d.color, display: 'inline-block' } })), h('span', null, d.title));
          mi.addEventListener('click', () => pick(d));
          list.append(mi);
        }
      }
      if (!hits.length) list.append(h('div', { class: 'ex-empty' }, 'Nothing by that name.'));
      list.querySelector('.hot')?.scrollIntoView({ block: 'nearest' });
    };
    const close = () => {
      box.remove();
      document.removeEventListener('pointerdown', away, true);
    };
    const pick = (d) => {
      close();
      const n = this.addNode(d.type, at.x, at.y);
      if (w && n) {
        // (A socket the new node shows as it's set, first.)
        if (w.out) {
          const bp = d.in.find((p) => o.fits(w.type, p.t) && shown(n, p)) || d.in.find((p) => o.fits(w.type, p.t));
          if (bp) this.link(w.n, w.p, n, bp);
        } else {
          const ap = d.out.find((p) => o.fits(p.t, w.type) && shown(n, p)) || d.out.find((p) => o.fits(p.t, w.type));
          if (ap) this.link(n, ap, w.n, w.p);
        }
      }
    };
    q.addEventListener('input', () => {
      at2 = 0;
      draw();
    });
    q.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'ArrowDown') at2 = Math.min(hits.length - 1, at2 + 1);
      else if (e.key === 'ArrowUp') at2 = Math.max(0, at2 - 1);
      else if (e.key === 'Enter' && hits[at2]) return pick(hits[at2]);
      else if (e.key === 'Escape') return close();
      else return;
      e.preventDefault();
      draw();
    });
    box.append(h('div', { style: { padding: '4px' } }, q), list);
    const layer = document.querySelector('#workshop .ws-layer') || document.body;
    layer.append(box);
    box.style.left = `${Math.min(cx, window.innerWidth - 310)}px`;
    box.style.top = `${Math.min(cy, window.innerHeight - 420)}px`;
    draw();
    setTimeout(() => q.focus(), 10);
    const away = (e) => {
      if (!box.contains(e.target)) close();
    };
    setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
  }

  addNode(type, x, y, init = {}) {
    const n = this.o.makeNode(type, x, y, init);
    if (!n) return null;
    this.o.checkpoint?.();
    this.g.nodes.push(n);
    const el = this.nodeEl(n);
    this.world.append(el);
    this.els.set(n.id, el);
    this.select([n.id]);
    this.o.onChange?.('add');
    return n;
  }

  addNote(x, y) {
    this.o.checkpoint?.();
    const nt = { x: Math.round(x), y: Math.round(y), w: 260, h: 140, text: 'A note: what this part does.', color: '#5a5470' };
    (this.g.notes ||= []).push(nt);
    this.notesLayer.append(this.noteEl(nt));
    this.o.onChange?.('note');
  }

  deleteSel() {
    const g = this.g;
    const del = [...this.sel].filter((id) => {
      const n = this.nodeOf(id);
      return n && !(this.o.defs[n.type] && this.o.defs[n.type].root);
    });
    if (!del.length) return;
    this.o.checkpoint?.();
    const ids = new Set(del);
    const touched = new Set();
    for (const l of g.links) if (ids.has(l.from[0]) || ids.has(l.to[0])) {
      touched.add(l.from[0]);
      touched.add(l.to[0]);
    }
    g.nodes = g.nodes.filter((n) => !ids.has(n.id));
    g.links = g.links.filter((l) => !ids.has(l.from[0]) && !ids.has(l.to[0]));
    for (const id of del) {
      this.els.get(id)?.remove();
      this.els.delete(id);
    }
    for (const id of touched) {
      const n = this.nodeOf(id);
      if (n) this.refreshNode(n);
    }
    this.sel.clear();
    this.paintSel();
    this.o.onChange?.('delete');
  }

  copy() {
    const g = this.g;
    const ids = new Set([...this.sel].filter((id) => !(this.o.defs[this.nodeOf(id)?.type]?.root)));
    if (!ids.size) return;
    clip = { nodes: g.nodes.filter((n) => ids.has(n.id)).map((n) => JSON.parse(JSON.stringify(n))), links: g.links.filter((l) => ids.has(l.from[0]) && ids.has(l.to[0])).map((l) => JSON.parse(JSON.stringify(l))) };
  }

  paste(at = null) {
    if (!clip || !clip.nodes.length) return;
    const g = this.g;
    this.o.checkpoint?.();
    const minX = Math.min(...clip.nodes.map((n) => n.x));
    const minY = Math.min(...clip.nodes.map((n) => n.y));
    const p = at || this.toWorld(this.el.getBoundingClientRect().left + 200, this.el.getBoundingClientRect().top + 120);
    const map = new Map();
    const made = [];
    for (const n of clip.nodes) {
      if (!this.o.defs[n.type] || (this.o.defs[n.type].root && g.nodes.some((q) => this.o.defs[q.type]?.root))) continue;
      const id = `n${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      map.set(n.id, id);
      const m = { ...JSON.parse(JSON.stringify(n)), id, x: Math.round(p.x + n.x - minX), y: Math.round(p.y + n.y - minY) };
      g.nodes.push(m);
      made.push(id);
    }
    for (const l of clip.links) if (map.has(l.from[0]) && map.has(l.to[0])) g.links.push({ id: `l${Math.random().toString(36).slice(2, 9)}`, from: [map.get(l.from[0]), l.from[1]], to: [map.get(l.to[0]), l.to[1]] });
    this.render();
    this.select(made);
    this.o.onChange?.('paste');
  }

  duplicate() {
    this.copy();
    const n = this.nodeOf([...this.sel][0]);
    this.paste(n ? { x: n.x + 30, y: n.y + 30 } : null);
  }

  // ------------------------------------------------------------ the view
  toWorld(cx, cy) {
    const r = this.el.getBoundingClientRect();
    return { x: (cx - r.left - this.panX) / this.zoom, y: (cy - r.top - this.panY) / this.zoom };
  }

  frameAll() {
    const g = this.g;
    if (!g.nodes.length) return;
    const r = this.el.getBoundingClientRect();
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of g.nodes) {
      const el = this.els.get(n.id);
      const w = el ? el.offsetWidth : 200;
      const hh = el ? el.offsetHeight : 100;
      x0 = Math.min(x0, n.x);
      y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x + w);
      y1 = Math.max(y1, n.y + hh);
    }
    const z = Math.max(0.3, Math.min(1.2, Math.min((r.width - 80) / (x1 - x0 || 1), (r.height - 80) / (y1 - y0 || 1))));
    this.zoom = z;
    this.panX = (r.width - (x1 - x0) * z) / 2 - x0 * z;
    this.panY = (r.height - (y1 - y0) * z) / 2 - y0 * z;
    this.applyView();
  }

  setZoom(z, cx = null, cy = null) {
    const r = this.el.getBoundingClientRect();
    const px = cx ?? r.left + r.width / 2;
    const py = cy ?? r.top + r.height / 2;
    const w = this.toWorld(px, py);
    this.zoom = Math.max(0.25, Math.min(2, z));
    this.panX = px - r.left - w.x * this.zoom;
    this.panY = py - r.top - w.y * this.zoom;
    this.applyView();
  }

  bind() {
    const el = this.el;
    el.addEventListener('wheel', (e) => {
      if (e.target.closest('.scroll, textarea, .menu')) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) this.setZoom(this.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY);
      else {
        this.panX -= e.deltaX;
        this.applyView();
      }
    }, { passive: false });
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.nc-node, .nc-note')) return;
      el.focus();
      const sel = e.button === 0 && (e.shiftKey || e.ctrlKey);
      if (e.button === 0 && !sel) {
        if (!e.shiftKey) {
          this.sel.clear();
          this.paintSel();
        }
      }
      if (e.button === 2) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const px = this.panX;
      const py = this.panY;
      const r = el.getBoundingClientRect();
      const move = (ev) => {
        if (sel) {
          const a = { x: Math.min(x0, ev.clientX) - r.left, y: Math.min(y0, ev.clientY) - r.top };
          const b = { x: Math.max(x0, ev.clientX) - r.left, y: Math.max(y0, ev.clientY) - r.top };
          Object.assign(this.box.style, { display: 'block', left: `${a.x}px`, top: `${a.y}px`, width: `${b.x - a.x}px`, height: `${b.y - a.y}px` });
          const w0 = this.toWorld(a.x + r.left, a.y + r.top);
          const w1 = this.toWorld(b.x + r.left, b.y + r.top);
          const ids = [];
          for (const n of this.g.nodes) {
            const ne = this.els.get(n.id);
            const nw = ne ? ne.offsetWidth : 100;
            const nh = ne ? ne.offsetHeight : 60;
            if (n.x < w1.x && n.x + nw > w0.x && n.y < w1.y && n.y + nh > w0.y) ids.push(n.id);
          }
          this.select(ids, e.shiftKey);
          return;
        }
        this.panX = px + ev.clientX - x0;
        this.panY = py + ev.clientY - y0;
        this.applyView();
        el.style.cursor = 'grabbing';
      };
      const up = () => {
        this.box.style.display = 'none';
        el.style.cursor = '';
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    el.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.nc-node, .nc-note, path')) return;
      e.preventDefault();
      const at = this.toWorld(e.clientX, e.clientY);
      menu([
        { label: 'Add a node...', icon: 'plus', key: 'Space / A', onClick: () => this.addMenu(e.clientX, e.clientY, at) },
        { label: 'Add a note', icon: 'pencil', onClick: () => this.addNote(at.x, at.y) },
        { label: 'Paste', key: 'Ctrl+V', off: !clip, onClick: () => this.paste(at) },
        { sep: true },
        { label: 'See everything', icon: 'zoom', key: 'F', onClick: () => this.frameAll() },
      ], e.clientX, e.clientY);
    });
    el.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.code === 'Delete' || e.code === 'Backspace') this.deleteSel();
      else if (ctrl && e.code === 'KeyC') this.copy();
      else if (ctrl && e.code === 'KeyV') this.paste(this.lastMouse ? this.toWorld(this.lastMouse.x, this.lastMouse.y) : null);
      else if (ctrl && e.code === 'KeyD') this.duplicate();
      else if (ctrl && e.code === 'KeyA') this.select(this.g.nodes.map((n) => n.id));
      else if (e.code === 'KeyF') this.frameAll();
      else if ((e.code === 'Space' || e.code === 'KeyA') && !ctrl) {
        const m = this.lastMouse || { x: el.getBoundingClientRect().left + 200, y: el.getBoundingClientRect().top + 200 };
        this.addMenu(m.x, m.y, this.toWorld(m.x, m.y));
      } else return;
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('pointermove', (e) => {
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    // Things of the mod dropped on the canvas.
    el.addEventListener('dragover', (e) => {
      if (this.o.onDrop) e.preventDefault();
    });
    el.addEventListener('drop', (e) => {
      if (!this.o.onDrop) return;
      e.preventDefault();
      let p = null;
      try {
        p = JSON.parse(e.dataTransfer.getData('application/x-tessera-thing'));
      } catch {
        p = null;
      }
      if (p) this.o.onDrop(p, this.toWorld(e.clientX, e.clientY));
    });
  }
}

function curve(a, b) {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}
function shadeHex(hx, k) {
  const s = hx.replace('#', '');
  const c = (i) => Math.max(0, Math.min(255, Math.round(parseInt(s.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0');
  return `#${c(0)}${c(2)}${c(4)}`;
}

// The widget for a value of each kind (inline on a node, or bigger in the
// inspector).
export function valueWidget(t, value, onChange, o = {}) {
  if (t === 'sound') return soundPicker(o.opts || SOUNDS, value, onChange);
  if (t === 'number') return numberInput({ value: value ?? 0, min: o.min, max: o.max, step: o.step, onChange, vars: o.vars !== false });
  if (t === 'bool') return check(o.label || '', !!value, onChange);
  if (t === 'color') return colorButton(value || '#ffffff', onChange);
  if (t === 'enum') return select(o.opts.map((x) => (Array.isArray(x) ? x : [x, x])), value, onChange);
  if (t === 'multi') return chips(o.opts, value || [], onChange);
  if (t === 'text' || t === 'any') return textInput({ value: value ?? '', long: o.long && o.big, onChange });
  return null;
}
