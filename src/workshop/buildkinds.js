// The rest of the Builder (round 62): loot tables (what a chest or a
// creature gives, with a chest rolled to see it and the odds over a
// thousand), layouts (structures set out together with paths between, as
// a hamlet, a camp, a graveyard), and dungeons (a way in, floors below,
// a master at the bottom), each its own editor inside the Builder.
import { h, ic, clear, button, field, numberInput, slider, select, chips, panel, textInput, dropTarget, check, group } from './kit.js';
import { titleBar, menuButton, refPicker, refThumb, refLabel, pickRef, biomeOptions } from './common.js';
import { renderVox, pickCell, frameOf, structVox, layoutVox, toView, cellY, T, voxPicture } from './voxview.js';
import { blockIcon } from './blockart.js';
import { NODES } from '../mod/graph.js';
import { ITEMS } from '../world/items.js';
import { buildPreset, blockButton } from './builder.js';
import { PRESETS } from './buildops.js';

const WHERE = [['wild', 'In the wilds'], ['near towns', 'Near towns'], ['far from towns', 'Far from towns'], ['by the sea', 'By the sea']];
const ISLES = [['any', 'Any island'], ['thessa', 'Thessa'], ['kharos', 'Kharos'], ['myrrow', 'Myrrow']];
const ZOOMS = [1, 1.5, 2, 3, 4, 5, 6];
const ITEM_TPL = ['tpl.food', 'tpl.weapon', 'tpl.tool', 'tpl.armor', 'tpl.material', 'tpl.block'];

// Where a thing goes in the world: its settings.
function placeFields(app, kind, id, P, redraw, o = {}) {
  const set = (fn, again = false) => {
    app.checkpoint(kind, id);
    fn();
    app.touch(kind, id);
    if (again) redraw();
  };
  const out = [];
  if (o.where !== false) out.push(field('Where', select(WHERE, P.where || 'wild', (v) => set(() => (P.where = v))), { tip: 'Where in a new world it\'s put.' }));
  out.push(field('How many', slider({ value: P.count ?? 1, min: 0, max: 12, int: true, onChange: (v) => set(() => (P.count = v)) }), { tip: 'How many in each world (0: none; a graph can still place it).' }));
  out.push(field('Island', select(ISLES, P.isle || 'any', (v) => set(() => (P.isle = v)))));
  out.push(field('Biomes', chips(biomeOptions(app), P.biomes || [], (v) => set(() => (P.biomes = v))), { wide: true, tip: 'None chosen: any.' }));
  if (o.clear !== false) out.push(check('Clear the ground over it (trees, hills)', P.clear !== false, (v) => set(() => (P.clear = v))));
  return out;
}

// ============================================================ loot tables
// Is a reference one of the game's items, or one of the mod's?
function itemOk(app, k) {
  if (!k) return false;
  if (k[0] === '@') {
    const e = app.mod.entities[k.slice(1)];
    const r = e && (e.graph.nodes || []).find((n) => NODES[n.type] && NODES[n.type].root);
    return !!r && ITEM_TPL.includes(r.type);
  }
  return !!ITEMS[k];
}

// A table rolled (as the game rolls it: see mod/hooks.js rollLoot).
export function rollTable(app, t, rand = Math.random) {
  const out = [];
  for (const a of t.always || []) {
    if (rand() * 100 >= (a.chance ?? 100) || !itemOk(app, a.item)) continue;
    out.push({ item: a.item, count: (a.min ?? 1) + Math.floor(rand() * ((a.max ?? a.min ?? 1) - (a.min ?? 1) + 1)) });
  }
  const ents = (t.entries || []).filter((e) => itemOk(app, e.item) && (e.w ?? 1) > 0);
  const [r0, r1] = t.rolls || [1, 2];
  const rolls = r0 + Math.floor(rand() * (r1 - r0 + 1));
  const total = ents.reduce((s, e) => s + (e.w ?? 1), 0);
  for (let i = 0; i < rolls && total > 0; i++) {
    let r = rand() * total;
    const e = ents.find((q) => (r -= q.w ?? 1) < 0) || ents[ents.length - 1];
    out.push({ item: e.item, count: (e.min ?? 1) + Math.floor(rand() * ((e.max ?? e.min ?? 1) - (e.min ?? 1) + 1)) });
  }
  const m = new Map();
  for (const d of out) m.set(d.item, (m.get(d.item) || 0) + d.count);
  return [...m].map(([item, count]) => ({ item, count }));
}

export class LootEditor {
  constructor(tool, id) {
    this.tool = tool;
    this.app = tool.app;
    this.id = id;
    this.seed = 1;
  }

  get t() {
    return this.app.mod.loot[this.id];
  }

  hintText() {
    return 'Each roll picks one thing from the list, the heavier ones more often. Drag items from the explorer onto the list.';
  }

  keyHelp() {
    return [['R', 'Roll the chest again']];
  }

