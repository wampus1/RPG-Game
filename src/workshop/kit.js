// The Workshop's pieces (round 62): buttons, fields, sliders, colour
// pickers, menus, dialogs, notices, tooltips, panels that resize, and
// dragging things from one place to another. Plain DOM, styled by
// workshop.css.
//
// (Round 63) Whatever opens last is on top: a menu opened from a dialog
// shows over it, a sub-menu over its menu, a pop-up's own menu over the
// pop-up (see raise). Sub-menus open when the pointer rests on them, and
// the keys work in menus. Escape closes one thing at a time, the one on
// top. Sliders follow the pointer even when the panel they're in is drawn
// afresh under them, and a drag is one step to undo. The colour picker's
// "lately used" row only keeps colours that were used.
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

// ------------------------------------------------------------ the layer above
// Menus, pop-ups, dialogs, notices and tips go in one layer over the
// Workshop. Each new thing there is raised over all that came before.
let layer = null;
let zTop = 100;
export function overlay() {
  if (!layer || !layer.isConnected) {
    layer = h('div', { class: 'ws-layer' });
    (document.getElementById('workshop') || document.body).append(layer);
  }
  return layer;
}
export function raise(el) {
  el.style.zIndex = String(++zTop);
  return el;
}
// Is `t` (something clicked) in a thing of the layer raised over `el`?
function above(t, el) {
  const top = t && t.closest ? t.closest('.ws-layer > *') : null;
  return !!top && top !== el && +top.style.zIndex > +(el.style.zIndex || 0);
}

// Escape closes what's on top, one thing at a time.
const escStack = [];
export function onEscape(fn) {
  escStack.push(fn);
  return () => {
    const i = escStack.lastIndexOf(fn);
    if (i >= 0) escStack.splice(i, 1);
  };
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !escStack.length) return;
  e.preventDefault();
  e.stopPropagation();
  escStack[escStack.length - 1]();
}, true);

// A change made by dragging (a slider, a label scrubbed): one step to undo,
// however many small changes it made on the way (see Workshop.checkpoint).
export const gesture = { on: false, n: 0 };
const gestureStart = () => {
  gesture.on = true;
  gesture.n++;
};
const gestureEnd = () => {
  gesture.on = false;
};

