// Pickers the new tools share (round 63): a block (the mod's own first,
// then the game's in groups, with a box to find one), as a field that
// shows it and takes one dragged from the explorer; and a weighted list
// (blocks, trees, creatures: each with how likely it is, a bar to show its
// share).
import { h, ic, clear, button, numberInput, popover, closePopover, textInput, dropTarget } from './kit.js';
import { blockIcon, modBlocks, blockGroups } from './blockart.js';
import { BLOCKS } from '../world/blocks.js';

export function blockLabel(app, ref) {
  if (!ref) return 'none';
  if (ref[0] === '@') {
    const e = app.mod.entities[ref.slice(1)];
    return e ? e.name : `${ref} (deleted)`;
  }
  const b = BLOCKS.find((q) => q && q.name === ref);
  return b ? b.label || ref : ref;
}

// The list of blocks to choose from, in a pop-up by `anchor`: `onPick(ref)`.
export function pickBlock(app, anchor, value, onPick, o = {}) {
  const box = h('div', { style: { width: '332px' } });
  const q = textInput({ placeholder: 'Find a block...' });
  const tabs = h('div', { class: 'chips', style: { marginTop: '6px' } });
  const grid = h('div', { class: 'palette-strip scroll', style: { maxHeight: '300px', overflow: 'auto', marginTop: '6px' } });
  const groups = { 'This mod': modBlocks(app).map(([r]) => r), ...blockGroups() };
  if (o.only) for (const k of Object.keys(groups)) if (k !== 'This mod' && !o.only.includes(k)) delete groups[k];
  let tab = o.tab && groups[o.tab] ? o.tab : groups['This mod'].length ? 'This mod' : Object.keys(groups).find((k) => groups[k].length);
  const fill = () => {
    clear(tabs);
    for (const k of Object.keys(groups)) {
      if (!groups[k].length) continue;
      const c = h('span', { class: `chip${k === tab && !q.value ? ' on' : ''}` }, k);
      c.addEventListener('click', () => {
        tab = k;
        q.value = '';
        fill();
      });
      tabs.append(c);
    }
    clear(grid);
    const f = q.value.toLowerCase();
    const list = f ? Object.values(groups).flat().filter((r) => r.toLowerCase().includes(f) || blockLabel(app, r).toLowerCase().includes(f)) : groups[tab] || [];
    if (o.none) {
      const b = h('div', { class: `blockbtn${!value ? ' on' : ''}`, 'data-tip': o.none }, ic('close', 14));
      b.addEventListener('click', () => {
        closePopover();
        onPick(null);
      });
      grid.append(b);
    }
    for (const r of list.slice(0, 200)) {
      const b = h('div', { class: `blockbtn${r === value ? ' on' : ''}`, 'data-tip': blockLabel(app, r) }, blockIcon(app, r, 32));
      b.addEventListener('click', () => {
        closePopover();
        onPick(r);
      });
      grid.append(b);
    }
    if (!list.length) grid.append(h('div', { class: 'note' }, 'Nothing by that name.'));
  };
  q.addEventListener('input', fill);
  box.append(q, tabs, grid);
  fill();
  popover(anchor, box);
  setTimeout(() => q.focus(), 10);
}

// A block as a field: its picture and name; click to choose another, or
// drag one of the mod's blocks onto it.
export function blockField(app, value, onChange, o = {}) {
  let v = value;
  const el = h('div', { class: 'ref', 'data-tip': o.tip || 'Click to choose a block (or drag one of your blocks here)' });
  const draw = () => {
    clear(el);
    el.append(h('span', { class: 'thumb' }, v ? blockIcon(app, v, 20) : ic('cube', 12)), h('span', { class: `nm${v ? '' : ' none'}` }, v ? blockLabel(app, v) : o.none || 'none'));
  };
  draw();
  el.addEventListener('click', () => pickBlock(app, el, v, (r) => {
    v = r;
    draw();
    onChange(r);
  }, o));
  dropTarget(el, (p) => p.kind === 'entities' && p.tpl === 'tpl.block', (p) => {
    v = `@${p.id}`;
    draw();
    onChange(v);
  });
  el.setValue = (nv) => {
    v = nv;
    draw();
  };
  return el;
}

// A list of things with weights: [{ ..., w }]. `o.icon(item)` its picture,
// `o.label(item)` its name, `o.edit(item, row)` (optional) a click on its
// name, `o.add(anchor)` the button to add one, `o.onChange(list)`, `o.drop`
// { accept(p), make(p) } (things dragged from the explorer), `o.order`:
// up and down buttons (when the order matters).
export function weightList(items, o) {
  const el = h('div', { class: 'wlist' });
  const draw = () => {
    clear(el);
    const total = items.reduce((s, it) => s + Math.max(0, it.w || 0), 0) || 1;
    items.forEach((it, i) => {
      const nm = h('span', { class: 'nm', 'data-tip': o.tip ? o.tip(it) : null }, o.label(it));
      if (o.edit) {
        nm.style.cursor = 'pointer';
        nm.addEventListener('click', () => o.edit(it, nm, () => {
          o.onChange(items);
          draw();
        }));
      }
      const w = numberInput({ value: it.w ?? 1, min: 0, max: o.max ?? 100, step: 1, int: !o.fine, onChange: (v) => {
        it.w = v;
        o.onChange(items);
        draw();
      } });
      const tools = h('span', { class: 'row', style: { gap: '2px' } });
      if (o.order) {
        tools.append(button(null, { icon: 'up', small: true, kind: 'ghost', title: 'Sooner (it wins where two would be)', disabled: i === 0, onClick: () => {
          [items[i - 1], items[i]] = [items[i], items[i - 1]];
          o.onChange(items);
          draw();
        } }));
      }
      tools.append(button(null, { icon: 'close', small: true, kind: 'ghost', title: 'Take it off the list', onClick: () => {
        items.splice(i, 1);
        o.onChange(items);
        draw();
      } }));
      const row = h('div', { class: 'wrow', style: o.order ? { gridTemplateColumns: '26px 1fr 64px 48px' } : null }, h('span', { class: 'ico' }, o.icon(it) || ic('dot', 8)), nm, w, tools);
      if (o.extra) {
        const x = o.extra(it, () => o.onChange(items));
        if (x) row.append(h('div', { style: { gridColumn: '2 / 5' } }, x));
      }
      if (o.bars !== false) row.append(h('div', { class: 'wbar' }, h('i', { style: { width: `${Math.round((Math.max(0, it.w || 0) / total) * 100)}%` } })));
      el.append(row);
    });
    if (!items.length) el.append(h('div', { class: 'note' }, o.empty || 'Nothing yet.'));
    const add = button(o.addLabel || 'Add', { icon: 'plus', small: true, onClick: (e) => o.add(e.currentTarget, (it) => {
      items.push(it);
      o.onChange(items);
      draw();
    }) });
    el.append(h('div', { class: 'row', style: { marginTop: '2px' } }, add, o.note ? h('span', { class: 'note' }, o.note) : null));
  };
  draw();
  if (o.drop) dropTarget(el, o.drop.accept, (p) => {
    items.push(o.drop.make(p));
    o.onChange(items);
    draw();
  });
  el.redraw = draw;
  return el;
}