  onKey(e) {
    if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
      this.seed++;
      this.drawRoll();
      return true;
    }
    return false;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.build();
  }

  unmount() {}

  reload() {
    if (this.t) this.build();
  }

  renamed() {
    if (this.nameEl && this.t) this.nameEl.value = this.t.name;
  }

  otherChanged() {
    if (this.t) this.drawUsers();
  }

  set(fn, redraw = true) {
    this.app.checkpoint('loot', this.id);
    fn(this.t);
    this.app.touch('loot', this.id);
    if (redraw) this.drawTable();
    this.drawRoll();
    this.drawOdds();
  }

  build() {
    const app = this.app;
    const t = this.t;
    t.rolls ||= [1, 2];
    t.entries ||= [];
    t.always ||= [];
    clear(this.stage);
    clear(this.insp);
    const bar = titleBar(app, 'loot', this.id, h('span', { class: 'spacer' }), menuButton('Use it', () => [
      { label: 'Drop it from a new creature', icon: 'skull', onClick: () => app.newEntity('tpl.hostile', { loot: this.id }, 'Looter') },
      { label: 'Fill a chest in a new structure', icon: 'house', onClick: async () => {
        const st = buildPreset(PRESETS.find((p) => p.id === 'ruin'), `${t.name} ruin`);
        const k = st.marks.find((m) => m.type === 'chest');
        if (k) k.loot = this.id;
        await app.create('structures', st);
      } },
    ], { small: true, kind: 'primary', icon: 'star' }));
    this.nameEl = bar.querySelector('.title input');
    const body = h('div', { class: 'scroll', style: { flex: 1, overflow: 'auto', padding: '14px 18px' } });
    this.tableEl = h('div');
    this.rollEl = h('div');
    this.oddsEl = h('div');
    body.append(this.tableEl, h('div', { class: 'loot-split' }, h('div', null, h('h3', { class: 'lt-h' }, ic('chest'), 'One chest of it', button('Roll again', { small: true, icon: 'dice', key: 'R', onClick: () => {
      this.seed++;
      this.drawRoll();
    } })), this.rollEl), h('div', null, h('h3', { class: 'lt-h' }, ic('dice'), 'Over a thousand chests'), this.oddsEl)));
    this.stage.append(bar, body);
    dropTarget(body, (p) => p.kind === 'entities' && ITEM_TPL.includes(p.tpl), (p) => this.set((x) => x.entries.push({ item: `@${p.id}`, w: 3, min: 1, max: 1 })));
    this.insp.append(h('div', { class: 'insp-head' }, ic('chest'), t.name));
    const ib = h('div', { class: 'insp-body scroll' });
    this.usersPanel = panel('Used by', h('div'), { key: 'lt-users' });
    ib.append(this.usersPanel, panel('How it works', h('div', { class: 'note' }, 'A chest (or a creature, when it dies) is given everything under "Always" (each by its chance), then rolls the table a number of times. Each roll picks one thing from the list: one with a weight of 4 is picked twice as often as one of 2. The same thing picked twice stacks.'), { key: 'lt-how' }));
    this.insp.append(ib);
    this.drawTable();
    this.drawRoll();
    this.drawOdds();
    this.drawUsers();
  }

  drawTable() {
    const app = this.app;
    const t = this.t;
    const el = this.tableEl;
    clear(el);
    const r0 = numberInput({ value: t.rolls[0], min: 0, max: 20, int: true, onChange: (v) => this.set((x) => (x.rolls = [v, Math.max(v, x.rolls[1])])) });
    const r1 = numberInput({ value: t.rolls[1], min: 0, max: 20, int: true, onChange: (v) => this.set((x) => (x.rolls = [Math.min(v, x.rolls[0]), v])) });
    r0.style.width = '54px';
    r1.style.width = '54px';
    el.append(h('h3', { class: 'lt-h' }, ic('dice'), 'Rolls'), h('div', { class: 'row', style: { alignItems: 'center', gap: '8px', marginBottom: '14px' } }, h('span', null, 'Pick'), r0, h('span', null, 'to'), r1, h('span', { class: 'note' }, 'things from the list below, each time it\'s filled.')));
    const total = t.entries.reduce((s, e) => s + Math.max(0, e.w ?? 1), 0);
    const tbl = h('div', { class: 'lt-table' });
    tbl.append(h('div', { class: 'lt-row head' }, h('span', null, 'Thing'), h('span', null, 'Weight'), h('span', null, 'How many'), h('span', null, 'Each roll'), h('span')));
    t.entries.forEach((e, i) => {
      const pct = total ? ((e.w ?? 1) / total) * 100 : 0;
      const bad = !itemOk(app, e.item);
      const row = h('div', { class: `lt-row${bad ? ' bad' : ''}` },
        refPicker(app, 'item', e.item, (v) => this.set((x) => (x.entries[i].item = v))),
        slider({ value: e.w ?? 1, min: 0, max: 20, int: true, onChange: (v) => this.set((x) => (x.entries[i].w = v)) }),
        h('span', { class: 'row', style: { gap: '4px', alignItems: 'center' } }, numberInput({ value: e.min ?? 1, min: 1, max: 99, int: true, onChange: (v) => this.set((x) => {
          x.entries[i].min = v;
          x.entries[i].max = Math.max(v, x.entries[i].max ?? v);
        }) }), '–', numberInput({ value: e.max ?? e.min ?? 1, min: 1, max: 99, int: true, onChange: (v) => this.set((x) => {
          x.entries[i].max = v;
          x.entries[i].min = Math.min(v, x.entries[i].min ?? v);
        }) })),
        h('span', { class: 'lt-bar' }, h('i', { style: { width: `${pct}%` } }), h('b', null, `${pct < 1 && pct > 0 ? pct.toFixed(1) : Math.round(pct)}%`)),
        button(null, { icon: 'trash', small: true, kind: 'ghost', title: 'Take it off the list', onClick: () => this.set((x) => x.entries.splice(i, 1)) }));
      tbl.append(row);
    });
    el.append(h('h3', { class: 'lt-h' }, ic('chest'), 'What it might give'), tbl);
    el.append(h('div', { class: 'row', style: { margin: '6px 0 16px' } }, button('Add a thing', { icon: 'plus', small: true, onClick: (ev) => pickRef(app, 'item', ev.currentTarget, (v) => v && this.set((x) => x.entries.push({ item: v, w: 3, min: 1, max: 1 }))) }), h('span', { class: 'note' }, 'or drag one of your items here.')));
    // Always.
    const at = h('div', { class: 'lt-table always' });
    at.append(h('div', { class: 'lt-row head' }, h('span', null, 'Thing'), h('span', null, 'Chance'), h('span', null, 'How many'), h('span'), h('span')));
    t.always.forEach((a, i) => {
      at.append(h('div', { class: `lt-row${itemOk(app, a.item) ? '' : ' bad'}` },
        refPicker(app, 'item', a.item, (v) => this.set((x) => (x.always[i].item = v))),
        h('span', { class: 'row', style: { gap: '4px', alignItems: 'center' } }, numberInput({ value: a.chance ?? 100, min: 1, max: 100, int: true, onChange: (v) => this.set((x) => (x.always[i].chance = v)) }), '%'),
        h('span', { class: 'row', style: { gap: '4px', alignItems: 'center' } }, numberInput({ value: a.min ?? 1, min: 1, max: 99, int: true, onChange: (v) => this.set((x) => {
          x.always[i].min = v;
          x.always[i].max = Math.max(v, x.always[i].max ?? v);
        }) }), '–', numberInput({ value: a.max ?? a.min ?? 1, min: 1, max: 99, int: true, onChange: (v) => this.set((x) => {
          x.always[i].max = v;
          x.always[i].min = Math.min(v, x.always[i].min ?? v);
        }) })),
        h('span'),
        button(null, { icon: 'trash', small: true, kind: 'ghost', onClick: () => this.set((x) => x.always.splice(i, 1)) })));
    });
    el.append(h('h3', { class: 'lt-h' }, ic('star'), 'Always (as well)'), at, h('div', { class: 'row', style: { margin: '6px 0 18px' } }, button('Add a thing it always has', { icon: 'plus', small: true, onClick: (ev) => pickRef(app, 'item', ev.currentTarget, (v) => v && this.set((x) => x.always.push({ item: v, min: 1, max: 1, chance: 100 }))) })));
  }

  // One chest's worth, as it would be (18 slots, the game's chest).
  drawRoll() {
    const app = this.app;
    const el = this.rollEl;
    clear(el);
    let s = this.seed * 9301 + 49297;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const got = rollTable(app, this.t, rand);
    const slots = new Array(18).fill(null);
    for (const d of got) for (let k = 0; k < 40; k++) {
      const i = Math.floor(rand() * 18);
      if (!slots[i]) {
        slots[i] = d;
        break;
      }
    }
    const grid = h('div', { class: 'slotgrid' });
    for (const d of slots) {
      const sl = h('div', { class: 'slot' });
      if (d) {
        const th = refThumb(app, 'item', d.item);
        if (th) sl.append(th);
        sl.setAttribute('data-tip', `${refLabel(app, 'item', d.item)} × ${d.count}`);
        if (d.count > 1) sl.append(h('b', null, String(d.count)));
      }
      grid.append(sl);
    }
    el.append(grid, h('div', { class: 'note' }, got.length ? got.map((d) => `${refLabel(app, 'item', d.item)} ×${d.count}`).join(', ') : 'Empty, this time.'));
  }

  drawOdds() {
    const app = this.app;
    const el = this.oddsEl;
    clear(el);
    const N = 1000;
    let s = 77;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    const seen = new Map();
    let things = 0;
    let empty = 0;
    for (let i = 0; i < N; i++) {
      const got = rollTable(app, this.t, rand);
      if (!got.length) empty++;
      for (const d of got) {
        const q = seen.get(d.item) || { n: 0, sum: 0 };
        q.n++;
        q.sum += d.count;
        seen.set(d.item, q);
        things += d.count;
      }
    }
    const list = h('div', { class: 'lt-odds' });
    for (const [item, q] of [...seen].sort((a, b) => b[1].n - a[1].n)) {
      const th = refThumb(app, 'item', item);
      list.append(h('div', { class: 'lt-odd' }, h('span', { class: 'ico' }, th), h('span', { class: 'nm' }, refLabel(app, 'item', item)), h('span', { class: 'lt-bar' }, h('i', { style: { width: `${(q.n / N) * 100}%` } }), h('b', null, `${Math.round((q.n / N) * 100)}%`)), h('span', { class: 'note' }, `~${(q.sum / q.n).toFixed(1)}`)));
    }
    el.append(h('div', { class: 'note', style: { marginBottom: '6px' } }, `About ${(things / N).toFixed(1)} things a chest${empty ? `; ${Math.round((empty / N) * 100)}% are empty` : ''}. How often each turns up (and how many, when it does):`), list);
  }

  drawUsers() {
    const app = this.app;
    const body = this.usersPanel.body;
    clear(body);
    const list = h('div', { class: 'list' });
    for (const st of Object.values(app.mod.structures || {})) for (const m of st.marks || []) if (m.type === 'chest' && m.loot === this.id) {
      const li = h('div', { class: 'li' }, ic('house'), `${st.name}: a chest`);
      li.addEventListener('click', () => {
        app.open('structures', st.id).then(() => app.tools.builder?.chooseMark?.(m.id));
      });
      list.append(li);
    }
    for (const e of Object.values(app.mod.entities || {})) {
      const r = (e.graph.nodes || []).find((n) => NODES[n.type] && NODES[n.type].root);
      if (r && r.v && r.v.loot === this.id) {
        const li = h('div', { class: 'li' }, ic('skull'), `${e.name} (when it dies)`);
        li.addEventListener('click', () => app.open('entities', e.id));
        list.append(li);
      }
    }
    if (!list.children.length) list.append(h('div', { class: 'note' }, 'Nothing uses it yet. Give it to a chest marker in a structure, or to a creature\'s Loot.'));
    body.append(list);
  }
}

