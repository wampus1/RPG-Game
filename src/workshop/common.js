// What the Workshop's tools share (round 62): palettes, turning a picture
// into palette art, choosing one of the mod's things (or one of the
// game's own) for a field, and the game's own lists.
import { h, ic, clear, menu, dropTarget, canvas, textInput, overlay, raise, onEscape } from './kit.js';
import { DEFAULT_PALETTE, rgbaToHex, hexToRgba, composite } from '../mod/format.js';
import { NODES } from '../mod/graph.js';
import { ITEMS } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';
import { SPECIES } from '../entities/creature.js';
import { itemIcon, creatureSheet } from '../render/sprites.js';
import { BIOMES } from '../world/biomes.js';
import { GAME_BIOMES } from '../mod/biomes.js';
import { drawGlyph } from '../render/font.js';

// ------------------------------------------------------------ palettes
export const PALETTES = {
  Tessera: DEFAULT_PALETTE,
  'PICO-8': ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'],
  'Endesga 32': ['#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633', '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e', '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466', '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'],
  'Sweetie 16': ['#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57'],
  'Ember & Ash': ['#1c1218', '#3a1e20', '#5e2a22', '#8a3a24', '#c0502a', '#ff7a30', '#ffb040', '#ffe070', '#fff4c0', '#2a2428', '#4a4044', '#6a6064', '#9a9094', '#c8c0c0'],
  'Mire & Glow': ['#10161a', '#1e2a2a', '#2e4038', '#3e5a44', '#5a7a52', '#86a06a', '#b8f080', '#e8ffc8', '#2a1e3a', '#4a2e5a', '#7a4a8a', '#c890ff', '#5ad8f0', '#c8fbff'],
  Greyscale: ['#000000', '#1c1c1c', '#383838', '#555555', '#717171', '#8e8e8e', '#aaaaaa', '#c6c6c6', '#e3e3e3', '#ffffff'],
};

// ------------------------------------------------------------ pictures to palettes
// RGBA (w*h*4) made palette art: { palette (hex), idx (Uint8Array, 0
// clear) }, with at most `max` colours (the commonest kept; the rest the
// nearest of those). `pal`: a palette to keep to instead.
export function quantize(rgba, w, h2, max = 255, pal = null) {
  const n = w * h2;
  const idx = new Uint8Array(n);
  const counts = new Map();
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] < 110) continue;
    const k = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let colors;
  if (pal) colors = pal.map((hx) => {
    const c = hexToRgba(hx);
    return (c[0] << 16) | (c[1] << 8) | c[2];
  });
  else if (counts.size <= max) colors = [...counts.keys()];
  else colors = medianCut([...counts], max);
  const near = new Map();
  const find = (k) => {
    if (near.has(k)) return near.get(k);
    let best = 0;
    let bd = Infinity;
    const r = k >> 16;
    const g = (k >> 8) & 255;
    const b = k & 255;
    for (let i = 0; i < colors.length; i++) {
      const c = colors[i];
      const d = ((c >> 16) - r) ** 2 * 0.3 + (((c >> 8) & 255) - g) ** 2 * 0.59 + ((c & 255) - b) ** 2 * 0.11;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    near.set(k, best + 1);
    return best + 1;
  };
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] < 110) continue;
    idx[i] = find((rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]);
  }
  const palette = pal ? pal.slice() : colors.map((c) => rgbaToHex(c >> 16, (c >> 8) & 255, c & 255));
  return { palette, idx };
}

function medianCut(entries, max) {
  let boxes = [entries];
  while (boxes.length < max) {
    let bi = -1;
    let range = -1;
    let ch = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const [k] of b) {
          const v = (k >> (16 - c * 8)) & 255;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        if (hi - lo > range) {
          range = hi - lo;
          bi = i;
          ch = c;
        }
      }
    });
    if (bi < 0) break;
    const b = boxes[bi].sort((p, q) => ((p[0] >> (16 - ch * 8)) & 255) - ((q[0] >> (16 - ch * 8)) & 255));
    const half = Math.floor(b.length / 2);
    boxes.splice(bi, 1, b.slice(0, half), b.slice(half));
  }
  return boxes.map((b) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    let t = 0;
    for (const [k, n] of b) {
      r += (k >> 16) * n;
      g += ((k >> 8) & 255) * n;
      bl += (k & 255) * n;
      t += n;
    }
    return (Math.round(r / t) << 16) | (Math.round(g / t) << 8) | Math.round(bl / t);
  });
}