// ------------------------------------------------------------ sounds
// (Round 64) The game's sounds, heard in the Workshop (a sound picked, an
// effect previewed): the Workshop's music dips under them a moment. Set
// by the app (see app.js): { play(name), duck(secs) }.
let soundHost = null;
export function setSoundHost(o) {
  soundHost = o;
}
export function playSound(name, o = {}) {
  if (!name || !soundHost) return;
  try {
    soundHost.play(name);
    soundHost.duck?.(o.duck ?? 1.4);
  } catch {
    // (No sound to be had: fine.)
  }
}
// A choice of one of the game's sounds, with a button to hear it (and
// each heard as it's picked).
export function soundPicker(sounds, value, onChange, o = {}) {
  // (Round 66: the mod's own sounds first, as '@id'.)
  const mine = o.mine === false ? [] : (soundHost?.mine?.() || []).map(([id, name]) => [`@${id}`, `♪ ${name}`]);
  const list = [...(o.none ? [['', o.none]] : []), ...mine, ...sounds.map((x) => (Array.isArray(x) ? x : [x, x]))];
  if (value && String(value)[0] === '@' && !list.some(([v]) => v === value)) list.unshift([value, '(a sound that\'s been deleted)']);
  let v = value ?? '';
  const sel = select(list, v, (nv) => {
    v = nv;
    if (nv) playSound(nv);
    onChange(nv);
  });
  const hear = button(null, { icon: 'play', small: true, kind: 'ghost', title: 'Hear it', onClick: (e) => {
    e.stopPropagation();
    playSound(v || sel.value);
  } });
  const el = h('div', { class: 'sound-pick' }, sel, hear);
  el.setValue = (nv) => {
    v = nv ?? '';
    sel.value = v;
  };
  return el;
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
    gestureStart();
    const move = (ev) => {
      const k = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      let v = v0 + Math.round((ev.clientX - x0) / 4) * step * k;
      v = Math.max(min, Math.min(max, v));
      set(+v.toFixed(4));
    };
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      gestureEnd();
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
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

// (`o.vars`: a {variable} may be typed instead of a number: see
// graph.FILL.)
export function numberInput(o = {}) {
  const el = h('input', { class: 'inp num', type: 'text', inputmode: 'decimal' });
  const fmt = (v) => (typeof v === 'string' ? v : Number.isInteger(v) ? String(v) : String(+(+v).toFixed(3)));
  el.value = fmt(o.value ?? 0);
  if (o.vars) el.dataset.tip = 'A number, or a {variable}';
  const commit = () => {
    if (o.vars && el.value.includes('{')) {
      o.onChange?.(el.value.trim().slice(0, 60));
      return;
    }
    let v = parseFloat(el.value);
    if (Number.isNaN(v)) v = o.value ?? 0;
    if (o.min !== undefined) v = Math.max(o.min, v);
    if (o.max !== undefined) v = Math.min(o.max, v);
    if (o.int) v = Math.round(v);
    el.value = fmt(v);
    o.onChange?.(v);
  };
  el.addEventListener('change', commit);
  el.addEventListener('focus', () => el.select());
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

// A number on a track, with a box to type it in. Dragged, it says so at
// most once a frame (onInput, or onChange when there's no onInput), and
// onChange once more when let go; it keeps following the pointer even if
// the panel it's in is drawn afresh under it. Click the track to jump
// there, drag the knob to move from where it is; hold Shift for fine
// steps. Focused (clicked, or Tab), the arrow keys, Page Up/Down, Home and
// End move it, and so does the wheel. `def`: double-click to put it back.
export function slider(o = {}) {
  const min = +(o.min ?? 0);
  const max = +(o.max ?? 100);
  const step = Math.max(1e-6, +(o.step ?? 1));
  const dec = (String(step).split('.')[1] || '').length;
  const snap = (x) => {
    let v = Math.max(min, Math.min(max, +x || 0));
    v = min + Math.round((v - min) / step) * step;
    v = +v.toFixed(Math.min(8, dec + 1));
    if (o.int) v = Math.round(v);
    return Math.max(min, Math.min(max, v));
  };
  let v = snap(o.value ?? min);
  let sent = v;
  let raf = 0;
  // (A panel drawn afresh by a change keeps where it was scrolled to.)
  let scroller = null;
  let scrollTop = 0;
  const hold = () => {
    scroller = null;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight + 1 && /(auto|scroll)/.test(window.getComputedStyle(p).overflowY)) {
        scroller = p;
        scrollTop = p.scrollTop;
        break;
      }
    }
  };
  const keep = () => {
    if (scroller && scroller.isConnected && scroller.scrollTop !== scrollTop) scroller.scrollTop = scrollTop;
  };
  const say = (fn) => {
    fn?.(v);
    keep();
  };
  const fill = h('div', { class: 'sl-fill' });
  const knob = h('div', { class: 'sl-knob' });
  const track = h('div', { class: 'sl-track', tabindex: '0', role: 'slider', 'aria-valuemin': String(min), 'aria-valuemax': String(max), 'data-tip': o.tip || null }, h('div', { class: 'sl-groove' }), fill, knob);
  const steps = (max - min) / step;
  if (steps >= 2 && steps <= 20) for (let i = 1; i < steps; i++) track.append(h('i', { class: 'sl-tick', style: { left: `${(i / steps) * 100}%` } }));
  const box = numberInput({ value: v, min, max, step, int: o.int, onChange: (nv) => {
    const was = v;
    show(snap(nv));
    commit(was);
  } });
  const el = h('div', { class: 'slider' }, track, box);
  function show(nv) {
    v = nv;
    const f = max > min ? (v - min) / (max - min) : 0;
    fill.style.width = `${f * 100}%`;
    knob.style.left = `${f * 100}%`;
    track.setAttribute('aria-valuenow', String(v));
    box.setValue(v);
  }
  const live = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      if (v === sent) return;
      sent = v;
      say(o.onInput || o.onChange);
    });
  };
  // Let go (or a key, or the box): said for good.
  function commit(from) {
    window.cancelAnimationFrame(raf);
    raf = 0;
    if (!scroller) hold();
    if (o.onInput) {
      if (v !== sent) {
        sent = v;
        say(o.onInput);
      }
      if (v !== from) say(o.onChange);
    } else if (v !== sent) {
      sent = v;
      say(o.onChange);
    }
    scroller = null;
  }
  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    track.focus({ preventScroll: true });
    gestureStart();
    hold();
    const r = track.getBoundingClientRect();
    const from = v;
    const span = Math.max(1, r.width);
    let ax = e.clientX;
    let av = v;
    // (Grabbed by the knob, or with Shift: it moves on from where it is,
    // a tenth as fast while Shift's held.)
    let rel = e.target === knob || e.shiftKey;
    let fine = e.shiftKey;
    const at = (ev) => {
      if (ev.shiftKey !== fine) {
        fine = ev.shiftKey;
        rel = true;
        ax = ev.clientX;
        av = v;
      }
      if (rel) return snap(av + ((ev.clientX - ax) / span) * (max - min) * (fine ? 0.1 : 1));
      return snap(min + ((ev.clientX - r.left) / span) * (max - min));
    };
    if (!rel) show(at(e));
    live();
    track.classList.add('drag');
    const move = (ev) => {
      const nv = at(ev);
      if (nv !== v) {
        show(nv);
        live();
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      track.classList.remove('drag');
      commit(from);
      gestureEnd();
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  });
  track.addEventListener('keydown', (e) => {
    const big = Math.max(step, snap(min + (max - min) / 10) - min);
    let nv = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nv = v + (e.shiftKey ? big : step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nv = v - (e.shiftKey ? big : step);
    else if (e.key === 'PageUp') nv = v + big;
    else if (e.key === 'PageDown') nv = v - big;
    else if (e.key === 'Home') nv = min;
    else if (e.key === 'End') nv = max;
    else return;
    e.preventDefault();
    e.stopPropagation();
    const was = v;
    show(snap(nv));
    commit(was);
  });
  track.addEventListener('wheel', (e) => {
    if (document.activeElement !== track) return;
    e.preventDefault();
    const was = v;
    show(snap(v + (e.deltaY < 0 ? step : -step) * (e.shiftKey ? 10 : 1)));
    commit(was);
  }, { passive: false });
  if (o.def !== undefined) {
    track.addEventListener('dblclick', () => {
      const was = v;
      show(snap(o.def));
      commit(was);
    });
  }
  show(v);
  el.setValue = (nv) => {
    show(snap(nv));
    sent = v;
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
    const [v, label, tip] = Array.isArray(o) ? o : [o, o];
    const c = h('span', { class: `chip${set.has(v) ? ' on' : ''}`, 'data-tip': tip || null }, label);
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
  const chev = h('span', { class: 'chev' }, ic('chevDown', 8));
  const head = h('div', { class: 'panel-h' }, chev, h('span', { class: 'pt' }, title), o.tools ? h('span', { class: 'tools' }, o.tools) : null);
  const b = h('div', { class: 'panel-b' }, body);
  const el = h('div', { class: `panel${open ? '' : ' closed'}` }, head, b);
  head.addEventListener('click', (e) => {
    if (e.target.closest('.tools')) return;
    open = !open;
    el.classList.toggle('closed', !open);
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

// Colours lately used (painted with, given to something): the picker's
// row of them. Only colours that were used, not every one passed on the
// way to one (round 63).
const RECENT_KEY = 'ws-recent-colors';
const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
let recentColors = null;
function recents() {
  if (!recentColors) {
    try {
      recentColors = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((c) => HEX.test(c)).slice(0, 16);
    } catch {
      recentColors = [];
    }
  }
  return recentColors;
}
export function rememberColor(hex) {
  if (!HEX.test(hex || '')) return;
  const list = recents();
  const c = hex.toLowerCase();
  const i = list.indexOf(c);
  if (i === 0) return;
  if (i > 0) list.splice(i, 1);
  list.unshift(c);
  list.length = Math.min(list.length, 16);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Fine.
  }
}

export function colorPicker(value, onChange, o = {}) {
  let { h: H, s: S, v: V, a: A } = hexToHsv(value);
  const sv = h('div', { class: 'sv' });
  const dot = h('div', { class: 'dot' });
  sv.append(dot);
  const hue = h('div', { class: 'hue' }, h('div', { class: 'bar' }));
  const alpha = o.alpha ? h('div', { class: 'alpha' }, h('div', { class: 'bar' })) : null;
  const was = h('span', { class: 'cp-was', style: { background: value }, 'data-tip': `As it was (${value}): click to go back to it` });
  const now = h('span', { class: 'cp-now' });
  const hexIn = textInput({ value, onChange: (t) => {
    const m = /^#?([0-9a-f]{6}([0-9a-f]{2})?)$/i.exec(t.trim());
    if (!m) return;
    ({ h: H, s: S, v: V, a: A } = hexToHsv(`#${m[1]}`));
    draw(true);
  } });
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
    now.style.background = hex;
    if (document.activeElement !== hexIn) hexIn.value = hex;
    if (emit) onChange(hex);
  };
  was.addEventListener('click', () => {
    ({ h: H, s: S, v: V, a: A } = hexToHsv(value));
    draw(true);
  });
  const drag = (el, fn) => el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const at = (ev) => {
      const r = el.getBoundingClientRect();
      fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
      draw(true);
    };
    at(e);
    gestureStart();
    const up = () => {
      window.removeEventListener('pointermove', at, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      gestureEnd();
    };
    window.addEventListener('pointermove', at, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  });
  drag(sv, (x, y) => {
    S = x;
    V = 1 - y;
  });
  drag(hue, (x) => (H = x * 360));
  if (alpha) drag(alpha, (x) => (A = x));
  const list = recents();
  const recent = h('div', { class: 'recent' });
  for (const c of list) {
    const sw = h('span', { style: { background: c }, 'data-tip': c });
    sw.addEventListener('click', () => {
      ({ h: H, s: S, v: V, a: A } = hexToHsv(c));
      draw(true);
    });
    recent.append(sw);
  }
  draw(false);
  return h('div', { class: 'cp' }, sv, hue, alpha,
    h('div', { class: 'row' }, h('span', { class: 'cp-pair' }, was, now), h('span', { class: 'note' }, 'Hex'), h('div', { class: 'grow' }, hexIn)),
    list.length ? h('div', { class: 'note cp-lh' }, 'Lately used') : null, list.length ? recent : null);
}

export function colorButton(value, onChange, o = {}) {
  const b = h('button', { class: 'swatch-btn', type: 'button', 'data-tip': o.tip || value });
  let v = value;
  const paint = () => {
    b.style.background = v;
    b.dataset.tip = o.tip || v;
  };
  paint();
  b.addEventListener('click', () => {
    const start = v;
    popover(b, colorPicker(v, (nv) => {
      v = nv;
      paint();
      onChange(nv);
    }, o), { onClose: () => {
      if (v !== start) rememberColor(v);
    } });
  });
  b.setValue = (nv) => {
    v = nv;
    paint();
  };
  return b;
}

// ------------------------------------------------------------ pop-ups
// Something shown by an element (a colour picker, a list): gone again when
// you click elsewhere or press Escape.
let openPop = null;
export function popover(anchor, content, o = {}) {
  closePopover();
  const el = raise(h('div', { class: 'popover' }, content));
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
    if (el.contains(e.target) || e.target === anchor || anchor.contains(e.target) || above(e.target, el)) return;
    closePopover();
  };
  setTimeout(() => {
    if (openPop && openPop.el === el) document.addEventListener('pointerdown', away, true);
  }, 0);
  const unEsc = onEscape(() => closePopover());
  openPop = { el, off: () => {
    document.removeEventListener('pointerdown', away, true);
    unEsc();
    o.onClose?.();
  } };
  return el;
}
export function closePopover() {
  if (!openPop) return;
  const p = openPop;
  openPop = null;
  p.el.remove();
  p.off();
}

// ------------------------------------------------------------ menus
// A menu of things to do: [{ label, icon, swatch, key, tip, onClick,
// danger, off, sep, head, sub: [...] }], at (x, y). A thing with `sub`
// opens its menu beside it when the pointer rests on it (or it's clicked,
// or → is pressed on it). Keys: ↑ ↓ to choose, → or Enter into a
// sub-menu, ← back out of it, Enter to do it, Escape to close the
// sub-menu (or the menu), a letter to the next thing starting with it.
let root = null;
export const menuOpen = () => !!root;

export function menu(items, x, y) {
  closeMenu();
  const M = openMenuAt(items, x, y, null);
  root = M;
  const away = (e) => {
    for (let m = root; m; m = m.child) if (m.el.contains(e.target)) return;
    if (root && above(e.target, root.el)) return;
    closeMenu();
  };
  const keys = (e) => menuKey(e);
  setTimeout(() => {
    if (root !== M) return;
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', keys, true);
  }, 0);
  const unEsc = onEscape(() => {
    let d = root;
    while (d && d.child) d = d.child;
    if (d && d.parent) closeChildren(d.parent);
    else closeMenu();
  });
  M.off = () => {
    document.removeEventListener('pointerdown', away, true);
    document.removeEventListener('keydown', keys, true);
    unEsc();
  };
  return M.el;
}

function openMenuAt(items, x, y, parent, leftEdge = null) {
  const el = raise(h('div', { class: 'menu', role: 'menu' }));
  const M = { el, items: [], parent, child: null, from: -1, at: -1, timer: 0, off: null };
  for (const it of items) {
    if (!it) continue;
    if (it.sep) {
      el.append(h('div', { class: 'sep' }));
      continue;
    }
    if (it.head) {
      el.append(h('div', { class: 'mh' }, it.head));
      continue;
    }
    const icon = it.icon ? ic(it.icon) : it.swatch ? h('span', { class: 'sw', style: { background: it.swatch } }) : '';
    const mi = h('div', { class: `mi${it.danger ? ' danger' : ''}${it.off ? ' off' : ''}${it.sub ? ' sub' : ''}`, role: 'menuitem', 'data-tip': it.tip || null },
      h('span', { class: 'ic' }, icon), h('span', { class: 'ml' }, it.label), it.key ? h('span', { class: 'k' }, it.key) : null, it.sub ? h('span', { class: 'arr' }, ic('chevRight', 8)) : null);
    const idx = M.items.length;
    M.items.push({ it, mi });
    mi.addEventListener('pointerenter', () => hoverItem(M, idx));
    mi.addEventListener('click', (e) => {
      e.stopPropagation();
      activate(M, idx, false);
    });
    el.append(mi);
  }
  // (Into a sub-menu: its menu keeps it open.)
  el.addEventListener('pointerenter', () => {
    if (M.parent) {
      window.clearTimeout(M.parent.timer);
      M.parent.timer = 0;
      if (M.parent.items[M.from]) setHot(M.parent, M.from);
    }
  });
  overlay().append(el);
  const W = el.offsetWidth;
  const H = el.offsetHeight;
  let left = x;
  if (left + W > window.innerWidth - 6) left = leftEdge !== null ? leftEdge - W : window.innerWidth - W - 6;
  el.style.left = `${Math.max(6, left)}px`;
  el.style.top = `${Math.max(6, Math.min(y, window.innerHeight - H - 6))}px`;
  return M;
}

function setHot(M, idx) {
  if (M.at >= 0 && M.items[M.at]) M.items[M.at].mi.classList.remove('hot');
  M.at = idx;
  if (idx >= 0 && M.items[idx]) M.items[idx].mi.classList.add('hot');
}

function hoverItem(M, idx) {
  setHot(M, idx);
  window.clearTimeout(M.timer);
  M.timer = 0;
  const { it } = M.items[idx];
  if (M.child && M.child.from === idx) return;
  // (A moment's grace: the pointer on its way to an open sub-menu may pass
  // over others.)
  const wait = M.child ? 240 : it.sub ? 90 : 0;
  if (!wait && !it.sub) return;
  M.timer = window.setTimeout(() => {
    M.timer = 0;
    if (!M.el.isConnected) return;
    closeChildren(M);
    if (it.sub && !it.off && M.at === idx) openSub(M, idx, false);
  }, wait);
}

function openSub(M, idx, keyed) {
  closeChildren(M);
  const { it, mi } = M.items[idx];
  const r = mi.getBoundingClientRect();
  const S = openMenuAt(it.sub, r.right + 2, r.top - 5, M, r.left - 2);
  S.from = idx;
  M.child = S;
  mi.classList.add('open');
  if (keyed) setHot(S, nextOn(S, -1, 1));
}

function closeChildren(M) {
  if (!M.child) return;
  if (M.items[M.child.from]) M.items[M.child.from].mi.classList.remove('open');
  for (let c = M.child; c; c = c.child) {
    window.clearTimeout(c.timer);
    c.el.remove();
  }
  M.child = null;
}

function activate(M, idx, keyed) {
  const { it } = M.items[idx];
  if (it.off) return;
  if (it.sub) {
    window.clearTimeout(M.timer);
    M.timer = 0;
    if (M.child && M.child.from === idx) {
      if (keyed) setHot(M.child, nextOn(M.child, -1, 1));
      return;
    }
    openSub(M, idx, keyed);
    return;
  }
  closeMenu();
  it.onClick?.();
}

// The next of a menu's things (from `i`, going `d`) that can be chosen.
function nextOn(M, i, d) {
  const n = M.items.length;
  for (let k = 1; k <= n; k++) {
    const j = (((i + d * k) % n) + n) % n;
    if (!M.items[j].it.off) return j;
  }
  return -1;
}

function menuKey(e) {
  if (!root) return;
  let M = root;
  while (M.child) M = M.child;
  const k = e.key;
  const stop = () => {
    e.preventDefault();
    e.stopPropagation();
  };
  if (k === 'ArrowDown' || k === 'ArrowUp') {
    stop();
    setHot(M, nextOn(M, M.at < 0 && k === 'ArrowUp' ? 0 : M.at, k === 'ArrowDown' ? 1 : -1));
  } else if (k === 'ArrowRight') {
    stop();
    if (M.at >= 0 && M.items[M.at].it.sub && !M.items[M.at].it.off) openSub(M, M.at, true);
  } else if (k === 'ArrowLeft') {
    stop();
    if (M.parent) closeChildren(M.parent);
  } else if (k === 'Enter' || k === ' ') {
    stop();
    if (M.at >= 0) activate(M, M.at, true);
  } else if (k.length === 1 && /\S/.test(k) && !e.ctrlKey && !e.metaKey) {
    stop();
    const c = k.toLowerCase();
    const n = M.items.length;
    for (let s = 1; s <= n; s++) {
      const j = (M.at + s + n) % n;
      const { it } = M.items[j];
      if (!it.off && String(it.label || '').toLowerCase().startsWith(c)) {
        setHot(M, j);
        break;
      }
    }
  }
}

export function closeMenu() {
  if (!root) return;
  const M = root;
  root = null;
  for (let c = M; c; c = c.child) {
    window.clearTimeout(c.timer);
    c.el.remove();
  }
  M.off?.();
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
    let unEsc = null;
    const close = (v) => {
      scrim.remove();
      document.removeEventListener('keydown', key, true);
      unEsc?.();
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
    const box = h('div', { class: `dialog${o.wide ? ' wide' : ''}`, role: 'dialog' }, h('div', { class: 'dh' }, o.icon ? ic(o.icon, 12) : null, h('span', { class: 'dt' }, o.title)), body, foot);
    const scrim = raise(h('div', { class: 'scrim' }, box));
    scrim.addEventListener('pointerdown', (e) => {
      if (e.target === scrim && !o.modal) close(null);
    });
    const key = (e) => {
      // (A menu or a pop-up over it has the keys first.)
      if (root || (openPop && above(openPop.el, scrim))) return;
      if (e.key === 'Enter' && !(e.target && e.target.tagName === 'TEXTAREA') && o.enter !== false) {
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
    unEsc = onEscape(() => close(null));
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
export function tooltips(root2) {
  root2.addEventListener('pointerover', (e) => {
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
  root2.addEventListener('pointerdown', () => {
    window.clearTimeout(tipT);
    if (tipEl) tipEl.remove();
    tipEl = null;
  });
}

// ------------------------------------------------------------ resizing
// A bar between two panes: dragged, `el` grows or shrinks (from `side`,
// 'left' or 'right'); kept for next time under `key`.
export function splitter(el, side, key) {
  const bar = h('div', { class: `split ${side}` });
  try {
    const w = +localStorage.getItem(`ws-w-${key}`);
    if (w > 0) el.style.width = `${w}px`;
  } catch {
    // Fine.
  }
  // (Round 66) A button on it folds the panel away (and back): kept so.
  const fold = h('button', { class: 'fold', type: 'button' });
  const setFolded = (on, keep = true) => {
    el.classList.toggle('folded', on);
    bar.classList.toggle('folded', on);
    clear(fold);
    fold.append(ic(on === (side === 'left') ? 'chevRight' : 'chevLeft', 9));
    fold.setAttribute('data-tip', on ? 'Show this panel' : 'Fold this panel away');
    if (keep) {
      try {
        localStorage.setItem(`ws-fold-${key}`, on ? '1' : '');
      } catch {
        // Fine.
      }
    }
    window.dispatchEvent(new window.Event('ws-resize'));
  };
  let folded = false;
  try {
    folded = localStorage.getItem(`ws-fold-${key}`) === '1';
  } catch {
    folded = false;
  }
  setFolded(folded, false);
  fold.addEventListener('pointerdown', (e) => e.stopPropagation());
  fold.addEventListener('click', (e) => {
    e.stopPropagation();
    setFolded(!el.classList.contains('folded'));
  });
  bar.append(fold);
  bar.fold = setFolded;
  bar.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('folded')) return;
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