// ============================================================ a canvas of blocks
// Pan, zoom and fit for a picture of blocks (the layout's).
class BlockCanvas {
  constructor(wrap, o) {
    this.wrap = wrap;
    this.o = o;
    this.cv = h('canvas');
    wrap.append(this.cv);
    this.zoom = 0;
    this.pan = { x: 0, y: 0 };
    this.cv.addEventListener('contextmenu', (e) => e.preventDefault());
    this.cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = this.toWorld(e);
      this.zoomBy(e.deltaY < 0 ? 1 : -1, p.mx, p.my);
    }, { passive: false });
  }

  toWorld(e) {
    const r = this.cv.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    return { mx, my, wx: (mx - this.pan.x) / this.zoom, wy: (my - this.pan.y) / this.zoom };
  }

  resize(F, refit) {
    const r = this.wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.max(1, Math.round(r.width * dpr));
    this.cv.height = Math.max(1, Math.round(r.height * dpr));
    this.cw = r.width;
    this.ch = r.height;
    if (refit || !this.zoom) this.fit(F);
  }

  fit(F) {
    const k = Math.min((this.cw - 40) / F.pw, (this.ch - 40) / F.ph);
    this.zoom = ZOOMS.reduce((b, z) => (z <= k ? z : b), 1);
    this.pan.x = Math.round((this.cw - F.pw * this.zoom) / 2);
    this.pan.y = Math.round((this.ch - F.ph * this.zoom) / 2);
  }

  zoomBy(d, cx, cy) {
    const i = ZOOMS.indexOf(this.zoom);
    const z = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 2 : i) + d))];
    const px = cx ?? this.cw / 2;
    const py = cy ?? this.ch / 2;
    this.pan.x = px - ((px - this.pan.x) * z) / this.zoom;
    this.pan.y = py - ((py - this.pan.y) * z) / this.zoom;
    this.zoom = z;
    this.o.onChange?.();
  }

  begin() {
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#08060b';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(this.zoom * dpr, 0, 0, this.zoom * dpr, this.pan.x * dpr, this.pan.y * dpr);
    ctx.imageSmoothingEnabled = false;
    return ctx;
  }
}