// ------------------------------------------------------------ the game's own
export function vanillaItems() {
  return Object.keys(ITEMS).filter((k) => !k.includes('~') && !k.includes('*') && !k.includes('+') && !k.startsWith('m:') && ITEMS[k].kind !== 'note');
}
// (Round 65) What kind of thing a game item is, for lists: see itemgroups.js.
export { ITEM_GROUPS, itemGroup } from './itemgroups.js';
import { ITEM_GROUPS, itemGroup } from './itemgroups.js';
export function vanillaBlocks() {
  return BLOCKS.filter((b) => b && !b.mod && b.name !== 'air' && !b.name.startsWith('m:')).map((b) => b.name);
}
export function vanillaCreatures() {
  return Object.keys(SPECIES).filter((k) => !k.startsWith('m:'));
}
export function itemName(k) {
  return (ITEMS[k] && ITEMS[k].name) || k.replace(/_/g, ' ');
}
export function blockName(k) {
  const b = BLOCKS.find((q) => q && q.name === k);
  return b ? b.label : k;
}
export function creatureName(k) {
  return (SPECIES[k] && SPECIES[k].name) || k;
}
export function biomeName(k) {
  return (BIOMES[k] && BIOMES[k].name) || k;
}
// (Round 63) The biomes a field can name: the game's, then this mod's own
// ('@id'), as [value, label] pairs.
export function biomeOptions(app, o = {}) {
  const out = (o.all ? Object.keys(BIOMES).filter((k) => !k.startsWith('m:')) : GAME_BIOMES).map((k) => [k, BIOMES[k].name]);
  for (const b of Object.values((app && app.mod && app.mod.biomes) || {})) if (!b.change) out.push([`@${b.id}`, b.title || b.name]);
  return out;
}
// A biome's square on the world map (its letter in its colours).
export function glyphCanvas(ch, fg, bg, k = 2) {
  const c = canvas(6 * k, 8 * k);
  const x = c.getContext('2d');
  x.fillStyle = bg || '#000';
  x.fillRect(0, 0, c.width, c.height);
  drawGlyph(x, ch || '?', 0, 0, fg || '#fff', k);
  return c;
}
// A small picture of one of the game's own items, blocks or creatures.
export function vanillaIcon(type, k) {
  try {
    if (type === 'biome') {
      const g = BIOMES[k];
      return g ? glyphCanvas(g.char, g.fg, g.bg, 2) : null;
    }
    if (type === 'creature') {
      const sh = creatureSheet(k, 0);
      const s = sh.height;
      const c = canvas(s, s);
      c.getContext('2d').drawImage(sh, 0, 0, s, s, 0, 0, s, s);
      return c;
    }
    const key = type === 'block' ? k : k;
    if (!ITEMS[key]) return null;
    const src = itemIcon(key);
    const c = canvas(16, 16);
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ choosing a thing
// What collection of the mod each kind of reference is in, and which of the
// game's own it can be.
const REF = {
  asset: { coll: 'assets', name: 'art' }, vfx: { coll: 'vfx', name: 'effect' }, rig: { coll: 'rigs', name: 'rig' }, loot: { coll: 'loot', name: 'loot table' },
  structure: { coll: 'structures', name: 'structure' }, story: { coll: 'stories', name: 'story' },
  effect: { coll: 'entities', name: 'effect', tpl: ['tpl.effect'] },
  item: { coll: 'entities', name: 'item', tpl: ['tpl.food', 'tpl.weapon', 'tpl.tool', 'tpl.armor', 'tpl.material', 'tpl.block'], vanilla: 'item', at: true },
  block: { coll: 'entities', name: 'block', tpl: ['tpl.block'], vanilla: 'block', at: true },
  creature: { coll: 'entities', name: 'creature', tpl: ['tpl.animal', 'tpl.hostile', 'tpl.npc', 'tpl.boss'], vanilla: 'creature', at: true },
  projectile: { coll: 'entities', name: 'projectile', tpl: ['tpl.projectile'] },
  world: { coll: 'worlds', name: 'world map' },
  song: { coll: 'songs', name: 'song' },
  clip: { coll: 'sounds', name: 'sound' },
  biome: { coll: 'biomes', name: 'biome', vanilla: 'biome', at: true, mine: (b) => !b.change },
  any: { coll: null, name: 'thing' },
};
export const refInfo = (t) => REF[t] || REF.any;
const rootOf = (e) => (e && e.graph && e.graph.nodes || []).find((n) => NODES[n.type] && NODES[n.type].root) || null;

// The things of the mod a reference of type `t` could be: [{ value, name,
// thumb() }].
export function refOptions(app, t) {
  const R = refInfo(t);
  const out = [];
  if (!R.coll) return out;
  for (const [id, v] of Object.entries(app.mod[R.coll] || {})) {
    if (R.tpl) {
      const r = rootOf(v);
      if (!r || !R.tpl.includes(r.type)) continue;
    }
    if (R.mine && !R.mine(v)) continue;
    out.push({ value: R.at ? `@${id}` : id, name: v.name, mine: true, thumb: () => app.thumb(R.coll, id) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
export function refLabel(app, t, v) {
  if (!v) return null;
  const R = refInfo(t);
  if (R.at && typeof v === 'string' && v[0] === '@') {
    const e = app.mod[R.coll || 'entities'][v.slice(1)];
    return e ? e.title || e.name : `${v} (deleted)`;
  }
  if (R.vanilla) return R.vanilla === 'item' ? itemName(v) : R.vanilla === 'block' ? blockName(v) : R.vanilla === 'biome' ? biomeName(v) : creatureName(v);
  const x = R.coll && app.mod[R.coll] ? app.mod[R.coll][v] : null;
  return x ? x.name : `${v} (deleted)`;
}
export function refThumb(app, t, v) {
  if (!v) return null;
  const R = refInfo(t);
  if (R.at && typeof v === 'string' && v[0] === '@') return app.mod[R.coll || 'entities'][v.slice(1)] ? app.thumb(R.coll || 'entities', v.slice(1)) : ic('warn');
  if (R.vanilla) return vanillaIcon(R.vanilla, v);
  return R.coll && app.mod[R.coll] && app.mod[R.coll][v] ? app.thumb(R.coll, v) : ic('warn');
}

// A field holding one of the mod's things (or the game's own): shows it,
// takes it dropped from the explorer, and on a click offers a list.
export function refPicker(app, t, value, onChange, o = {}) {
  const el = h('div', { class: 'ref', 'data-tip': o.tip || `Drag ${refInfo(t).name === 'art' ? 'art' : `a ${refInfo(t).name}`} here, or click to choose` });
  let v = value;
  const draw = () => {
    clear(el);
    const th = refThumb(app, t, v);
    el.append(h('span', { class: 'thumb' }, th || ic(t === 'asset' ? 'pencil' : t === 'creature' ? 'skull' : t === 'item' ? 'sword' : t === 'block' ? 'cube' : 'link')));
    el.append(h('span', { class: `nm${v ? '' : ' none'}` }, v ? refLabel(app, t, v) : o.none || 'none'));
    if (v && o.open !== false && refInfo(t).coll) {
      const R = refInfo(t);
      const id = R.at && v[0] === '@' ? v.slice(1) : v;
      if (app.mod[R.coll] && app.mod[R.coll][id]) {
        const go = h('span', { class: 'x', 'data-tip': 'Open it' }, ic('next', 9));
        go.addEventListener('click', (e) => {
          e.stopPropagation();
          app.open(R.coll, id);
        });
        el.append(go);
      }
    }
    if (v) {
      const x = h('span', { class: 'x', 'data-tip': 'Clear' }, ic('close', 9));
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        v = null;
        draw();
        onChange(null);
      });
      el.append(x);
    }
  };
  draw();
  el.addEventListener('click', () => pickRef(app, t, el, (nv) => {
    v = nv;
    draw();
    onChange(nv);
  }, o));
  const R = refInfo(t);
  dropTarget(el, (p) => p.kind === R.coll && (!R.tpl || R.tpl.includes(p.tpl)), (p) => {
    v = R.at ? `@${p.id}` : p.id;
    draw();
    onChange(v);
  });
  el.setValue = (nv) => {
    v = nv;
    draw();
  };
  return el;
}

// The list to choose from (the mod's own first, then the game's, with a
// box to search).
export function pickRef(app, t, anchor, onPick, o = {}) {
  const R = refInfo(t);
  const mine = refOptions(app, t);
  let vlist = R.vanilla === 'item' ? vanillaItems() : R.vanilla === 'block' ? vanillaBlocks() : R.vanilla === 'biome' ? GAME_BIOMES : vanillaCreatures();
  // (Round 65: items not blocks, when that's what's wanted.)
  if (R.vanilla === 'item' && o.noBlocks) vlist = vlist.filter((k) => ITEMS[k].kind !== 'block');
  const game = R.vanilla ? vlist.map((k) => ({ value: k, name: R.vanilla === 'item' ? itemName(k) : R.vanilla === 'block' ? blockName(k) : R.vanilla === 'biome' ? biomeName(k) : creatureName(k), thumb: () => vanillaIcon(R.vanilla, k), group: R.vanilla === 'item' ? itemGroup(k) : null })) : [];
  const r = anchor.getBoundingClientRect();
  const box = raise(h('div', { class: 'menu', style: { width: '280px' } }));
  const q = textInput({ placeholder: `Find ${R.name}...` });
  const list = h('div', { style: { maxHeight: '320px', overflow: 'auto' }, class: 'scroll' });
  const draw = () => {
    clear(list);
    const f = q.value.toLowerCase();
    const add = (head, arr, cap = 120) => {
      const hits = arr.filter((x) => !f || x.name.toLowerCase().includes(f) || String(x.value).includes(f)).slice(0, cap);
      if (!hits.length) return;
      list.append(h('div', { class: 'mh' }, head));
      for (const x of hits) {
        const th = x.thumb ? x.thumb() : null;
        const mi = h('div', { class: 'mi' }, h('span', { class: 'ic', style: { width: '18px' } }, th ? (th.style && (th.style.width = '16px', th.style.height = '16px'), th) : ''), h('span', null, x.name));
        mi.addEventListener('click', () => {
          box.remove();
          off();
          onPick(x.value);
        });
        list.append(mi);
      }
    };
    add('This mod', mine);
    // (Round 65) The game's items by kind, its blocks last: they came first,
    // and filled the list before any item did.
    if (R.vanilla === 'item') for (const g of ITEM_GROUPS) add(`The game's ${g.toLowerCase()}`, game.filter((x) => x.group === g), 400);
    else add('The game\'s own', game);
    if (!mine.length && !game.length) list.append(h('div', { class: 'ex-empty' }, `No ${R.name}s in this mod yet.`));
  };
  q.addEventListener('input', draw);
  box.append(h('div', { style: { padding: '4px' } }, q), list);
  if (o.create) {
    const mk = h('div', { class: 'mi' }, h('span', { class: 'ic' }, ic('plus')), h('span', null, `New ${R.name}...`));
    mk.addEventListener('click', () => {
      box.remove();
      off();
      o.create();
    });
    box.append(h('div', { class: 'sep' }), mk);
  }
  overlay().append(box);
  box.style.left = `${Math.min(r.left, window.innerWidth - 290)}px`;
  box.style.top = `${Math.min(r.bottom + 4, window.innerHeight - 380)}px`;
  draw();
  setTimeout(() => q.focus(), 10);
  const away = (e) => {
    if (!box.contains(e.target)) {
      box.remove();
      off();
    }
  };
  // (Escape: this list closes, not what it's over.)
  const unEsc = onEscape(() => {
    box.remove();
    off();
  });
  const off = () => {
    document.removeEventListener('pointerdown', away, true);
    unEsc();
  };
  setTimeout(() => {
    if (box.isConnected) document.addEventListener('pointerdown', away, true);
  }, 0);
}

// ------------------------------------------------------------ tool chrome
// The bar along the top of a tool: the thing's name (to edit), and more.
export function titleBar(app, kind, id, ...more) {
  const t = app.mod[kind][id];
  const nm = h('input', { value: t.name, spellcheck: 'false', 'data-tip': 'Its name (click to change)' });
  nm.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') nm.blur();
  });
  nm.addEventListener('change', () => {
    const v = nm.value.trim();
    if (!v) {
      nm.value = t.name;
      return;
    }
    app.checkpoint(kind, id);
    t.name = v.slice(0, 48);
    app.touch(kind, id);
    app.drawExplorer();
  });
  return h('div', { class: 'toolbar' }, h('div', { class: 'title' }, nm), ...more);
}

// The picture of a piece of art (a frame of it), at its size.
export function assetImage(a, frame = 0) {
  const c = canvas(a.w, a.h);
  c.getContext('2d').putImageData(new ImageData(composite(a, frame), a.w, a.h), 0, 0);
  return c;
}

// A menu of choices as a button.
export function menuButton(label, items, o = {}) {
  const b = h('button', { class: `btn${o.kind ? ` ${o.kind}` : ''}${o.small ? ' small' : ''}`, type: 'button', 'data-tip': o.title || null }, o.icon ? ic(o.icon) : null, label ? h('span', null, label) : null, ic('next', 8));
  b.addEventListener('click', () => {
    const r = b.getBoundingClientRect();
    menu(typeof items === 'function' ? items() : items, r.left, r.bottom + 4);
  });
  return b;
}
