// The Workshop's pieces (round 62): buttons, fields, sliders, colour
// pickers, menus, dialogs, notices, tooltips, panels that resize, and
// dragging things from one place to another. Plain DOM, the game's colours
// (see workshop.css).
import { iconSvg } from './icons.js';

// ------------------------------------------------------------ elements
// h('div', { class, style, on: { click }, ...attrs }, ...children)
export function h(tag, props = null, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) add(el, c);
    else el.append(c instanceof window.Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = (el) => {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
};
export function ic(name, size = 12) {
  const s = h('span', { class: 'ic', style: { display: 'inline-grid', placeItems: 'center', lineHeight: 0 } });
  s.innerHTML = iconSvg(name, size);
  return s;
}

// ------------------------------------------------------------ buttons
// button('Save', { icon: 'save', kind: 'primary', title, key, onClick })
export function button(label, o = {}) {
  const cls = ['btn', o.kind, o.small && 'small', !label && 'icon', o.on && 'on', o.cls].filter(Boolean).join(' ');
  const b = h('button', { class: cls, type: 'button', 'data-tip': o.title || null, 'data-key': o.key || null, disabled: o.disabled || null });
  if (o.icon) b.append(ic(o.icon, o.small ? 11 : 12));
  if (label) b.append(h('span', null, label));
  if (o.onClick) b.addEventListener('click', (e) => o.onClick(e, b));
  return b;
}
export const group = (...btns) => h('div', { class: 'btn-group' }, btns);

// ------------------------------------------------------------ fields
export function field(label, control, o = {}) {
  const l = h('label', { 'data-tip': o.tip || null }, label);
  const f = h('div', { class: `field${o.wide ? ' wide' : ''}` }, l, control);
  if (o.scrub) scrubber(l, o.scrub);
  return f;
}

// A label dragged left or right changes a number (as in paint programs).
export function scrubber(el, { get, set, step = 1, min = -Infinity, max = Infinity }) {
  el.classList.add('scrub');
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const x0 = e.clientX;
    const v0 = +get() || 0;
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const k = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      let v = v0 + Math.round((ev.clientX - x0) / 4) * step * k;
      v = Math.max(min, Math.min(max, v));
      set(+v.toFixed(4));
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
}

export function textInput(o = {}) {
  const el = h(o.long ? 'textarea' : 'input', { class: 'inp', placeholder: o.placeholder || null, spellcheck: 'false', maxlength: o.max || null });
  el.value = o.value ?? '';
  if (o.onInput) el.addEventListener('input', () => o.onInput(el.value));
  if (o.onChange) el.addEventListener('change', () => o.onChange(el.value));
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !o.long) el.blur();
    if (e.key === 'Escape') el.blur();
  });
  return el;
}

export function numberInput(o = {}) {
  const el = h('input', { class: 'inp num', type: 'text', inputmode: 'decimal' });
  const fmt = (v) => (Number.isInteger(v) ? String(v) : String(+(+v).toFixed(3)));
  el.value = fmt(o.value ?? 0);
  const commit = () => {
    let v = parseFloat(el.value);
    if (Number.isNaN(v)) v = o.value ?? 0;
    if (o.min !== undefined) v = Math.max(o.min, v);
    if (o.max !== undefined) v = Math.min(o.max, v);
    if (o.int) v = Math.round(v);
    el.value = fmt(v);
    o.onChange?.(v);
  };
  el.addEventListener('change', commit);
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') el.blur();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const st = (o.step || 1) * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      el.value = fmt(+(parseFloat(el.value || 0) + st).toFixed(4));
      commit();
    }
  });
  el.setValue = (v) => {
    if (document.activeElement !== el) el.value = fmt(v);
  };
  return el;
}