// ============================================================ layouts
const PATHS = ['path', 'gravel', 'cobblestone', 'planks', 'flagstone', 'sand', 'dirt', 'stone_bricks'];

export class LayoutEditor {
  constructor(tool, id) {
    this.tool = tool;
    this.app = tool.app;
    this.id = id;
    this.mode = 'move';
    this.pathBlock = 'path';
    this.rot = 0;
    this.selPiece = null;
    this.dirty = true;
  }

  get L() {
    return this.app.mod.layouts[this.id];
  }

  hintText() {
    return {
      move: 'Drag structures from the explorer onto the ground. Drag one to move it; R turns it; Delete takes it away.',
      path: 'Paint paths between them on the ground (right button: take path away). The path block is under Paths.',
      hand: 'Drag to look about. The wheel zooms.',
    }[this.mode];
  }

  keyHelp() {
    return [['V', 'Move pieces'], ['B', 'Paint paths'], ['H', 'Look about'], ['R', 'Turn the piece'], ['Delete', 'Take the piece away'], ['← →', 'Turn the view']];
  }

  onKey(e) {
    if (e.ctrlKey || e.metaKey) return false;
    const k = { KeyV: 'move', KeyB: 'path', KeyH: 'hand' }[e.code];
    if (k) {
      this.setMode(k);
      return true;
    }
    if (e.code === 'KeyR' && this.selPiece !== null) {
      this.turnPiece(this.selPiece);
      return true;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selPiece !== null) {
      this.removePiece(this.selPiece);
      return true;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      this.rot = (this.rot + (e.key === 'ArrowLeft' ? -1 : 1) + 4) & 3;
      this.refit = true;
      this.dirty = true;
      return true;
    }
    if (e.code === 'Space') {
      this.space = true;
      return true;
    }
    return false;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.onResize = () => this.resize(false);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('ws-resize', this.onResize);
    this.keyUp = (e) => {
      if (e.code === 'Space') this.space = false;
    };
    window.addEventListener('keyup', this.keyUp);
    this.build();
  }

  unmount() {
    window.cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('ws-resize', this.onResize);
    window.removeEventListener('keyup', this.keyUp);
  }

  reload() {
    if (this.L) this.build();
  }

  renamed() {
    if (this.nameEl && this.L) this.nameEl.value = this.L.name;
  }

  otherChanged(kind) {
    if (kind === 'structures') {
      this.dirty = true;
      this.drawPieces();
    }
  }

  change(fn, o = {}) {
    this.app.checkpoint('layouts', this.id);
    fn(this.L);
    this.app.touch('layouts', this.id);
    this.dirty = true;
    if (o.pieces !== false) this.drawPieces();
  }

  setMode(m) {
    this.mode = m;
    for (const [k, b] of Object.entries(this.modeBtns)) b.classList.toggle('on', k === m);
    this.app.hint(this.hintText());
  }

  build() {
    const app = this.app;
    const L = this.L;
    L.pieces ||= [];
    L.paths ||= [];
    L.place ||= { where: 'wild', biomes: [], count: 1, isle: 'any', clear: true };
    L.size = Math.max(16, Math.min(96, L.size || 48));
    clear(this.stage);
    clear(this.insp);
    const bar = titleBar(app, 'layouts', this.id,
      button(null, { icon: 'rotate', small: true, title: 'Turn the view (←)', onClick: () => this.onKey({ key: 'ArrowLeft' }) }),
      button(null, { icon: 'zoom', small: true, title: 'Fit', onClick: () => this.resize(true) }),
      h('span', { class: 'spacer' }),
      button('Add a structure', { icon: 'plus', small: true, kind: 'primary', onClick: (e) => pickRef(app, 'structure', e.currentTarget, (v) => v && this.addPiece(v, null), { create: () => this.tool.newDialog({ open: false }).then((id) => id && this.addPiece(id, null)) }) }));
    this.nameEl = bar.querySelector('.title input');
    const vt = h('div', { class: 'vtools' });
    this.modeBtns = {};
    for (const [k, icon, tip, key] of [['move', 'move', 'Move pieces', 'V'], ['path', 'pencil', 'Paint paths', 'B'], ['hand', 'hand', 'Look about', 'H']]) {
      const b = button(null, { icon, title: tip, key, on: this.mode === k, onClick: () => this.setMode(k) });
      this.modeBtns[k] = b;
      vt.append(b);
    }
    this.wrap = h('div', { class: 'canvas-wrap' });
    this.view = new BlockCanvas(this.wrap, { onChange: () => (this.dirty = true) });
    this.hud = h('div', { class: 'hud' }, 'Drag structures here from the explorer.');
    this.wrap.append(this.hud);
    this.bind();
    this.stage.append(bar, h('div', { style: { flex: 1, display: 'flex', minHeight: 0 } }, vt, this.wrap));
    dropTarget(this.wrap, (p) => p.kind === 'structures', (p, e) => this.addPiece(p.id, e));
    // Inspector.
    this.insp.append(h('div', { class: 'insp-head' }, ic('grid'), L.name));
    const ib = h('div', { class: 'insp-body scroll' });
    this.piecesPanel = panel('Pieces', h('div'), { key: 'ly-pieces' });
    this.pathsPanel = panel('Paths', h('div'), { key: 'ly-paths' });
    this.layoutPanel = panel('Layout', h('div'), { key: 'ly-layout' });
    ib.append(this.piecesPanel, this.pathsPanel, this.layoutPanel);
    this.insp.append(ib);
    this.drawPieces();
    this.drawPaths();
    this.drawLayout();
    this.app.hint(this.hintText());
    requestAnimationFrame(() => this.resize(true));
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.draw();
    };
    window.cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  }

  resize(refit) {
    if (!this.wrap || !this.wrap.isConnected) return;
    this.vox = layoutVox(this.app.mod, this.L);
    this.view.resize(frameOf(this.vox, this.rot), refit);
    this.dirty = true;
  }

  draw() {
    if (!this.dirty || !this.view) return;
    this.dirty = false;
    this.vox = layoutVox(this.app.mod, this.L);
    const vox = this.vox;
    const F = frameOf(vox, this.rot);
    if (this.refit) {
      this.refit = false;
      this.view.fit(F);
    }
    const ctx = this.view.begin();
    // The ground: its own square.
    const gy = cellY(F, vox, 0, vox.ground);
    renderVox(ctx, this.app, vox, { rot: this.rot, ground: true });
    ctx.lineWidth = 1 / this.view.zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    for (let u = 0; u <= F.W; u += 4) {
      ctx.moveTo(u * T, gy);
      ctx.lineTo(u * T, gy + F.D * T);
    }
    for (let v = 0; v <= F.D; v += 4) {
      ctx.moveTo(0, gy + v * T);
      ctx.lineTo(F.W * T, gy + v * T);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(240,192,64,0.6)';
    ctx.lineWidth = 1.5 / this.view.zoom;
    ctx.strokeRect(0, gy, F.W * T, F.D * T);
    // Each piece's footprint.
    (this.L.pieces || []).forEach((p, i) => {
      const st = this.app.mod.structures[p.structure];
      if (!st) return;
      const fw = p.rot & 1 ? st.d : st.w;
      const fd = p.rot & 1 ? st.w : st.d;
      const [u0, v0] = toView(p.x | 0, p.z | 0, vox.w, vox.d, this.rot);
      const [u1, v1] = toView((p.x | 0) + fw - 1, (p.z | 0) + fd - 1, vox.w, vox.d, this.rot);
      const ua = Math.min(u0, u1);
      const va = Math.min(v0, v1);
      const on = i === this.selPiece;
      ctx.strokeStyle = on ? '#f0c040' : 'rgba(96,208,255,0.55)';
      ctx.lineWidth = (on ? 2 : 1) / this.view.zoom;
      ctx.setLineDash(on ? [] : [3 / this.view.zoom, 2 / this.view.zoom]);
      ctx.strokeRect(ua * T, gy + va * T, (Math.abs(u1 - u0) + 1) * T, (Math.abs(v1 - v0) + 1) * T);
      ctx.setLineDash([]);
    });
    if (this.hover && this.mode === 'path') {
      const [u, v] = toView(this.hover.x, this.hover.z, vox.w, vox.d, this.rot);
      ctx.strokeStyle = '#f0c040';
      ctx.strokeRect(u * T, gy + v * T, T, T);
    }
  }

  cellAt(p, clamp = false) {
    return pickCell(this.vox, p.wx, p.wy, this.vox.ground, this.rot, clamp);
  }

  pieceAt(c) {
    const ps = this.L.pieces || [];
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      const st = this.app.mod.structures[p.structure];
      if (!st) continue;
      const fw = p.rot & 1 ? st.d : st.w;
      const fd = p.rot & 1 ? st.w : st.d;
      if (c.x >= p.x && c.x < p.x + fw && c.z >= p.z && c.z < p.z + fd) return i;
    }
    return null;
  }

  bind() {
    const cv = this.view.cv;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const p = this.view.toWorld(e);
      if (e.button === 1 || this.space || this.mode === 'hand') {
        this.panning = { x: p.mx, y: p.my, px: this.view.pan.x, py: this.view.pan.y };
        return;
      }
      const c = this.cellAt(p);
      if (!c) return;
      if (this.mode === 'move') {
        const i = this.pieceAt(c);
        this.selPiece = i;
        this.drawPieces();
        this.dirty = true;
        if (i !== null) this.drag = { i, from: c, x: this.L.pieces[i].x, z: this.L.pieces[i].z, moved: false };
        return;
      }
      if (this.mode === 'path') {
        this.app.checkpoint('layouts', this.id);
        this.painting = { erase: e.button === 2 };
        this.paintPath(c, this.painting.erase);
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.view.toWorld(e);
      if (this.panning) {
        this.view.pan.x = this.panning.px + p.mx - this.panning.x;
        this.view.pan.y = this.panning.py + p.my - this.panning.y;
        this.dirty = true;
        return;
      }
      const c = this.cellAt(p, !!this.drag);
      this.hover = c;
      if (c) this.hud.textContent = `x ${c.x} · z ${c.z}${this.pieceAt(c) !== null ? ` · ${this.app.mod.structures[this.L.pieces[this.pieceAt(c)].structure]?.name}` : ''}`;
      if (this.drag && c) {
        const P = this.L.pieces[this.drag.i];
        const nx = Math.max(0, this.drag.x + c.x - this.drag.from.x);
        const nz = Math.max(0, this.drag.z + c.z - this.drag.from.z);
        if (nx !== P.x || nz !== P.z) {
          if (!this.drag.moved) this.app.checkpoint('layouts', this.id);
          this.drag.moved = true;
          P.x = nx;
          P.z = nz;
        }
      }
      if (this.painting && c) this.paintPath(c, this.painting.erase);
      this.dirty = true;
    });
    const up = () => {
      if (this.panning) this.panning = null;
      if (this.drag) {
        if (this.drag.moved) {
          this.app.touch('layouts', this.id);
          this.drawPieces();
        }
        this.drag = null;
      }
      if (this.painting) {
        this.painting = null;
        this.app.touch('layouts', this.id);
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }

  paintPath(c, erase) {
    const L = this.L;
    for (const p of L.paths) p.cells = (p.cells || []).filter(([x, z]) => x !== c.x || z !== c.z);
    if (!erase) {
      let g = L.paths.find((p) => p.block === this.pathBlock);
      if (!g) L.paths.push((g = { block: this.pathBlock, cells: [] }));
      g.cells.push([c.x, c.z]);
    }
    L.paths = L.paths.filter((p) => p.cells.length);
    this.dirty = true;
  }

  addPiece(sid, e) {
    const st = this.app.mod.structures[sid];
    if (!st) return;
    let x = Math.floor((this.L.size - st.w) / 2);
    let z = Math.floor((this.L.size - st.d) / 2);
    if (e && this.vox) {
      const c = this.cellAt(this.view.toWorld(e), true);
      if (c) {
        x = Math.max(0, c.x - Math.floor(st.w / 2));
        z = Math.max(0, c.z - Math.floor(st.d / 2));
      }
    }
    this.change((L) => L.pieces.push({ structure: sid, x, z, rot: 0 }));
    this.selPiece = this.L.pieces.length - 1;
    this.drawPieces();
  }

  turnPiece(i) {
    this.change((L) => {
      const p = L.pieces[i];
      const st = this.app.mod.structures[p.structure];
      // (Turned about its middle.)
      const fw = p.rot & 1 ? st.d : st.w;
      const fd = p.rot & 1 ? st.w : st.d;
      const cx = p.x + fw / 2;
      const cz = p.z + fd / 2;
      p.rot = ((p.rot | 0) + 1) & 3;
      p.x = Math.max(0, Math.round(cx - fd / 2));
      p.z = Math.max(0, Math.round(cz - fw / 2));
    });
  }

  removePiece(i) {
    this.change((L) => L.pieces.splice(i, 1));
    this.selPiece = null;
    this.drawPieces();
  }

  drawPieces() {
    if (!this.piecesPanel) return;
    const app = this.app;
    const body = this.piecesPanel.body;
    clear(body);
    const list = h('div', { class: 'list' });
    (this.L.pieces || []).forEach((p, i) => {
      const st = app.mod.structures[p.structure];
      const li = h('div', { class: `li${i === this.selPiece ? ' on' : ''}` }, h('span', { style: { width: '24px', display: 'grid', placeItems: 'center' } }, st ? app.thumb('structures', p.structure) : ic('warn')), h('span', { style: { flex: 1 } }, st ? st.name : '(deleted)'), h('span', { class: 'note' }, `${p.x},${p.z}`));
      li.addEventListener('click', () => {
        this.selPiece = i;
        this.drawPieces();
        this.dirty = true;
      });
      list.append(li);
    });
    if (!(this.L.pieces || []).length) list.append(h('div', { class: 'note' }, 'No pieces yet: drag structures here from the explorer.'));
    body.append(list);
    const p = this.selPiece !== null ? this.L.pieces[this.selPiece] : null;
    if (p) {
      body.append(h('div', { class: 'hr' }),
        field('Structure', refPicker(app, 'structure', p.structure, (v) => v && this.change((L) => (L.pieces[this.selPiece].structure = v)))),
        h('div', { class: 'row' }, field('x', numberInput({ value: p.x, min: 0, max: this.L.size - 1, int: true, onChange: (v) => this.change((L) => (L.pieces[this.selPiece].x = v)) })), field('z', numberInput({ value: p.z, min: 0, max: this.L.size - 1, int: true, onChange: (v) => this.change((L) => (L.pieces[this.selPiece].z = v)) }))),
        h('div', { class: 'row', style: { gap: '4px' } }, button('Turn', { small: true, icon: 'rotate', key: 'R', onClick: () => this.turnPiece(this.selPiece) }), button('Open it', { small: true, icon: 'next', onClick: () => app.open('structures', p.structure) }), button('Remove', { small: true, icon: 'trash', kind: 'ghost', onClick: () => this.removePiece(this.selPiece) })));
    }
  }

  drawPaths() {
    const body = this.pathsPanel.body;
    clear(body);
    const strip = h('div', { class: 'palette-strip' });
    for (const r of PATHS) {
      const b = h('div', { class: `blockbtn${r === this.pathBlock ? ' on' : ''}`, 'data-tip': r.replace(/_/g, ' ') }, blockIcon(this.app, r, 32));
      b.addEventListener('click', () => {
        this.pathBlock = r;
        this.setMode('path');
        this.drawPaths();
      });
      strip.append(b);
    }
    body.append(h('div', { class: 'note', style: { marginBottom: '6px' } }, 'Paint paths on the ground with (B):'), strip, h('div', { class: 'row', style: { marginTop: '6px' } }, button('Clear all paths', { small: true, kind: 'ghost', icon: 'trash', onClick: () => this.change((L) => (L.paths = [])) })));
  }

  drawLayout() {
    const body = this.layoutPanel.body;
    clear(body);
    const L = this.L;
    body.append(field('Size', slider({ value: L.size, min: 16, max: 96, int: true, onChange: (v) => {
      this.change((x) => (x.size = v));
      this.refit = true;
    } }), { tip: 'How much ground it takes (a square this many blocks across).' }));
    body.append(...placeFields(this.app, 'layouts', this.id, L.place, () => this.drawLayout()));
  }
}