export function slider(o = {}) {
  const r = h('input', { class: 'rng', type: 'range', min: o.min ?? 0, max: o.max ?? 100, step: o.step ?? 1 });
  r.value = o.value ?? 0;
  const n = numberInput({ value: o.value ?? 0, min: o.min, max: o.max, step: o.step, int: o.int, onChange: (v) => {
    r.value = v;
    o.onChange?.(v);
  } });
  r.addEventListener('input', () => {
    const v = +r.value;
    n.setValue(v);
    o.onInput?.(v);
    if (!o.onInput) o.onChange?.(v);
  });
  r.addEventListener('change', () => o.onChange?.(+r.value));
  const el = h('div', { class: 'slider' }, r, n);
  el.setValue = (v) => {
    r.value = v;
    n.setValue(v);
  };
  return el;
}

export function check(label, value, onChange, o = {}) {
  const box = h('span', { class: 'box' });
  const el = h('label', { class: `check${value ? ' on' : ''}`, 'data-tip': o.tip || null }, box, label ? h('span', null, label) : null);
  const draw = (v) => {
    el.classList.toggle('on', !!v);
    box.innerHTML = v ? iconSvg('check', 10) : '';
  };
  let v = !!value;
  draw(v);
  el.addEventListener('click', (e) => {
    e.preventDefault();
    v = !v;
    draw(v);
    onChange(v);
  });
  el.setValue = (nv) => {
    v = !!nv;
    draw(v);
  };
  return el;
}

// One of a few, side by side.
export function seg(opts, value, onChange) {
  const el = h('div', { class: 'seg' });
  const btns = opts.map((o) => {
    const [v, label, tip] = Array.isArray(o) ? o : [o, o];
    const b = h('button', { type: 'button', class: v === value ? 'on' : '', 'data-tip': tip || null }, label);
    b.addEventListener('click', () => {
      for (const q of btns) q.classList.remove('on');
      b.classList.add('on');
      onChange(v);
    });
    return b;
  });
  el.append(...btns);
  return el;
}

// Any number of a list.
export function chips(opts, chosen, onChange) {
  const set = new Set(chosen || []);
  const el = h('div', { class: 'chips' });
  for (const o of opts) {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    const c = h('span', { class: `chip${set.has(v) ? ' on' : ''}` }, label);
    c.addEventListener('click', () => {
      if (set.has(v)) set.delete(v);
      else set.add(v);
      c.classList.toggle('on', set.has(v));
      onChange([...set]);
    });
    el.append(c);
  }
  return el;
}

export function select(opts, value, onChange) {
  const el = h('select', { class: 'inp' });
  for (const o of opts) {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    const op = h('option', { value: v }, label);
    if (v === value) op.selected = true;
    el.append(op);
  }
  el.addEventListener('change', () => onChange(el.value));
  el.addEventListener('keydown', (e) => e.stopPropagation());
  return el;
}

// A panel with a heading that folds away.
export function panel(title, body, o = {}) {
  const key = o.key ? `ws-panel-${o.key}` : null;
  let open = o.open ?? true;
  try {
    if (key && localStorage.getItem(key) !== null) open = localStorage.getItem(key) === '1';
  } catch {
    // No storage: as given.
  }
  const head = h('div', { class: 'panel-h' }, h('span', { class: 'chev' }, open ? '▾' : '▸'), title, o.tools ? h('span', { class: 'tools' }, o.tools) : null);
  const b = h('div', { class: 'panel-b' }, body);
  const el = h('div', { class: `panel${open ? '' : ' closed'}` }, head, b);
  head.addEventListener('click', (e) => {
    if (e.target.closest('.tools')) return;
    open = !open;
    el.classList.toggle('closed', !open);
    head.firstChild.textContent = open ? '▾' : '▸';
    try {
      if (key) localStorage.setItem(key, open ? '1' : '0');
    } catch {
      // Fine.
    }
  });
  el.body = b;
  return el;
}