// ============================================================ dungeons
export class DungeonEditor {
  constructor(tool, id) {
    this.tool = tool;
    this.app = tool.app;
    this.id = id;
  }

  get D() {
    return this.app.mod.dungeons[this.id];
  }

  hintText() {
    return 'A way in on the surface, and floors below it: each floor is a structure, built in the Builder. Click one to open it.';
  }

  keyHelp() {
    return [];
  }

  onKey() {
    return false;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.build();
  }

  unmount() {}

  reload() {
    if (this.D) this.build();
  }

  renamed() {
    if (this.nameEl && this.D) this.nameEl.value = this.D.name;
  }

  otherChanged() {
    if (this.D) this.drawStack();
  }

  change(fn, redraw = true) {
    this.app.checkpoint('dungeons', this.id);
    fn(this.D);
    this.app.touch('dungeons', this.id);
    if (redraw) {
      this.drawStack();
      this.drawProblems();
    }
  }

  build() {
    const app = this.app;
    const D = this.D;
    D.floors ||= [];
    D.place ||= { biomes: [], count: 1, isle: 'any' };
    clear(this.stage);
    clear(this.insp);
    const bar = titleBar(app, 'dungeons', this.id, h('span', { class: 'spacer' }), h('span', { class: 'note' }, 'Playtest (F5) takes you straight down into it.'));
    this.nameEl = bar.querySelector('.title input');
    this.stack = h('div', { class: 'dg-stack' });
    this.stage.append(bar, h('div', { class: 'scroll', style: { flex: 1, overflow: 'auto' } }, this.stack));
    this.insp.append(h('div', { class: 'insp-head' }, ic('stairs'), D.name));
    const ib = h('div', { class: 'insp-body scroll' });
    this.probPanel = panel('To look at', h('div'), { key: 'dg-probs' });
    const setP = (k, v) => this.change((x) => {
      if (v === null || v === '') delete x[k];
      else x[k] = v;
    }, false);
    const look = h('div');
    look.append(field('Hardness', slider({ value: D.level ?? 2, min: 1, max: 4, int: true, onChange: (v) => setP('level', v) }), { tip: 'How strong its creatures and traps are (1 easy, 4 deadly). Each floor down is a little harder.' }));
    look.append(field('Rock', blockButton(this.tool, D.rock || 'cave_rock', (v) => setP('rock', v)), { tip: 'What it\'s dug out of (all about the floors).' }));
    look.append(field('Floor', blockButton(this.tool, D.floor || 'stone_bricks', (v) => setP('floor', v)), { tip: 'What it stands on, where a floor\'s blueprint has none.' }));
    look.append(field('Boss', refPicker(app, 'creature', D.boss || null, (v) => setP('boss', v), { create: () => app.newEntity('tpl.boss'), tip: 'Its master, on the last floor (at a boss marker, or as far from the stairs as can be).' })));
    look.append(field('Its story', textInput({ long: true, value: D.lore || '', placeholder: 'Who dug it, and why. (Shown in the journal when it\'s found.)', onChange: (v) => setP('lore', v.slice(0, 400)) }), { wide: true }));
    look.append(field('What they say', textInput({ long: true, value: D.rumour || '', placeholder: 'What folk in town say of it, to point the way.', onChange: (v) => setP('rumour', v.slice(0, 300)) }), { wide: true }));
    ib.append(this.probPanel, panel('Dungeon', look, { key: 'dg-look' }), panel('Where it goes', h('div', null, ...placeFields(app, 'dungeons', this.id, D.place, () => this.build(), { where: false, clear: false })), { key: 'dg-place' }));
    this.insp.append(ib);
    this.drawStack();
    this.drawProblems();
  }

  card(sid, label, o = {}) {
    const app = this.app;
    const st = sid && app.mod.structures[sid];
    const el = h('div', { class: `dg-card${st ? '' : ' none'}` });
    if (!st) {
      el.append(h('div', { class: 'dg-pic' }, ic(o.icon || 'plus', 20)), h('div', { class: 'dg-info' }, h('b', null, label), h('div', { class: 'note' }, o.none || 'None yet.'), h('div', { class: 'row', style: { gap: '4px' } }, ...(o.actions || []))));
      return el;
    }
    const pic = voxPicture(app, structVox(st), 220, 0, o.floor ? { layer: (st.ground ?? 1) + 1, above: 'hide' } : {});
    const marks = st.marks || [];
    const n = (t) => marks.filter((m) => m.type === t).length;
    const facts = [];
    if (o.floor) {
      facts.push(n('up') ? 'way up: placed' : 'way up: made for you');
      if (!o.last) facts.push(n('down') ? 'way down: placed' : 'way down: made for you');
      if (o.last) facts.push(n('boss') ? 'boss: at its marker' : this.D.boss ? 'boss: far from the stairs' : 'no boss');
      facts.push(`${marks.filter((m) => m.type === 'spawn').reduce((s, m) => s + (m.count || 1), 0)} foes`, `${n('chest')} chests`);
    } else facts.push(n('entry') ? 'way in: placed' : 'way in: its middle');
    el.append(h('div', { class: 'dg-pic' }, pic || ic('house', 20)), h('div', { class: 'dg-info' }, h('div', { class: 'note' }, label), h('b', null, st.name), h('div', { class: 'note' }, `${st.w}×${st.d}×${st.h} · ${facts.join(' · ')}`), h('div', { class: 'row', style: { gap: '4px', marginTop: '6px' } }, button('Open', { small: true, icon: 'next', kind: 'primary', onClick: () => app.open('structures', sid) }), ...(o.actions || []))));
    el.querySelector('.dg-pic').addEventListener('click', () => app.open('structures', sid));
    return el;
  }