// ------------------------------------------------------------ colour
export function hexToHsv(hex) {
  const s = String(hex || '#000000').replace('#', '');
  const r = parseInt(s.slice(0, 2), 16) / 255 || 0;
  const g = parseInt(s.slice(2, 4), 16) / 255 || 0;
  const b = parseInt(s.slice(4, 6), 16) / 255 || 0;
  const a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let hh = 0;
  if (d) hh = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: hh * 60, s: mx ? d / mx : 0, v: mx, a };
}
export function hsvToHex(hh, s, v, a = 1) {
  const f = (n) => {
    const k = (n + hh / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const c = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
  return `#${c(f(5))}${c(f(3))}${c(f(1))}${a < 1 ? c(a) : ''}`;
}
const recentColors = [];
export function colorPicker(value, onChange, o = {}) {
  let { h: H, s: S, v: V, a: A } = hexToHsv(value);
  const sv = h('div', { class: 'sv' });
  const dot = h('div', { class: 'dot' });
  sv.append(dot);
  const hue = h('div', { class: 'hue' }, h('div', { class: 'bar' }));
  const alpha = o.alpha ? h('div', { class: 'alpha' }, h('div', { class: 'bar' })) : null;
  const hexIn = textInput({ value, onChange: (t) => {
    const m = /^#?([0-9a-f]{6}([0-9a-f]{2})?)$/i.exec(t.trim());
    if (!m) return;
    ({ h: H, s: S, v: V, a: A } = hexToHsv(`#${m[1]}`));
    draw(true);
  } });
  const recent = h('div', { class: 'recent' });
  const draw = (emit) => {
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(H, 1, 1)})`;
    dot.style.left = `${S * 100}%`;
    dot.style.top = `${(1 - V) * 100}%`;
    dot.style.background = hsvToHex(H, S, V);
    hue.firstChild.style.left = `${(H / 360) * 100}%`;
    if (alpha) {
      alpha.style.background = `linear-gradient(90deg, transparent, ${hsvToHex(H, S, V)}), repeating-conic-gradient(#333 0 25%, #555 0 50%) 0 0 / 8px 8px`;
      alpha.firstChild.style.left = `${A * 100}%`;
    }
    const hex = hsvToHex(H, S, V, alpha ? A : 1);
    if (document.activeElement !== hexIn) hexIn.value = hex;
    if (emit) onChange(hex);
  };
  const drag = (el, fn) => el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    const at = (ev) => {
      const r = el.getBoundingClientRect();
      fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
      draw(true);
    };
    at(e);
    const up = () => {
      el.removeEventListener('pointermove', at);
      el.removeEventListener('pointerup', up);
      const hx = hsvToHex(H, S, V, alpha ? A : 1);
      if (!recentColors.includes(hx)) recentColors.unshift(hx);
      recentColors.length = Math.min(recentColors.length, 14);
    };
    el.addEventListener('pointermove', at);
    el.addEventListener('pointerup', up);
  });
  drag(sv, (x, y) => {
    S = x;
    V = 1 - y;
  });
  drag(hue, (x) => (H = x * 360));
  if (alpha) drag(alpha, (x) => (A = x));
  for (const c of recentColors) {
    const sw = h('span', { style: { background: c }, 'data-tip': c });
    sw.addEventListener('click', () => {
      ({ h: H, s: S, v: V, a: A } = hexToHsv(c));
      draw(true);
    });
    recent.append(sw);
  }
  draw(false);
  return h('div', { class: 'cp' }, sv, hue, alpha, h('div', { class: 'row' }, h('span', { class: 'note' }, 'Hex'), h('div', { class: 'grow' }, hexIn)), recentColors.length ? recent : null);
}

export function colorButton(value, onChange, o = {}) {
  const b = h('button', { class: 'swatch-btn', type: 'button', 'data-tip': o.tip || value });
  let v = value;
  const paint = () => {
    b.style.background = v;
    b.dataset.tip = o.tip || v;
  };
  paint();
  b.addEventListener('click', () => popover(b, colorPicker(v, (nv) => {
    v = nv;
    paint();
    onChange(nv);
  }, o)));
  b.setValue = (nv) => {
    v = nv;
    paint();
  };
  return b;
}

// ------------------------------------------------------------ layers above
let layer = null;
export function overlay() {
  if (!layer || !layer.isConnected) {
    layer = h('div', { class: 'ws-layer' });
    (document.getElementById('workshop') || document.body).append(layer);
  }
  return layer;
}

// Something shown by an element (a colour picker, a list): gone again
// when you click elsewhere or press Escape.
let openPop = null;
export function popover(anchor, content, o = {}) {
  closePopover();
  const el = h('div', { class: 'popover' }, content);
  overlay().append(el);
  const r = anchor.getBoundingClientRect();
  const W = el.offsetWidth;
  const H = el.offsetHeight;
  let x = o.x ?? r.left;
  let y = o.y ?? r.bottom + 6;
  if (x + W > window.innerWidth - 8) x = window.innerWidth - W - 8;
  if (y + H > window.innerHeight - 8) y = Math.max(8, r.top - H - 6);
  el.style.left = `${Math.max(8, x)}px`;
  el.style.top = `${y}px`;
  const away = (e) => {
    if (!el.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) closePopover();
  };
  const esc = (e) => {
    if (e.key === 'Escape') closePopover();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc, true);
  }, 0);
  openPop = { el, off: () => {
    document.removeEventListener('pointerdown', away, true);
    document.removeEventListener('keydown', esc, true);
    o.onClose?.();
  } };
  return el;
}
export function closePopover() {
  if (!openPop) return;
  openPop.el.remove();
  openPop.off();
  openPop = null;
}

// A menu of things to do: [{ label, icon, key, onClick, danger, off, sep,
// head, sub: [...] }], at (x, y).
let openMenu = null;
export function menu(items, x, y, o = {}) {
  closeMenu();
  const el = h('div', { class: 'menu', role: 'menu' });
  const build = (list, into) => {
    for (const it of list) {
      if (!it) continue;
      if (it.sep) {
        into.append(h('div', { class: 'sep' }));
        continue;
      }
      if (it.head) {
        into.append(h('div', { class: 'mh' }, it.head));
        continue;
      }
      const mi = h('div', { class: `mi${it.danger ? ' danger' : ''}${it.off ? ' off' : ''}${it.sub ? ' sub' : ''}`, 'data-tip': it.tip || null }, h('span', { class: 'ic' }, it.icon ? ic(it.icon) : it.swatch ? h('span', { style: { width: '10px', height: '10px', borderRadius: '2px', background: it.swatch, display: 'inline-block' } }) : ''), h('span', null, it.label), it.key ? h('span', { class: 'k' }, it.key) : null);
      if (it.sub) {
        mi.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = mi.getBoundingClientRect();
          menu(it.sub, r.right + 2, r.top - 4, { keep: true });
        });
      } else {
        mi.addEventListener('click', () => {
          closeMenu();
          it.onClick?.();
        });
      }
      into.append(mi);
    }
  };
  build(items, el);
  overlay().append(el);
  const W = el.offsetWidth;
  const H = el.offsetHeight;
  el.style.left = `${Math.max(6, Math.min(x, window.innerWidth - W - 6))}px`;
  el.style.top = `${Math.max(6, Math.min(y, window.innerHeight - H - 6))}px`;
  const prev = o.keep && openMenu ? openMenu : null;
  const away = (e) => {
    if (!el.contains(e.target) && !(prev && prev.el.contains(e.target))) closeMenu();
  };
  const key = (e) => {
    if (e.key === 'Escape') closeMenu();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key, true);
  }, 0);
  const mine = { el, prev, off: () => {
    document.removeEventListener('pointerdown', away, true);
    document.removeEventListener('keydown', key, true);
  } };
  if (prev) prev.child = mine;
  openMenu = mine;
  return el;
}
export function closeMenu() {
  let m = openMenu;
  while (m) {
    m.el.remove();
    m.off();
    m = m.prev;
  }
  openMenu = null;
}
export function contextMenu(e, items) {
  e.preventDefault();
  e.stopPropagation();
  return menu(items, e.clientX, e.clientY);
}