  drawStack() {
    const app = this.app;
    const D = this.D;
    const el = this.stack;
    clear(el);
    const P = (id) => PRESETS.find((p) => p.id === id);
    const pickStruct = (anchor, fn) => pickRef(app, 'structure', anchor, (v) => v && fn(v));
    // On the surface: the way in.
    const sky = h('div', { class: 'dg-sky' }, h('div', { class: 'dg-label' }, ic('sun'), 'The surface'));
    sky.append(this.card(D.entrance, 'The way in', {
      icon: 'door', none: 'What\'s seen on the surface: a ruin, a hole, a crypt. A "Way in" marker in it is the hole down.',
      actions: D.entrance ? [button('Change', { small: true, onClick: (e) => pickStruct(e.currentTarget, (v) => this.change((x) => (x.entrance = v))) })] : [
        button('Make one', { small: true, kind: 'primary', icon: 'plus', onClick: async () => {
          const id = await app.create('structures', buildPreset(P('entrance'), `${D.name}: way in`), { open: false });
          this.change((x) => (x.entrance = id));
        } }),
        button('Use one I\'ve made', { small: true, onClick: (e) => pickStruct(e.currentTarget, (v) => this.change((x) => (x.entrance = v))) })],
    }));
    el.append(sky);
    const rock = h('div', { class: 'dg-rock' });
    D.floors.forEach((fid, i) => {
      const last = i === D.floors.length - 1;
      rock.append(h('div', { class: 'dg-down' }, ic('down'), i ? 'down the stairs' : 'down the hole'));
      rock.append(this.card(fid, `Floor ${i + 1}${last ? ' (the last)' : ''}`, { floor: true, last, actions: [
        group(button(null, { small: true, icon: 'up', title: 'Move it up', disabled: !i, onClick: () => this.change((x) => x.floors.splice(i - 1, 0, x.floors.splice(i, 1)[0])) }), button(null, { small: true, icon: 'down', title: 'Move it down', disabled: last, onClick: () => this.change((x) => x.floors.splice(i + 1, 0, x.floors.splice(i, 1)[0])) })),
        button(null, { small: true, icon: 'trash', kind: 'ghost', title: 'Take it out of the dungeon (the structure stays)', onClick: () => this.change((x) => x.floors.splice(i, 1)) }),
      ] }));
    });
    const add = h('div', { class: 'row', style: { gap: '6px', justifyContent: 'center', padding: '14px' } },
      button('New floor', { icon: 'plus', kind: 'primary', small: true, onClick: async () => {
        const id = await app.create('structures', buildPreset(P('floor'), `${D.name}: floor ${D.floors.length + 1}`), { open: false });
        this.change((x) => x.floors.push(id));
      } }),
      button('An empty floor', { icon: 'plus', small: true, onClick: async () => {
        const id = await app.create('structures', { name: `${D.name}: floor ${D.floors.length + 1}`, w: 21, d: 15, h: 5, ground: 1, pal: ['keep'], cells: '', metas: '', marks: [], place: { where: 'nowhere', count: 0, biomes: [], isle: 'any' } }, { open: false });
        this.change((x) => x.floors.push(id));
      } }),
      button('A structure I\'ve made', { icon: 'house', small: true, onClick: (e) => pickStruct(e.currentTarget, (v) => this.change((x) => x.floors.push(v))) }));
    if (!D.floors.length) rock.append(h('div', { class: 'dg-down' }, ic('down'), 'down the hole'));
    rock.append(add);
    el.append(rock);
    // The master.
    const boss = h('div', { class: 'dg-boss' }, ic('crown', 14), h('span', null, D.boss ? `${refLabel(app, 'creature', D.boss)} waits at the bottom.` : 'No master at the bottom (choose a boss on the right, or put a boss marker on the last floor).'));
    el.append(boss);
  }

  drawProblems() {
    const app = this.app;
    const D = this.D;
    const body = this.probPanel.body;
    clear(body);
    const out = [];
    const S = app.mod.structures;
    if (!D.entrance || !S[D.entrance]) out.push(['error', 'It has no way in, so it can\'t be found in the world.']);
    else if (!(S[D.entrance].marks || []).some((m) => m.type === 'entry')) out.push(['warn', 'Its way in has no "Way in" marker: the hole down is in its middle.']);
    if (!D.floors.length) out.push(['error', 'It has no floors yet.']);
    D.floors.forEach((f, i) => {
      if (!S[f]) out.push(['error', `Floor ${i + 1} has been deleted.`]);
    });
    const lastF = S[D.floors[D.floors.length - 1]];
    if (lastF && !(lastF.marks || []).some((m) => m.type === 'boss') && !D.boss) out.push(['warn', 'No boss: the last floor has no boss marker, and no boss is chosen.']);
    if ((D.place?.count ?? 1) === 0) out.push(['warn', 'How many is 0: it won\'t be in any world (a graph can\'t place dungeons).']);
    const list = h('div', { class: 'problems' });
    for (const [lv, t] of out) list.append(h('div', { class: `problem ${lv}` }, ic(lv === 'error' ? 'warn' : 'info'), t));
    if (!out.length) list.append(h('div', { class: 'note' }, ic('check'), ' All set. Playtest (F5) to go down into it.'));
    body.append(list);
  }
}