// ------------------------------------------------------------ dialogs
// dialog({ title, icon, body, buttons: [{ label, kind, value, onClick }],
// wide }): resolves with the button's value (or null, dismissed).
export function dialog(o) {
  return new Promise((resolve) => {
    const body = h('div', { class: 'db' }, typeof o.body === 'function' ? o.body() : o.body);
    const close = (v) => {
      scrim.remove();
      document.removeEventListener('keydown', key, true);
      resolve(v);
    };
    if (o.handle) o.handle.close = close;
    const foot = h('div', { class: 'df' });
    for (const b of o.buttons || [{ label: 'OK', kind: 'primary', value: true }]) {
      foot.append(button(b.label, { kind: b.kind, icon: b.icon, onClick: () => {
        if (b.onClick && b.onClick() === false) return;
        close(b.value ?? b.label);
      } }));
    }
    const box = h('div', { class: `dialog${o.wide ? ' wide' : ''}`, role: 'dialog' }, h('div', { class: 'dh' }, o.icon ? ic(o.icon, 14) : null, o.title), body, foot);
    const scrim = h('div', { class: 'scrim' }, box);
    scrim.addEventListener('pointerdown', (e) => {
      if (e.target === scrim && !o.modal) close(null);
    });
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(null);
      } else if (e.key === 'Enter' && !(e.target && e.target.tagName === 'TEXTAREA') && o.enter !== false) {
        const def = (o.buttons || []).find((q) => q.kind === 'primary' || q.kind === 'go' || q.kind === 'danger');
        if (def) {
          e.stopPropagation();
          e.preventDefault();
          if (def.onClick && def.onClick() === false) return;
          close(def.value ?? def.label);
        }
      }
    };
    document.addEventListener('keydown', key, true);
    overlay().append(scrim);
    const first = box.querySelector('input, textarea');
    if (first) setTimeout(() => {
      first.focus();
      first.select?.();
    }, 30);
  });
}
export const confirm = (title, text, o = {}) => dialog({ title, icon: o.icon || (o.danger ? 'warn' : 'info'), body: h('div', { class: 'note', style: { fontSize: '13px' } }, text), buttons: [{ label: o.no || 'Cancel', kind: 'ghost', value: false }, { label: o.yes || 'OK', kind: o.danger ? 'danger' : 'primary', value: true }] }).then((v) => v === true);
export function prompt(title, label, value = '', o = {}) {
  const inp = textInput({ value, placeholder: o.placeholder, max: o.max || 60 });
  return dialog({ title, icon: o.icon || 'pencil', body: [o.text ? h('div', { class: 'note' }, o.text) : null, field(label, inp, { wide: true })], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: o.yes || 'OK', kind: 'primary', value: 'ok' }] }).then((v) => (v === 'ok' ? inp.value.trim() : null));
}

// ------------------------------------------------------------ notices
let toastBox = null;
export function toast(text, kind = '', ms = 3200) {
  if (!toastBox || !toastBox.isConnected) {
    toastBox = h('div', { class: 'toasts' });
    overlay().append(toastBox);
  }
  const t = h('div', { class: `toast ${kind}` }, ic(kind === 'good' ? 'check' : kind === 'bad' ? 'warn' : 'info'), h('div', null, text));
  toastBox.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.3s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  }, ms);
}

// Tooltips: anything with data-tip (and data-key, a shortcut) says so
// when the pointer rests on it.
let tipEl = null;
let tipT = null;
export function tooltips(root) {
  root.addEventListener('pointerover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    window.clearTimeout(tipT);
    if (tipEl) tipEl.remove();
    tipEl = null;
    if (!t || !t.dataset.tip) return;
    tipT = setTimeout(() => {
      if (!t.isConnected) return;
      tipEl = h('div', { class: 'tip' }, t.dataset.tip, t.dataset.key ? h('span', { class: 'k' }, t.dataset.key) : null);
      overlay().append(tipEl);
      const r = t.getBoundingClientRect();
      const W = tipEl.offsetWidth;
      const H = tipEl.offsetHeight;
      let x = r.left + r.width / 2 - W / 2;
      let y = r.bottom + 6;
      if (y + H > window.innerHeight - 4) y = r.top - H - 6;
      x = Math.max(4, Math.min(window.innerWidth - W - 4, x));
      tipEl.style.left = `${x}px`;
      tipEl.style.top = `${y}px`;
    }, 420);
  });
  root.addEventListener('pointerdown', () => {
    window.clearTimeout(tipT);
    if (tipEl) tipEl.remove();
    tipEl = null;
  });
}

// ------------------------------------------------------------ resizing
// A bar between two panes: dragged, `el` grows or shrinks (from `side`,
// 'left' or 'right'); kept for next time under `key`.
export function splitter(el, side, key) {
  const bar = h('div', { class: 'split' });
  try {
    const w = +localStorage.getItem(`ws-w-${key}`);
    if (w > 0) el.style.width = `${w}px`;
  } catch {
    // Fine.
  }
  bar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('drag');
    const x0 = e.clientX;
    const w0 = el.getBoundingClientRect().width;
    const move = (ev) => {
      const d = ev.clientX - x0;
      el.style.width = `${Math.max(150, Math.min(560, side === 'left' ? w0 + d : w0 - d))}px`;
      window.dispatchEvent(new window.Event('ws-resize'));
    };
    const up = () => {
      bar.classList.remove('drag');
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      try {
        localStorage.setItem(`ws-w-${key}`, String(Math.round(el.getBoundingClientRect().width)));
      } catch {
        // Fine.
      }
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });
  return bar;
}

// ------------------------------------------------------------ dragging things about
// A thing of the mod dragged (from the explorer, onto a field, a canvas, a
// node graph): { kind, id, name }.
export const DRAG_TYPE = 'application/x-tessera-thing';
let dragging = null;
export function dragSource(el, get) {
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    const p = get();
    if (!p) return;
    dragging = p;
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(p));
    e.dataTransfer.setData('text/plain', p.name || p.id);
    e.dataTransfer.effectAllowed = 'copyLink';
  });
  el.addEventListener('dragend', () => {
    dragging = null;
  });
}
export const dragged = () => dragging;
export function dropTarget(el, accept, onDrop) {
  el.addEventListener('dragover', (e) => {
    const p = dragging;
    if (!p || !accept(p)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop'));
  el.addEventListener('drop', (e) => {
    el.classList.remove('drop');
    let p = dragging;
    if (!p) {
      try {
        p = JSON.parse(e.dataTransfer.getData(DRAG_TYPE));
      } catch {
        p = null;
      }
    }
    if (!p || !accept(p)) return;
    e.preventDefault();
    onDrop(p, e);
  });
}

// ------------------------------------------------------------ files
export function download(name, data, type = 'application/json') {
  const blob = data instanceof window.Blob ? data : new window.Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function pickFile(accept = '*', multiple = false) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
    if (multiple) inp.multiple = true;
    inp.addEventListener('change', () => {
      resolve(multiple ? [...inp.files] : inp.files[0] || null);
      inp.remove();
    });
    document.body.append(inp);
    inp.click();
  });
}
export const readText = (file) => new Promise((res, rej) => {
  const r = new window.FileReader();
  r.onload = () => res(String(r.result));
  r.onerror = () => rej(r.error);
  r.readAsText(file);
});
export const readImage = (file) => new Promise((res, rej) => {
  const url = URL.createObjectURL(file);
  const img = new window.Image();
  img.onload = () => {
    res(img);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  img.onerror = () => rej(new Error('That picture couldn\'t be read.'));
  img.src = url;
});

// A canvas of a size (pixels), its context with smoothing off.
export function canvas(w, h2) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h2;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return c;
}
