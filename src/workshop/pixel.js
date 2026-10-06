// The Pixel tool (round 62): pixel art for blocks, items, creatures and
// effects. Layers, frames (with tags for walk, idle and so on), onion
// skin, a palette that recolours everything drawn with it, and the tools
// of a paint program made for pixels: pencil (with pixel-perfect lines),
// eraser, line, rectangle, ellipse, fill, picker, rectangle and lasso
// selection, magic wand, move, dither, shading along the palette, colour
// replace, mirror drawing, outlines, flips and turns, and pictures in and
// out as PNG.
import { h, ic, clear, button, group, field, numberInput, slider, check, seg, select, panel, colorPicker, popover, contextMenu, dialog, toast, canvas, download, pickFile, readImage, textInput, rememberColor, menu } from './kit.js';
import { encodeCel, decodeCel, hexToRgba, rgbaToHex, newAsset, LIMITS, freeId } from '../mod/format.js';
import { PALETTES, quantize, titleBar, menuButton, pickRef, vanillaIcon } from './common.js';
import { TEX } from '../render/textures.js';
import { B, BLOCKS } from '../world/blocks.js';
import { drawHumanoid } from '../render/people.js';
import { JOBS, makeLook } from '../entities/npcgen.js';
import { RNG } from '../util/rng.js';

const TOOLS = [
  ['pencil', 'pencil', 'Pencil', 'B'], ['eraser', 'eraser', 'Eraser', 'E'], ['line', 'line', 'Line', 'L'], ['rect', 'rect', 'Rectangle (Shift: filled)', 'U'],
  ['ellipse', 'ellipse', 'Ellipse (Shift: filled)', 'O'], ['bucket', 'bucket', 'Fill', 'G'], ['picker', 'picker', 'Colour picker (or Alt+click)', 'I'], null,
  ['select', 'select', 'Select a rectangle', 'M'], ['lasso', 'lasso', 'Lasso select', 'Q'], ['wand', 'wand', 'Magic wand (same colour, touching)', 'W'], ['move', 'move', 'Move (the selection, or the layer)', 'V'], null,
  ['dither', 'dither', 'Dither brush', 'D'], ['shade', 'shade', 'Shade: lighter (right: darker) along the palette', 'K'], ['replace', 'replace', 'Replace a colour everywhere', 'R'], ['hand', 'hand', 'Pan (or hold Space, or the middle button)', 'H'],
];
const KEYS = { KeyB: 'pencil', KeyE: 'eraser', KeyL: 'line', KeyU: 'rect', KeyO: 'ellipse', KeyG: 'bucket', KeyI: 'picker', KeyM: 'select', KeyQ: 'lasso', KeyW: 'wand', KeyV: 'move', KeyD: 'dither', KeyK: 'shade', KeyR: 'replace', KeyH: 'hand' };
const SIZES = [
  ['Block texture', 16, 16, 'block', 1, 'The top of a block (its side is made from it, or draw one 16×12).'],
  ['Block side', 16, 12, 'block', 1, 'The front face of a cube block.'],
  ['Item icon', 16, 16, 'icon', 1, 'What an item looks like in your pack and in your hand.'],
  ['Creature', 16, 16, 'creature', 2, 'Facing right; frame 2 is a step (tagged "walk").'],
  ['Big creature / boss', 32, 32, 'creature', 4, 'A great beast or a master, four frames of walking.'],
  ['Person (NPC)', 16, 30, 'person', 3, 'Someone to talk to, as tall as the game\'s people (room above for a hat); frames 2 and 3 are steps.'],
  ['Tall prop', 16, 32, 'prop', 1, 'Something that stands two blocks tall.'],
  ['Effect sprite', 16, 16, 'fx', 6, 'A few frames of fire, sparkle or smoke for the VFX tool.'],
  ['Portrait', 32, 32, 'sprite', 1, 'A face, a sign, a picture.'],
];
let clipboard = null;

export default class PixelTool {
  constructor(app) {
    this.app = app;
    this.tool = 'pencil';
    this.opts = { size: 1, round: false, perfect: true, filled: false, mirrorX: false, mirrorY: false, global: false, dither: 'checker', onion: false, tile: false, grid: true, tileGrid: 0, allFrames: false };
    // (A colour that shows on the dark checks, to begin with.)
    this.fg = 24;
    this.bg = 0;
    // (Round 63) A colour picked that isn't in the palette yet: it goes in
    // when it's drawn with, not before (picking one, you pass many).
    this.pend = { fg: null, bg: null };
    this.zoom = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.cels = new Map();
    this.dirtyCels = new Set();
    this.sel = null;
    this.float = null;
    this.playing = false;
    this.previewAs = 'sprite';
  }

  // ------------------------------------------------------------ mounting
  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.raf = null;
    this.onResize = () => this.fit(false);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('ws-resize', this.onResize);
    this.keyUp = (e) => {
      if (e.code === 'Space') this.spaceDown = false;
    };
    window.addEventListener('keyup', this.keyUp);
    if (this.id && this.app.mod.assets[this.id]) this.open('assets', this.id);
  }

  unmount() {
    this.flush();
    this.stopPlay();
    window.cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('ws-resize', this.onResize);
    window.removeEventListener('keyup', this.keyUp);
  }

  current() {
    return this.a ? { kind: 'assets', id: this.id } : null;
  }

  hintText() {
    if (!this.a) return 'Pick some art in the explorer, or make new art.';
    return {
      pencil: 'Left: draw. Right: draw in the second colour. Alt+click: pick a colour. [ ] brush size.',
      eraser: 'Clears pixels. [ ] eraser size.',
      line: 'Drag a line. Shift: at 45°.',
      rect: 'Drag a rectangle. Shift: filled.',
      ellipse: 'Drag an ellipse. Shift: filled.',
      bucket: 'Fill touching pixels of one colour (or every pixel of it, with "All of it").',
      picker: 'Click to take a colour (right: as the second colour).',
      select: 'Drag to select. Shift: add, Alt: take away. Ctrl+C/X/V copy, cut, paste. Delete clears.',
      lasso: 'Draw round what to select. Shift: add, Alt: take away.',
      wand: 'Click a colour to select all of it that touches. Shift: add, Alt: take away.',
      move: 'Drag the selection (or the whole layer). Enter or a click outside drops it.',
      dither: 'Draws every other pixel, for shading and texture.',
      shade: 'Left: one step lighter along the palette. Right: one step darker.',
      replace: 'Click a colour: every pixel of it (in this layer) becomes the first colour.',
      hand: 'Drag to look about. The wheel zooms.',
    }[this.tool];
  }

  keyHelp() {
    return [['B E L U O G I', 'Pencil, eraser, line, rectangle, ellipse, fill, picker'], ['M Q W V', 'Select, lasso, wand, move'], ['D K R H', 'Dither, shade, replace, pan'], ['X', 'Swap the two colours'], ['[ ]', 'Smaller / bigger brush'], ['+ − 0', 'Zoom in, out, to fit'], [', .', 'Previous / next frame'], ['Enter', 'Play the animation'], ['N / Shift+N', 'New frame (a copy / empty)'], ['Ctrl+A / Ctrl+D', 'Select all / none'], ['Ctrl+C X V', 'Copy, cut, paste'], ['Delete', 'Clear the selection'], ['Shift+H / Shift+V', 'Flip across / up and down'], ['Shift+R', 'Turn a quarter']];
  }

  // ------------------------------------------------------------ opening
  open(kind, id) {
    this.flush();
    this.stopPlay();
    if (!id || !this.app.mod.assets[id]) return this.empty();
    if (this.id !== id) {
      this.undoStack = [];
      this.redoStack = [];
      this.cels.clear();
      this.sel = null;
      this.float = null;
      this.frame = 0;
      this.zoom = 0;
    }
    this.id = id;
    this.a = this.app.mod.assets[id];
    this.frame = Math.min(this.frame || 0, this.a.frames.length - 1);
    if (!this.a.layers.some((l) => l.id === this.layer)) this.layer = this.a.layers[this.a.layers.length - 1].id;
    if (this.fg > this.a.palette.length) this.fg = Math.min(this.a.palette.length, 1);
    if (this.bg > this.a.palette.length) this.bg = 0;
    this.build();
    this.fit(true);
  }

  reload() {
    this.cels.clear();
    if (this.id) this.open('assets', this.id);
  }

  removed(kind, id) {
    if (kind === 'assets' && id === this.id) {
      this.a = null;
      this.id = null;
      this.empty();
    }
  }

  renamed() {
    if (this.a && this.nameEl) this.nameEl.value = this.a.name;
  }

  empty() {
    this.a = null;
    clear(this.stage);
    clear(this.insp);
    const list = Object.values(this.app.mod.assets);
    const box = h('div', { class: 'empty-stage' }, h('div', null,
      h('div', { class: 'big' }, list.length ? 'Pick some art in the explorer' : 'No art yet'),
      h('div', { class: 'note', style: { marginBottom: '14px' } }, 'Pixel art for blocks, items, creatures and effects. Draw it here, then right-click it in the explorer to make a block, an item or a creature from it.'),
      button('New art...', { icon: 'plus', kind: 'primary', onClick: () => this.newDialog() })));
    this.stage.append(box);
    this.insp.append(h('div', { class: 'insp-head' }, ic('pencil'), 'Pixel'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open.')));
  }

  // A new piece of art (asked what size, and what to start from).
  async newDialog(o = {}) {
    const app = this.app;
    if (o.quiet) return this.makeAsset(o);
    let pick = 0;
    let W = o.w || 16;
    let H = o.h || 16;
    let from = null;
    const name = textInput({ value: o.name || 'Sprite', max: 48 });
    const wIn = numberInput({ value: W, min: 1, max: LIMITS.assetSide, int: true, onChange: (v) => (W = v) });
    const hIn = numberInput({ value: H, min: 1, max: LIMITS.assetSide, int: true, onChange: (v) => (H = v) });
    const sizes = h('div', { class: 'cards', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' } });
    SIZES.forEach(([nm, w, hh, , fr, d], i) => {
      const c = h('div', { class: `card${i === pick ? ' on' : ''}`, style: { minHeight: '64px', padding: '10px' } }, h('div', { class: 't' }, nm, h('span', { class: 'badge' }, `${w}×${hh}${fr > 1 ? ` · ${fr}f` : ''}`)), h('div', { class: 'd' }, d));
      c.addEventListener('click', () => {
        pick = i;
        W = w;
        H = hh;
        wIn.setValue(w);
        hIn.setValue(hh);
        for (const q of sizes.children) q.style.borderColor = '';
        c.style.borderColor = 'var(--gold)';
        if (name.value === 'Sprite' || SIZES.some((s) => s[0] === name.value)) name.value = nm;
      });
      if (i === pick) c.style.borderColor = 'var(--gold)';
      sizes.append(c);
    });
    const fromEl = h('div', { class: 'row' });
    const drawFrom = () => {
      clear(fromEl);
      fromEl.append(h('span', { class: 'note' }, from ? `From ${from.label}` : 'Blank'));
      for (const [t, label] of [['item', 'A game item'], ['block', 'A game block'], ['creature', 'A game creature']]) {
        const b = button(label, { small: true, icon: t === 'item' ? 'sword' : t === 'block' ? 'cube' : 'skull', onClick: () => pickRef(app, t, b, (v) => {
          if (!v) return;
          from = { type: t, key: v, label: v.replace(/_/g, ' ') };
          drawFrom();
        }, { noBlocks: t === 'item' }) });
        fromEl.append(b);
      }
      // (Round 65) One of the game's people, by their work.
      const pb = button('A game person', { small: true, icon: 'person', onClick: () => {
        const r = pb.getBoundingClientRect();
        menu(PERSON_JOBS.map((j) => ({ label: JOBS[j].title, onClick: () => {
          from = { type: 'person', key: j, label: `a ${JOBS[j].title.toLowerCase()}` };
          const pi = SIZES.findIndex((s) => s[3] === 'person');
          if (W !== SIZES[pi][1] || H !== SIZES[pi][2]) sizes.children[pi].click();
          drawFrom();
        } })), r.left, r.bottom + 4);
      } });
      fromEl.append(pb);
      if (from) fromEl.append(button(null, { small: true, icon: 'close', title: 'Blank instead', onClick: () => {
        from = null;
        drawFrom();
      } }));
    };
    drawFrom();
    const v = await dialog({ title: 'New art', icon: 'pencil', wide: true, body: [
      field('Name', name),
      h('div', { class: 'note' }, 'What it\'s for (you can change the size later):'), sizes,
      h('div', { class: 'row' }, field('Width', wIn), field('Height', hIn)),
      field('Start from', fromEl, { tip: 'Begin with a copy of one of the game\'s own pictures, to change.' }),
    ], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Create', kind: 'primary', value: 'ok' }] });
    if (v !== 'ok') return null;
    const s = SIZES[pick];
    return this.makeAsset({ name: name.value || s[0], w: W, h: H, use: s[3], frames: W === s[1] && H === s[2] ? s[4] : 1, from });
  }

  async makeAsset(o) {
    const app = this.app;
    const a = newAsset({ name: o.name || 'Sprite', w: o.w || 16, h: o.h || 16, use: o.use });
    a.id = freeId(app.mod, 'assets', o.name || 'sprite');
    const n = Math.max(1, Math.min(8, o.frames || 1));
    for (let i = 1; i < n; i++) a.frames.push({ dur: 125, cels: { l1: encodeCel(new Uint8Array(a.w * a.h)) } });
    if (o.use === 'creature' && n > 1) a.tags.push({ name: 'walk', from: 0, to: n - 1, color: '#80e070' });
    if (o.from && o.from.type === 'person') {
      // (Each frame its own: standing, then a step each way.)
      let pal = null;
      a.frames.forEach((f, i) => {
        const src = gamePicture('person', o.from.key, i);
        const c = canvas(a.w, a.h);
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(src, Math.floor((a.w - src.width) / 2), a.h - src.height);
        // (The first frame's colours for them all, so they index alike.)
        const q = quantize(x.getImageData(0, 0, a.w, a.h).data, a.w, a.h, 64, pal);
        if (!pal) {
          pal = q.palette;
          a.palette = [...q.palette, ...a.palette.filter((p) => !q.palette.includes(p))].slice(0, LIMITS.palette);
        }
        f.cels.l1 = encodeCel(q.idx);
      });
      if (n > 1 && !a.tags.some((t) => t.name === 'walk')) a.tags.push({ name: 'walk', from: 0, to: n - 1, color: '#80e070' });
    } else if (o.from) {
      const src = gamePicture(o.from.type, o.from.key);
      if (src) {
        const c = canvas(a.w, a.h);
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        const k = Math.min(a.w / src.width, a.h / src.height);
        const dw = Math.max(1, Math.round(src.width * k));
        const dh = Math.max(1, Math.round(src.height * k));
        x.drawImage(src, Math.floor((a.w - dw) / 2), a.h - dh, dw, dh);
        const q = quantize(x.getImageData(0, 0, a.w, a.h).data, a.w, a.h, 64);
        a.palette = [...q.palette, ...a.palette.filter((p) => !q.palette.includes(p))].slice(0, LIMITS.palette);
        for (const f of a.frames) f.cels.l1 = encodeCel(q.idx);
      }
    }
    app.mod.assets[a.id] = a;
    app.touch('assets', a.id, { quiet: true });
    app.drawExplorer();
    if (!o.quiet || o.open) await app.open('assets', a.id);
    return a.id;
  }

  // ------------------------------------------------------------ cels
  cel(f = this.frame, lid = this.layer) {
    let m = this.cels.get(f);
    if (!m) this.cels.set(f, (m = {}));
    if (!m[lid]) {
      const fr = this.a.frames[f];
      m[lid] = decodeCel(fr && fr.cels ? fr.cels[lid] : null, this.a.w * this.a.h);
    }
    return m[lid];
  }

  setCel(f, lid, data) {
    let m = this.cels.get(f);
    if (!m) this.cels.set(f, (m = {}));
    m[lid] = data;
    this.dirtyCels.add(`${f}:${lid}`);
  }

  // Changes written back into the art (packed).
  flush() {
    if (!this.a || !this.dirtyCels.size) return;
    for (const k of this.dirtyCels) {
      const [f, lid] = k.split(':');
      const fr = this.a.frames[+f];
      const m = this.cels.get(+f);
      if (fr && m && m[lid]) fr.cels[lid] = encodeCel(m[lid]);
    }
    this.dirtyCels.clear();
  }

  changed(thumb = true) {
    this.flush();
    this.app.touch('assets', this.id);
    if (thumb) this.drawFrames(true);
    this.drawLayers();
    this.drawPreview();
  }

  // ------------------------------------------------------------ undo
  push(entry) {
    this.undoStack.push(entry);
    if (this.undoStack.length > 120) this.undoStack.shift();
    this.redoStack = [];
  }

  snapshot() {
    this.flush();
    return JSON.stringify(this.a);
  }

  // A change to the art as a whole (frames, layers, palette, size).
  structural(fn) {
    const before = this.snapshot();
    fn();
    this.flush();
    const after = JSON.stringify(this.a);
    if (before !== after) this.push({ type: 'all', before, after });
  }

  applyAll(json) {
    const v = JSON.parse(json);
    for (const k of Object.keys(this.a)) delete this.a[k];
    Object.assign(this.a, v);
    this.cels.clear();
    this.dirtyCels.clear();
    this.frame = Math.min(this.frame, this.a.frames.length - 1);
    if (!this.a.layers.some((l) => l.id === this.layer)) this.layer = this.a.layers[this.a.layers.length - 1].id;
  }

  undo() {
    if (!this.a) return false;
    this.dropFloat();
    const e = this.undoStack.pop();
    if (!e) return true;
    if (e.type === 'cel') this.setCel(e.f, e.lid, e.before.slice());
    else this.applyAll(e.before);
    this.redoStack.push(e);
    this.afterHistory(e);
    return true;
  }

  redo() {
    if (!this.a) return false;
    const e = this.redoStack.pop();
    if (!e) return true;
    if (e.type === 'cel') this.setCel(e.f, e.lid, e.after.slice());
    else this.applyAll(e.after);
    this.undoStack.push(e);
    this.afterHistory(e);
    return true;
  }

  afterHistory(e) {
    if (e.type === 'all') {
      this.build();
      this.fit(false);
    }
    this.changed();
    this.draw();
  }

  // ------------------------------------------------------------ the screen
  build() {
    const app = this.app;
    const a = this.a;
    clear(this.stage);
    clear(this.insp);
    // Along the top.
    this.zoomLabel = h('span', { class: 'note', style: { minWidth: '44px', textAlign: 'center' } });
    const bar = titleBar(app, 'assets', this.id,
      button(`${a.w}×${a.h}`, { icon: 'rect', small: true, title: 'Change the size (or scale it)', onClick: () => this.resizeDialog() }),
      h('span', { class: 'sep' }),
      group(button(null, { icon: 'minus', small: true, title: 'Zoom out', key: '−', onClick: () => this.zoomBy(-1) }), button(null, { icon: 'zoom', small: true, title: 'Fit to the window', key: '0', onClick: () => this.fit(true) }), button(null, { icon: 'plus', small: true, title: 'Zoom in', key: '+', onClick: () => this.zoomBy(1) })),
      this.zoomLabel,
      h('span', { class: 'sep' }),
      this.toggle('grid', 'grid', 'Pixel grid'),
      this.toggle('mirrorX', 'mirror', 'Mirror drawing left to right'),
      this.toggle('mirrorY', 'flipH', 'Mirror drawing top to bottom'),
      this.toggle('onion', 'onion', 'Onion skin: the frames either side, faintly'),
      this.toggle('tile', 'layers', 'Tile: see it repeated (for seamless blocks)'),
      h('span', { class: 'spacer' }),
      button('Import', { icon: 'import', small: true, title: 'Bring in a PNG (as new art, a layer, or frames)', onClick: () => this.importPng() }),
      menuButton('Export', () => [
        { label: 'This frame (PNG)', onClick: () => this.exportPng(1) },
        { label: 'This frame, 4× (PNG)', onClick: () => this.exportPng(4) },
        { label: 'This frame, 8× (PNG)', onClick: () => this.exportPng(8) },
        { label: 'All frames in a row (PNG)', onClick: () => this.exportSheet(1) },
        { label: 'All frames in a row, 4× (PNG)', onClick: () => this.exportSheet(4) },
      ], { small: true, icon: 'export' }),
      menuButton('Use it', () => (app.actionsFor('assets', this.id).filter((it) => it.head || it.sub || /Make|Animate|Rig|picture/.test(it.label || ''))), { small: true, kind: 'primary', icon: 'star', title: 'Make a block, item, creature, effect or rig from this art' }));
    this.nameEl = bar.querySelector('.title input');
    // The tools down the side.
    const vt = h('div', { class: 'vtools' });
    this.toolBtns = {};
    for (const t of TOOLS) {
      if (!t) {
        vt.append(h('div', { class: 'gap' }));
        continue;
      }
      const [id, icon, tip, key] = t;
      const b = button(null, { icon, title: tip, key, on: this.tool === id, onClick: () => this.setTool(id) });
      this.toolBtns[id] = b;
      vt.append(b);
    }
    // The canvas.
    this.wrap = h('div', { class: 'canvas-wrap' });
    this.cv = h('canvas');
    this.wrap.append(this.cv);
    this.hud = h('div', { class: 'hud' });
    this.hudR = h('div', { class: 'hud r' });
    this.wrap.append(this.hud, this.hudR);
    this.bindCanvas();
    // The frames along the bottom.
    this.tl = h('div', { class: 'timeline' });
    this.stage.append(bar, h('div', { style: { flex: 1, display: 'flex', minHeight: 0 } }, vt, this.wrap), this.tl);
    this.drawTimeline();
    // The inspector.
    this.insp.append(h('div', { class: 'insp-head' }, ic('pencil'), a.name));
    const body = h('div', { class: 'insp-body scroll' });
    this.colorsPanel = panel('Colours', h('div'), { key: 'px-colours' });
    this.optsPanel = panel('Tool', h('div'), { key: 'px-tool' });
    this.layersPanel = panel('Layers', h('div'), { key: 'px-layers', tools: [button(null, { icon: 'plus', small: true, kind: 'ghost', title: 'New layer', onClick: () => this.addLayer() })] });
    this.previewPanel = panel('Preview', h('div'), { key: 'px-preview' });
    body.append(this.colorsPanel, this.optsPanel, this.layersPanel, this.previewPanel);
    this.insp.append(body);
    this.drawColors();
    this.drawOpts();
    this.drawLayers();
    this.drawPreview();
    this.app.hint(this.hintText());
    window.cancelAnimationFrame(this.raf);
    const loop = (t) => {
      this.raf = requestAnimationFrame(loop);
      this.tick(t);
    };
    this.raf = requestAnimationFrame(loop);
  }

  toggle(key, icon, tip) {
    const b = button(null, { icon, small: true, title: tip, on: this.opts[key], onClick: () => {
      this.opts[key] = !this.opts[key];
      b.classList.toggle('on', this.opts[key]);
      this.draw();
    } });
    return b;
  }

  setTool(id) {
    if (this.tool === 'move' && id !== 'move') this.dropFloat();
    this.tool = id;
    for (const [k, b] of Object.entries(this.toolBtns || {})) b.classList.toggle('on', k === id);
    this.drawOpts();
    this.app.hint(this.hintText());
    this.draw();
  }

  // ------------------------------------------------------------ colours
  rgba(i) {
    if (!i) return [0, 0, 0, 0];
    return hexToRgba(this.a.palette[i - 1] || '#ff00ff');
  }

  drawColors() {
    const a = this.a;
    const b = this.colorsPanel.body;
    clear(b);
    const sw = (i) => (i ? a.palette[i - 1] : 'transparent');
    const shown = (w) => this.pend[w] || sw(this[w]);
    const newTip = ' (A new colour: it joins the palette when you draw with it.)';
    const fgEl = h('div', { class: `fg${this.pend.fg ? ' new' : ''}`, style: { background: shown('fg') }, 'data-tip': `First colour (left button). Click to change it.${this.pend.fg ? newTip : ''}` });
    const bgEl = h('div', { class: `bg${this.pend.bg ? ' new' : ''}`, style: { background: shown('bg') }, 'data-tip': `Second colour (right button). Click to change it.${this.pend.bg ? newTip : ''}` });
    this.fgEl = fgEl;
    this.bgEl = bgEl;
    const swap = button(null, { icon: 'replace', small: true, kind: 'ghost', title: 'Swap them', key: 'X', onClick: () => this.swapColors() });
    fgEl.addEventListener('click', () => this.editColor(this.fg, fgEl, 'fg'));
    bgEl.addEventListener('click', () => this.editColor(this.bg, bgEl, 'bg'));
    const hexOf = (w) => (this.pend[w] ? `${this.pend[w]} (new)` : this[w] ? a.palette[this[w] - 1] : 'clear');
    b.append(h('div', { class: 'row', style: { gap: '12px' } }, h('div', { class: 'fgbg' }, fgEl, bgEl), h('div', null, h('div', { class: 'note' }, `1st: ${hexOf('fg')}`), h('div', { class: 'note' }, `2nd: ${hexOf('bg')}`), swap)));
    const grid = h('div', { class: 'palette' });
    const isFg = (i) => !this.pend.fg && this.fg === i;
    const isBg = (i) => !this.pend.bg && this.bg === i;
    const clearSw = h('div', { class: `pc${isFg(0) ? ' on' : ''}${isBg(0) ? ' on2' : ''}`, style: { background: 'repeating-conic-gradient(#333 0 25%, #555 0 50%) 0 0 / 8px 8px' }, 'data-tip': 'Clear (no colour)' });
    clearSw.addEventListener('click', () => this.setColor('fg', 0));
    clearSw.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.setColor('bg', 0);
    });
    grid.append(clearSw);
    a.palette.forEach((c, i) => {
      const idx = i + 1;
      const el = h('div', { class: `pc${isFg(idx) ? ' on' : ''}${isBg(idx) ? ' on2' : ''}`, style: { background: c }, 'data-tip': `${c}  (left: 1st, right: 2nd, double-click: change it everywhere)` });
      el.addEventListener('click', () => this.setColor('fg', idx));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (e.shiftKey || e.ctrlKey) return contextMenu(e, this.colorMenu(idx));
        this.setColor('bg', idx);
      });
      el.addEventListener('dblclick', () => this.editColor(idx, el, 'edit'));
      el.addEventListener('auxclick', (e) => {
        if (e.button === 1) contextMenu(e, this.colorMenu(idx));
      });
      grid.append(el);
    });
    if (a.palette.length < LIMITS.palette) {
      const add = h('div', { class: 'pc add', 'data-tip': 'Add a colour' }, ic('plus', 9));
      add.addEventListener('click', () => {
        this.structural(() => a.palette.push(this.pend.fg || a.palette[Math.max(0, this.fg - 1)] || '#ffffff'));
        this.pend.fg = null;
        this.setColor('fg', a.palette.length);
        this.editColor(a.palette.length, add, 'edit');
      });
      grid.append(add);
    }
    b.append(grid);
    b.append(h('div', { class: 'row' },
      menuButton('Palette', () => [
        { head: 'Use a palette (your colours turned to the nearest)' },
        ...Object.keys(PALETTES).map((k) => ({ label: k, onClick: () => this.loadPalette(PALETTES[k]) })),
        { sep: true },
        { label: 'Sort by brightness', onClick: () => this.sortPalette('light') },
        { label: 'Sort by hue', onClick: () => this.sortPalette('hue') },
        { label: 'Remove colours not used', onClick: () => this.prunePalette() },
        { label: 'Add a ramp (shades of the 1st colour)', onClick: () => this.addRamp() },
      ], { small: true, icon: 'paint' }),
      h('span', { class: 'note' }, `${a.palette.length} colours (Shift+right-click one for more)`)));
  }

  colorMenu(idx) {
    return [
      { label: 'Change it (everywhere it\'s used)', icon: 'paint', onClick: () => this.editColor(idx, this.colorsPanel, 'edit') },
      { label: 'Use as 1st colour', onClick: () => this.setColor('fg', idx) },
      { label: 'Use as 2nd colour', onClick: () => this.setColor('bg', idx) },
      { label: 'Select every pixel of it', icon: 'wand', onClick: () => this.selectColor(idx) },
      { sep: true },
      { label: 'Remove (its pixels go clear)', icon: 'trash', danger: true, onClick: () => this.removeColor(idx) },
    ];
  }

  setColor(which, idx) {
    this[which] = idx;
    this.pend[which] = null;
    this.drawColors();
  }

  swapColors() {
    [this.fg, this.bg] = [this.bg, this.fg];
    [this.pend.fg, this.pend.bg] = [this.pend.bg, this.pend.fg];
    this.drawColors();
  }

  // The colour index `which` ('fg' or 'bg') draws with, now that it's
  // being drawn with: a new colour picked goes into the palette here (or,
  // the palette full, the nearest there is used).
  useColor(which) {
    const hex = this.pend[which];
    if (!hex) return this[which];
    const a = this.a;
    this.pend[which] = null;
    let i = a.palette.findIndex((c) => c.toLowerCase() === hex.toLowerCase());
    if (i < 0) {
      if (a.palette.length >= LIMITS.palette) {
        const want = hexToRgba(hex);
        let bd = Infinity;
        a.palette.forEach((c, j) => {
          const q = hexToRgba(c);
          const d = (q[0] - want[0]) ** 2 + (q[1] - want[1]) ** 2 + (q[2] - want[2]) ** 2;
          if (d < bd) {
            bd = d;
            i = j;
          }
        });
        toast('The palette is full (255 colours): drawing with the nearest in it.', 'bad');
      } else {
        this.structural(() => a.palette.push(hex));
        i = a.palette.length - 1;
      }
    }
    this[which] = i + 1;
    rememberColor(hex);
    this.drawColors();
    return this[which];
  }

  // A colour changed: `mode` 'fg'/'bg' (the colour to draw with: one of
  // the palette's if it's there, or a new one, which goes into the palette
  // only when it's drawn with: see useColor) or 'edit' (that colour
  // itself, everywhere it's used).
  editColor(idx, anchor, mode) {
    const a = this.a;
    const start = mode !== 'edit' && this.pend[mode] ? this.pend[mode] : idx ? a.palette[idx - 1] : '#ffffff';
    let before = null;
    popover(anchor, colorPicker(start, (hex) => {
      const c = hex.slice(0, 7);
      if (mode === 'edit') {
        if (!before) before = this.snapshot();
        a.palette[idx - 1] = c;
        this.draw();
        this.drawPreview();
      } else {
        const i = a.palette.findIndex((q) => q.toLowerCase() === c.toLowerCase());
        if (i >= 0) {
          this[mode] = i + 1;
          this.pend[mode] = null;
        } else this.pend[mode] = c;
        // (Shown as it's picked; the palette's left alone.)
        const el = mode === 'fg' ? this.fgEl : this.bgEl;
        if (el) {
          el.style.background = c;
          el.classList.toggle('new', !!this.pend[mode]);
        }
      }
    }), { onClose: () => {
      if (before) {
        const after = JSON.stringify(this.a);
        if (after !== before) this.push({ type: 'all', before, after });
        rememberColor(a.palette[idx - 1]);
        this.changed();
      }
      this.drawColors();
    } });
  }

  // Every cel turned by `fn(index) -> index`.
  remapAll(fn) {
    const a = this.a;
    for (let f = 0; f < a.frames.length; f++) {
      for (const L of a.layers) {
        const c = this.cel(f, L.id);
        let any = false;
        for (let i = 0; i < c.length; i++) {
          const v = fn(c[i]);
          if (v !== c[i]) {
            c[i] = v;
            any = true;
          }
        }
        if (any) this.dirtyCels.add(`${f}:${L.id}`);
      }
    }
  }

  loadPalette(pal) {
    const a = this.a;
    this.structural(() => {
      const old = a.palette.map(hexToRgba);
      const nw = pal.map(hexToRgba);
      const map = old.map((c) => {
        let best = 0;
        let bd = Infinity;
        nw.forEach((q, i) => {
          const d = (q[0] - c[0]) ** 2 * 0.3 + (q[1] - c[1]) ** 2 * 0.59 + (q[2] - c[2]) ** 2 * 0.11;
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        return best + 1;
      });
      this.remapAll((v) => (v ? map[v - 1] : 0));
      a.palette = pal.slice();
    });
    this.fg = Math.min(this.fg, a.palette.length);
    this.bg = Math.min(this.bg, a.palette.length);
    this.drawColors();
    this.changed();
    this.draw();
  }

  sortPalette(how) {
    const a = this.a;
    this.structural(() => {
      const order = a.palette.map((c, i) => {
        const [r, g, b] = hexToRgba(c);
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        let hue = 0;
        if (mx !== mn) hue = mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
        const light = r * 0.3 + g * 0.59 + b * 0.11;
        return { i, k: how === 'hue' ? (mx - mn < 18 ? -1 : hue) * 1000 + light : light };
      }).sort((p, q) => p.k - q.k);
      const map = new Array(a.palette.length);
      order.forEach((o, ni) => (map[o.i] = ni + 1));
      this.remapAll((v) => (v ? map[v - 1] : 0));
      a.palette = order.map((o) => a.palette[o.i]);
      this.fg = this.fg ? map[this.fg - 1] : 0;
      this.bg = this.bg ? map[this.bg - 1] : 0;
    });
    this.drawColors();
    this.changed();
  }

  prunePalette() {
    const a = this.a;
    const used = new Set();
    for (let f = 0; f < a.frames.length; f++) for (const L of a.layers) for (const v of this.cel(f, L.id)) if (v) used.add(v);
    if (used.size === a.palette.length) return toast('Every colour is used.');
    this.structural(() => {
      const keep = a.palette.map((c, i) => i + 1).filter((i) => used.has(i));
      const map = new Map(keep.map((v, i) => [v, i + 1]));
      this.remapAll((v) => (v ? map.get(v) || 0 : 0));
      a.palette = keep.map((i) => a.palette[i - 1]);
      this.fg = map.get(this.fg) || 1;
      this.bg = map.get(this.bg) || 0;
    });
    this.drawColors();
    this.changed();
    toast(`${used.size} colours kept.`, 'good');
  }

  addRamp() {
    const a = this.a;
    const base = hexToRgba(this.pend.fg || (this.fg ? a.palette[this.fg - 1] : '#888888'));
    const ramp = [0.45, 0.65, 0.82, 1.15, 1.32].map((k) => {
      // (Shadows lean violet, lights lean gold: as the game's own art does.)
      const warm = k > 1 ? (k - 1) * 40 : 0;
      const cool = k < 1 ? (1 - k) * 30 : 0;
      return rgbaToHex(base[0] * k + warm, base[1] * k + warm * 0.7, base[2] * k + cool);
    });
    if (a.palette.length + ramp.length > LIMITS.palette) return toast('No room in the palette for a ramp.', 'bad');
    this.structural(() => a.palette.push(...ramp));
    this.drawColors();
    this.changed();
  }

  removeColor(idx) {
    const a = this.a;
    this.structural(() => {
      this.remapAll((v) => (v === idx ? 0 : v > idx ? v - 1 : v));
      a.palette.splice(idx - 1, 1);
    });
    if (this.fg >= idx) this.fg = Math.max(0, this.fg - 1);
    if (this.bg >= idx) this.bg = Math.max(0, this.bg - 1);
    this.drawColors();
    this.changed();
    this.draw();
  }

  // ------------------------------------------------------------ tool options
  drawOpts() {
    if (!this.optsPanel) return;
    const b = this.optsPanel.body;
    clear(b);
    const t = this.tool;
    const o = this.opts;
    if (['pencil', 'eraser', 'dither', 'shade'].includes(t)) {
      const sz = slider({ value: o.size, min: 1, max: 16, int: true, onChange: (v) => (o.size = v) });
      b.append(field('Size', sz, { scrub: { get: () => o.size, set: (v) => {
        o.size = v;
        sz.setValue(v);
      }, min: 1, max: 16 } }));
      b.append(field('Shape', seg([['square', 'Square'], ['round', 'Round']], o.round ? 'round' : 'square', (v) => (o.round = v === 'round'))));
    }
    if (t === 'pencil') b.append(check('Pixel-perfect lines', o.perfect, (v) => (o.perfect = v), { tip: 'Thin strokes without doubled corners.' }));
    if (t === 'rect' || t === 'ellipse') b.append(check('Filled', o.filled, (v) => (o.filled = v), { tip: 'Or hold Shift as you drag.' }));
    if (t === 'bucket' || t === 'replace') b.append(check('All of it (not just touching)', o.global, (v) => (o.global = v)));
    if (t === 'replace') b.append(check('In every frame', o.allFrames, (v) => (o.allFrames = v)));
    if (t === 'dither') b.append(field('Pattern', seg([['checker', 'Half'], ['sparse', 'Quarter'], ['dense', 'Three-quarters']], o.dither, (v) => (o.dither = v))));
    if (['select', 'lasso', 'wand', 'move'].includes(t)) {
      b.append(h('div', { class: 'row' }, button('All', { small: true, onClick: () => this.selectAll() }), button('None', { small: true, onClick: () => this.selectNone() }), button('Invert', { small: true, onClick: () => this.selectInvert() })));
    }
    b.append(h('div', { class: 'hr' }));
    b.append(h('div', { class: 'note' }, 'For the whole layer (or the selection):'));
    b.append(h('div', { class: 'row', style: { flexWrap: 'wrap' } },
      button('Flip H', { small: true, icon: 'flipH', title: 'Flip it left to right (Shift+H)', onClick: () => this.flip(true) }),
      button('Flip V', { small: true, icon: 'flipV', title: 'Flip it upside down (Shift+V)', onClick: () => this.flip(false) }),
      button('Turn', { small: true, icon: 'rotate', title: 'A quarter turn (Shift+R)', onClick: () => this.rotate() }),
      button('Outline', { small: true, icon: 'outline', title: 'An outline round it, in the 1st colour', onClick: () => this.outline() }),
      button('Shift', { small: true, icon: 'move', title: 'Move every pixel by some amount (wrapping round: for seamless tiles)', onClick: () => this.shiftDialog() })));
  }

  // ------------------------------------------------------------ layers
  drawLayers() {
    if (!this.layersPanel || !this.a) return;
    const b = this.layersPanel.body;
    clear(b);
    const list = h('div', { class: 'layers' });
    const a = this.a;
    [...a.layers].reverse().forEach((L) => {
      const th = canvas(a.w, a.h);
      const d = this.layerRGBA(this.frame, L.id);
      th.getContext('2d').putImageData(new ImageData(d, a.w, a.h), 0, 0);
      const eye = button(null, { icon: L.visible ? 'eye' : 'eyeOff', small: true, kind: 'ghost', title: L.visible ? 'Hide' : 'Show', onClick: (e) => {
        e.stopPropagation();
        this.structural(() => (L.visible = !L.visible));
        this.drawLayers();
        this.draw();
      } });
      const lock = button(null, { icon: 'lock', small: true, kind: 'ghost', on: !!L.locked, title: L.locked ? 'Unlock' : 'Lock (no drawing on it)', onClick: (e) => {
        e.stopPropagation();
        L.locked = !L.locked;
        this.drawLayers();
      } });
      const row = h('div', { class: `layer${L.id === this.layer ? ' on' : ''}` }, th, h('span', { class: 'nm' }, L.name), eye, lock);
      row.addEventListener('click', () => {
        this.layer = L.id;
        this.drawLayers();
      });
      row.addEventListener('dblclick', () => this.renameLayer(L));
      row.addEventListener('contextmenu', (e) => contextMenu(e, [
        { label: 'Rename...', icon: 'pencil', onClick: () => this.renameLayer(L) },
        { label: 'Duplicate', icon: 'copy', onClick: () => this.dupLayer(L) },
        { label: 'Move up', onClick: () => this.moveLayer(L, 1) },
        { label: 'Move down', onClick: () => this.moveLayer(L, -1) },
        { label: 'Merge down', onClick: () => this.mergeDown(L), off: a.layers.indexOf(L) === 0 },
        { sep: true },
        { label: 'Delete', icon: 'trash', danger: true, onClick: () => this.deleteLayer(L), off: a.layers.length < 2 },
      ]));
      list.append(row);
    });
    b.append(list);
    const L = a.layers.find((q) => q.id === this.layer);
    if (L) {
      // (Seen as it's dragged; one step to undo when it's let go.)
      let before = null;
      b.append(field('Opacity', slider({ value: Math.round((L.opacity ?? 1) * 100), min: 0, max: 100, int: true, onInput: (v) => {
        if (!before) {
          this.flush();
          before = this.snapshot();
        }
        L.opacity = v / 100;
        this.draw();
      }, onChange: (v) => {
        if (before) {
          L.opacity = v / 100;
          const after = JSON.stringify(this.a);
          if (after !== before) this.push({ type: 'all', before, after });
          before = null;
        } else this.structural(() => (L.opacity = v / 100));
        this.draw();
        this.changed(false);
      } })));
      b.append(field('Blend', select([['normal', 'Normal'], ['add', 'Glow (add)'], ['multiply', 'Shadow (multiply)']], L.blend || 'normal', (v) => {
        this.structural(() => (L.blend = v));
        this.draw();
        this.changed(false);
      })));
    }
    b.append(h('div', { class: 'row' }, button('New', { small: true, icon: 'plus', onClick: () => this.addLayer() }), button(null, { small: true, icon: 'copy', title: 'Duplicate', onClick: () => this.dupLayer(L) }), button(null, { small: true, icon: 'trash', title: 'Delete', onClick: () => this.deleteLayer(L) }), button('Merge down', { small: true, onClick: () => this.mergeDown(L) })));
  }

  layerRGBA(f, lid) {
    const a = this.a;
    const c = this.cel(f, lid);
    const out = new Uint8ClampedArray(a.w * a.h * 4);
    const pal = a.palette.map(hexToRgba);
    for (let i = 0; i < c.length; i++) {
      const v = c[i];
      if (!v) continue;
      const p = pal[v - 1] || [255, 0, 255, 255];
      out[i * 4] = p[0];
      out[i * 4 + 1] = p[1];
      out[i * 4 + 2] = p[2];
      out[i * 4 + 3] = p[3];
    }
    return out;
  }

  addLayer() {
    const a = this.a;
    if (a.layers.length >= LIMITS.layers) return toast('That\'s as many layers as art can have.', 'bad');
    this.structural(() => {
      let n = a.layers.length + 1;
      while (a.layers.some((l) => l.id === `l${n}`)) n++;
      const L = { id: `l${n}`, name: `Layer ${n}`, visible: true, opacity: 1, blend: 'normal' };
      const at = a.layers.findIndex((l) => l.id === this.layer);
      a.layers.splice(at + 1, 0, L);
      for (const fr of a.frames) fr.cels[L.id] = encodeCel(new Uint8Array(a.w * a.h));
      this.layer = L.id;
    });
    this.drawLayers();
  }

  dupLayer(L) {
    if (!L) return;
    const a = this.a;
    if (a.layers.length >= LIMITS.layers) return toast('That\'s as many layers as art can have.', 'bad');
    this.structural(() => {
      let n = a.layers.length + 1;
      while (a.layers.some((l) => l.id === `l${n}`)) n++;
      const N = { ...L, id: `l${n}`, name: `${L.name} copy` };
      a.layers.splice(a.layers.indexOf(L) + 1, 0, N);
      for (let f = 0; f < a.frames.length; f++) a.frames[f].cels[N.id] = encodeCel(this.cel(f, L.id));
      this.layer = N.id;
    });
    this.drawLayers();
    this.draw();
  }

  async deleteLayer(L) {
    const a = this.a;
    if (!L || a.layers.length < 2) return;
    this.structural(() => {
      a.layers.splice(a.layers.indexOf(L), 1);
      for (const fr of a.frames) delete fr.cels[L.id];
      for (const m of this.cels.values()) delete m[L.id];
      this.layer = a.layers[Math.max(0, a.layers.length - 1)].id;
    });
    this.drawLayers();
    this.changed();
    this.draw();
  }

  moveLayer(L, d) {
    const a = this.a;
    const i = a.layers.indexOf(L);
    const j = i + d;
    if (j < 0 || j >= a.layers.length) return;
    this.structural(() => {
      a.layers.splice(i, 1);
      a.layers.splice(j, 0, L);
    });
    this.drawLayers();
    this.changed();
    this.draw();
  }

  mergeDown(L) {
    const a = this.a;
    const i = a.layers.indexOf(L);
    if (!L || i <= 0) return;
    const below = a.layers[i - 1];
    this.structural(() => {
      for (let f = 0; f < a.frames.length; f++) {
        const top = this.cel(f, L.id);
        const bot = this.cel(f, below.id);
        for (let k = 0; k < top.length; k++) if (top[k]) bot[k] = top[k];
        this.dirtyCels.add(`${f}:${below.id}`);
      }
      this.flush();
      a.layers.splice(i, 1);
      for (const fr of a.frames) delete fr.cels[L.id];
      for (const m of this.cels.values()) delete m[L.id];
      this.layer = below.id;
    });
    this.drawLayers();
    this.changed();
    this.draw();
  }

  async renameLayer(L) {
    const { prompt } = await import('./kit.js');
    const n = await prompt('Rename layer', 'Name', L.name);
    if (!n) return;
    this.structural(() => (L.name = n.slice(0, 24)));
    this.drawLayers();
  }

  // ------------------------------------------------------------ frames
  drawTimeline() {
    const a = this.a;
    clear(this.tl);
    const fps = numberInput({ value: a.fps || 8, min: 1, max: 60, int: true, onChange: (v) => {
      this.structural(() => {
        a.fps = v;
        for (const fr of a.frames) fr.dur = Math.round(1000 / v);
      });
      this.drawTimeline();
    } });
    fps.style.width = '48px';
    const dur = numberInput({ value: (a.frames[this.frame] || {}).dur || 125, min: 10, max: 5000, int: true, onChange: (v) => {
      this.structural(() => (a.frames[this.frame].dur = v));
    } });
    dur.style.width = '62px';
    this.playBtn = button(null, { icon: this.playing ? 'pause' : 'play', small: true, title: 'Play (Enter)', onClick: () => this.togglePlay() });
    this.tl.append(h('div', { class: 'tl-bar' },
      ic('film'), h('span', { class: 'note' }, `Frame ${this.frame + 1} of ${a.frames.length}`),
      group(button(null, { icon: 'prev', small: true, title: 'Previous frame (,)', onClick: () => this.goFrame(this.frame - 1) }), this.playBtn, button(null, { icon: 'next', small: true, title: 'Next frame (.)', onClick: () => this.goFrame(this.frame + 1) })),
      h('span', { class: 'sep' }),
      button('Frame', { icon: 'plus', small: true, title: 'A copy of this frame after it (N)', onClick: () => this.addFrame(true) }),
      button('Empty', { icon: 'plus', small: true, title: 'An empty frame after this (Shift+N)', onClick: () => this.addFrame(false) }),
      button(null, { icon: 'trash', small: true, title: 'Delete this frame', onClick: () => this.deleteFrame() }),
      h('span', { class: 'sep' }),
      h('span', { class: 'note' }, 'FPS'), fps, h('span', { class: 'note' }, 'This frame (ms)'), dur,
      h('span', { class: 'spacer' }),
      button('Tag...', { icon: 'flag', small: true, title: 'Name a run of frames (walk, idle, attack): creatures use "walk"', onClick: () => this.tagDialog() })));
    // Tags over the frames.
    if ((a.tags || []).length) {
      const tags = h('div', { class: 'row', style: { padding: '2px 8px', flexWrap: 'wrap' } });
      for (const t of a.tags) {
        const chip = h('span', { class: 'chip on', style: { borderColor: t.color || 'var(--gold2)' }, 'data-tip': `Frames ${t.from + 1} to ${t.to + 1}. Click to play it; right-click for more.` }, `${t.name} ${t.from + 1}-${t.to + 1}`);
        chip.addEventListener('click', () => this.togglePlay(t));
        chip.addEventListener('contextmenu', (e) => contextMenu(e, [{ label: 'Change...', onClick: () => this.tagDialog(t) }, { label: 'Delete tag', danger: true, onClick: () => {
          this.structural(() => a.tags.splice(a.tags.indexOf(t), 1));
          this.drawTimeline();
        } }]));
        tags.append(chip);
      }
      this.tl.append(tags);
    }
    this.framesEl = h('div', { class: 'frames scroll' });
    this.tl.append(this.framesEl);
    this.drawFrames(true);
  }

  drawFrames(thumbs = false) {
    if (!this.framesEl || !this.a) return;
    const a = this.a;
    if (thumbs || this.framesEl.children.length !== a.frames.length) {
      clear(this.framesEl);
      a.frames.forEach((fr, i) => {
        const th = canvas(a.w, a.h);
        th.getContext('2d').putImageData(new ImageData(this.compose(i), a.w, a.h), 0, 0);
        const el = h('div', { class: `frame${i === this.frame ? ' on' : ''}`, draggable: 'true', 'data-tip': `${fr.dur} ms` }, th, h('span', { class: 'n' }, String(i + 1)));
        el.addEventListener('click', () => this.goFrame(i));
        el.addEventListener('contextmenu', (e) => contextMenu(e, [
          { label: 'Duplicate', icon: 'copy', onClick: () => {
            this.goFrame(i);
            this.addFrame(true);
          } },
          { label: 'Insert empty after', icon: 'plus', onClick: () => {
            this.goFrame(i);
            this.addFrame(false);
          } },
          { label: 'Reverse all frames', onClick: () => this.reverseFrames() },
          { sep: true },
          { label: 'Delete', icon: 'trash', danger: true, onClick: () => {
            this.goFrame(i);
            this.deleteFrame();
          }, off: a.frames.length < 2 },
        ]));
        el.addEventListener('dragstart', (e) => {
          this.dragFrame = i;
          e.dataTransfer.setData('text/plain', `frame${i}`);
        });
        el.addEventListener('dragover', (e) => {
          if (this.dragFrame === undefined || this.dragFrame === null) return;
          e.preventDefault();
          el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
        el.addEventListener('drop', (e) => {
          e.preventDefault();
          el.classList.remove('drag-over');
          const from = this.dragFrame;
          this.dragFrame = null;
          if (from === null || from === undefined || from === i) return;
          this.structural(() => {
            const [fr2] = a.frames.splice(from, 1);
            a.frames.splice(i, 0, fr2);
          });
          this.cels.clear();
          this.frame = i;
          this.drawTimeline();
          this.changed();
          this.draw();
        });
        this.framesEl.append(el);
      });
    } else {
      [...this.framesEl.children].forEach((el, i) => el.classList.toggle('on', i === this.frame));
    }
  }

  goFrame(i) {
    const a = this.a;
    if (!a) return;
    this.dropFloat();
    this.frame = ((i % a.frames.length) + a.frames.length) % a.frames.length;
    this.drawTimeline();
    this.drawLayers();
    this.draw();
  }

  addFrame(copy) {
    const a = this.a;
    if (a.frames.length >= LIMITS.frames) return toast('That\'s as many frames as art can have.', 'bad');
    this.structural(() => {
      const fr = { dur: a.frames[this.frame].dur, cels: {} };
      for (const L of a.layers) fr.cels[L.id] = copy ? encodeCel(this.cel(this.frame, L.id)) : encodeCel(new Uint8Array(a.w * a.h));
      a.frames.splice(this.frame + 1, 0, fr);
      for (const t of a.tags || []) {
        if (t.from > this.frame) t.from++;
        if (t.to >= this.frame) t.to++;
      }
    });
    this.cels.clear();
    this.frame++;
    this.drawTimeline();
    this.changed();
    this.draw();
  }

  deleteFrame() {
    const a = this.a;
    if (a.frames.length < 2) return toast('Art needs at least one frame.');
    this.structural(() => {
      a.frames.splice(this.frame, 1);
      for (const t of a.tags || []) {
        if (t.from > this.frame) t.from--;
        if (t.to >= this.frame) t.to--;
      }
      a.tags = (a.tags || []).filter((t) => t.to >= t.from && t.from >= 0);
    });
    this.cels.clear();
    this.frame = Math.min(this.frame, a.frames.length - 1);
    this.drawTimeline();
    this.changed();
    this.draw();
  }

  reverseFrames() {
    this.structural(() => this.a.frames.reverse());
    this.cels.clear();
    this.drawTimeline();
    this.changed();
    this.draw();
  }

  async tagDialog(t = null) {
    const a = this.a;
    const name = textInput({ value: t ? t.name : 'walk', max: 16 });
    let from = t ? t.from + 1 : 1;
    let to = t ? t.to + 1 : a.frames.length;
    const v = await dialog({ title: t ? 'Change tag' : 'Tag frames', icon: 'flag', body: [
      h('div', { class: 'note' }, 'A tag names a run of frames. A creature walks with its "walk" frames (or all of them, if there\'s no tag).'),
      field('Name', name),
      h('div', { class: 'row' }, field('From frame', numberInput({ value: from, min: 1, max: a.frames.length, int: true, onChange: (x) => (from = x) })), field('To frame', numberInput({ value: to, min: 1, max: a.frames.length, int: true, onChange: (x) => (to = x) }))),
    ], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'OK', kind: 'primary', value: 'ok' }] });
    if (v !== 'ok') return;
    this.structural(() => {
      a.tags ||= [];
      const tag = t || { color: ['#80e070', '#80a8ff', '#ffa050', '#c090ff'][a.tags.length % 4] };
      Object.assign(tag, { name: name.value.trim().toLowerCase() || 'tag', from: Math.min(from, to) - 1, to: Math.max(from, to) - 1 });
      if (!t) a.tags.push(tag);
    });
    this.drawTimeline();
  }

  togglePlay(tag = null) {
    if (this.playing) return this.stopPlay();
    this.playing = true;
    this.playTag = tag;
    this.playT = 0;
    if (tag) this.frame = tag.from;
    this.drawTimeline();
  }

  stopPlay() {
    if (!this.playing) return;
    this.playing = false;
    this.playTag = null;
    if (this.tl && this.a) this.drawTimeline();
  }

  // ------------------------------------------------------------ the canvas
  // The frame's pixels, every visible layer (with the floating selection,
  // if being moved).
  compose(f = this.frame) {
    const a = this.a;
    const n = a.w * a.h;
    const out = new Uint8ClampedArray(n * 4);
    const pal = a.palette.map(hexToRgba);
    for (const L of a.layers) {
      if (!L.visible) continue;
      const c = this.cel(f, L.id);
      const fl = this.float && f === this.frame && L.id === this.layer ? this.float : null;
      const op = L.opacity ?? 1;
      for (let i = 0; i < n; i++) {
        let v = c[i];
        if (fl) {
          const x = i % a.w;
          const y = (i / a.w) | 0;
          const sx = x - fl.dx;
          const sy = y - fl.dy;
          if (sx >= 0 && sy >= 0 && sx < a.w && sy < a.h && fl.data[sy * a.w + sx]) v = fl.data[sy * a.w + sx];
        }
        if (!v) continue;
        const p = pal[v - 1];
        if (!p) continue;
        const al = (p[3] / 255) * op;
        const j = i * 4;
        if (L.blend === 'add') {
          out[j] += p[0] * al;
          out[j + 1] += p[1] * al;
          out[j + 2] += p[2] * al;
          out[j + 3] = Math.max(out[j + 3], al * 255);
        } else if (L.blend === 'multiply' && out[j + 3]) {
          out[j] = out[j] * (1 - al) + ((out[j] * p[0]) / 255) * al;
          out[j + 1] = out[j + 1] * (1 - al) + ((out[j + 1] * p[1]) / 255) * al;
          out[j + 2] = out[j + 2] * (1 - al) + ((out[j + 2] * p[2]) / 255) * al;
        } else {
          const da = out[j + 3] / 255;
          const na = al + da * (1 - al);
          out[j] = (p[0] * al + out[j] * da * (1 - al)) / na;
          out[j + 1] = (p[1] * al + out[j + 1] * da * (1 - al)) / na;
          out[j + 2] = (p[2] * al + out[j + 2] * da * (1 - al)) / na;
          out[j + 3] = na * 255;
        }
      }
    }
    return out;
  }

  fit(reset) {
    if (!this.a || !this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(r.width * dpr);
    this.cv.height = Math.round(r.height * dpr);
    this.dpr = dpr;
    if (reset || !this.zoom) {
      const z = Math.max(1, Math.floor(Math.min((r.width - 60) / this.a.w, (r.height - 60) / this.a.h)));
      this.zoom = Math.min(64, z);
      this.panX = Math.round((r.width - this.a.w * this.zoom) / 2);
      this.panY = Math.round((r.height - this.a.h * this.zoom) / 2);
    }
    this.draw();
  }

  zoomBy(d, cx = null, cy = null) {
    const steps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
    let i = steps.findIndex((s) => s >= this.zoom);
    if (i < 0) i = steps.length - 1;
    const nz = steps[Math.max(0, Math.min(steps.length - 1, i + d))];
    const r = this.wrap.getBoundingClientRect();
    const px = cx ?? r.width / 2;
    const py = cy ?? r.height / 2;
    const ix = (px - this.panX) / this.zoom;
    const iy = (py - this.panY) / this.zoom;
    this.zoom = nz;
    this.panX = Math.round(px - ix * nz);
    this.panY = Math.round(py - iy * nz);
    this.draw();
  }

  draw() {
    this.needDraw = true;
  }

  tick(t) {
    if (!this.a || !this.cv) return;
    // The animation playing.
    if (this.playing) {
      const now = t;
      this.lastT ??= now;
      this.playT += now - this.lastT;
      const fr = this.a.frames[this.frame];
      const [f0, f1] = this.playTag ? [this.playTag.from, this.playTag.to] : [0, this.a.frames.length - 1];
      if (this.playT >= (fr ? fr.dur : 125)) {
        this.playT = 0;
        this.frame = this.frame >= f1 || this.frame < f0 ? f0 : this.frame + 1;
        this.drawFrames(false);
        this.needDraw = true;
      }
    }
    this.lastT = t;
    this.ants = Math.floor(t / 150) % 8;
    if (this.sel && this.ants !== this.lastAnts) this.needDraw = true;
    this.lastAnts = this.ants;
    if (!this.needDraw) return;
    this.needDraw = false;
    this.paint();
  }

  paint() {
    const a = this.a;
    const ctx = this.cv.getContext('2d');
    const dpr = this.dpr || 1;
    const W = this.cv.width;
    const H = this.cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#08060b';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const z = this.zoom;
    const ox = this.panX;
    const oy = this.panY;
    const iw = a.w * z;
    const ih = a.h * z;
    // (Repeated round, faintly, for a tile.)
    if (this.opts.tile) {
      const img = this.frameCanvas(this.frame);
      ctx.globalAlpha = 0.5;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) ctx.drawImage(img, ox + dx * iw, oy + dy * ih, iw, ih);
      ctx.globalAlpha = 1;
    }
    // Checks under it (where it's clear).
    const cs = Math.max(4, z >= 8 ? z / 2 : 8);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, iw, ih);
    ctx.clip();
    for (let y = 0; y < ih; y += cs) for (let x = 0; x < iw; x += cs) {
      ctx.fillStyle = ((x / cs) + (y / cs)) % 2 ? '#1e1826' : '#16121c';
      ctx.fillRect(ox + x, oy + y, cs, cs);
    }
    ctx.restore();
    // The frames either side, faint and tinted.
    if (this.opts.onion && a.frames.length > 1) {
      for (const [d, tint] of [[-1, 'rgba(255,90,80,'], [1, 'rgba(90,160,255,']]) {
        const f = this.frame + d;
        if (f < 0 || f >= a.frames.length) continue;
        ctx.globalAlpha = 0.28;
        ctx.drawImage(this.frameCanvas(f), ox, oy, iw, ih);
        ctx.globalAlpha = 0.18;
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `${tint}1)`;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    }
    ctx.drawImage(this.frameCanvas(this.frame, true), ox, oy, iw, ih);
    // What's being drawn (a line, a box, before it's let go).
    if (this.preview && this.preview.length) {
      const c = this.previewColor;
      ctx.fillStyle = c ? `rgba(${c[0]},${c[1]},${c[2]},0.85)` : 'rgba(255,255,255,0.35)';
      for (const [x, y] of this.preview) if (x >= 0 && y >= 0 && x < a.w && y < a.h) ctx.fillRect(ox + x * z, oy + y * z, z, z);
    }
    // The grid.
    if (this.opts.grid && z >= 6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= a.w; x++) {
        ctx.moveTo(ox + x * z + 0.5, oy);
        ctx.lineTo(ox + x * z + 0.5, oy + ih);
      }
      for (let y = 0; y <= a.h; y++) {
        ctx.moveTo(ox, oy + y * z + 0.5);
        ctx.lineTo(ox + iw, oy + y * z + 0.5);
      }
      ctx.stroke();
      // Every eighth line a little brighter.
      if (a.w > 8 || a.h > 8) {
        ctx.strokeStyle = 'rgba(255,224,112,0.12)';
        ctx.beginPath();
        for (let x = 8; x < a.w; x += 8) {
          ctx.moveTo(ox + x * z + 0.5, oy);
          ctx.lineTo(ox + x * z + 0.5, oy + ih);
        }
        for (let y = 8; y < a.h; y += 8) {
          ctx.moveTo(ox, oy + y * z + 0.5);
          ctx.lineTo(ox + iw, oy + y * z + 0.5);
        }
        ctx.stroke();
      }
    }
    // Mirror lines.
    ctx.strokeStyle = 'rgba(128,200,255,0.5)';
    ctx.setLineDash([4, 4]);
    if (this.opts.mirrorX) {
      ctx.beginPath();
      ctx.moveTo(ox + iw / 2, oy - 8);
      ctx.lineTo(ox + iw / 2, oy + ih + 8);
      ctx.stroke();
    }
    if (this.opts.mirrorY) {
      ctx.beginPath();
      ctx.moveTo(ox - 8, oy + ih / 2);
      ctx.lineTo(ox + iw + 8, oy + ih / 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Its edge.
    ctx.strokeStyle = 'rgba(255,224,112,0.35)';
    ctx.strokeRect(ox - 0.5, oy - 0.5, iw + 1, ih + 1);
    // The selection: marching ants round it.
    if (this.sel) this.paintSel(ctx, ox, oy, z);
    // Where the brush would go.
    if (this.hover && !this.down && ['pencil', 'eraser', 'dither', 'shade'].includes(this.tool)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      for (const [x, y] of this.brush(this.hover.x, this.hover.y)) ctx.strokeRect(ox + x * z + 0.5, oy + y * z + 0.5, z - 1, z - 1);
    } else if (this.hover && !this.down && z >= 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(ox + this.hover.x * z + 0.5, oy + this.hover.y * z + 0.5, z - 1, z - 1);
    }
    if (this.zoomLabel) this.zoomLabel.textContent = `${z * 100}%`;
  }

  frameCanvas(f, live = false) {
    const a = this.a;
    if (!this._fc || this._fc.width !== a.w || this._fc.height !== a.h) this._fc = canvas(a.w, a.h);
    const c = live ? this._fc : canvas(a.w, a.h);
    c.getContext('2d').putImageData(new ImageData(this.compose(f), a.w, a.h), 0, 0);
    return c;
  }

  paintSel(ctx, ox, oy, z) {
    const a = this.a;
    const m = this.sel.mask;
    const fl = this.float;
    const dx = fl ? fl.dx : 0;
    const dy = fl ? fl.dy : 0;
    ctx.lineWidth = 1;
    const seg2 = (x0, y0, x1, y1, k) => {
      ctx.strokeStyle = (k + this.ants) % 8 < 4 ? '#ffffff' : '#000000';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };
    const at = (x, y) => x >= 0 && y >= 0 && x < a.w && y < a.h && m[y * a.w + x];
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      if (!m[y * a.w + x]) continue;
      const X = ox + (x + dx) * z + 0.5;
      const Y = oy + (y + dy) * z + 0.5;
      if (!at(x, y - 1)) seg2(X, Y, X + z, Y, x);
      if (!at(x, y + 1)) seg2(X, Y + z - 1, X + z, Y + z - 1, x);
      if (!at(x - 1, y)) seg2(X, Y, X, Y + z, y);
      if (!at(x + 1, y)) seg2(X + z - 1, Y, X + z - 1, Y + z, y);
    }
  }

  // ------------------------------------------------------------ the pointer
  bindCanvas() {
    const cv = this.cv;
    const at = (e) => {
      const r = cv.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      return { px, py, x: Math.floor((px - this.panX) / this.zoom), y: Math.floor((py - this.panY) / this.zoom) };
    };
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = at(e);
      if (e.ctrlKey || e.metaKey || !e.shiftKey) this.zoomBy(e.deltaY < 0 ? 1 : -1, p.px, p.py);
      else {
        this.panX -= e.deltaY;
        this.draw();
      }
    }, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      if (!this.a) return;
      cv.setPointerCapture(e.pointerId);
      const p = at(e);
      this.down = { button: e.button, x0: p.x, y0: p.y, px0: p.px, py0: p.py, panX: this.panX, panY: this.panY, shift: e.shiftKey, alt: e.altKey, last: p };
      if (e.button === 1 || this.tool === 'hand' || this.spaceDown) {
        this.down.pan = true;
        return;
      }
      if (e.altKey && !['select', 'lasso', 'wand'].includes(this.tool)) {
        this.pick(p.x, p.y, e.button === 2);
        this.down.picking = true;
        return;
      }
      this.begin(p, e);
    });
    cv.addEventListener('pointermove', (e) => {
      const p = at(e);
      this.hover = { x: p.x, y: p.y };
      this.updateHud(p);
      if (!this.down) return this.draw();
      if (this.down.pan) {
        this.panX = this.down.panX + (p.px - this.down.px0);
        this.panY = this.down.panY + (p.py - this.down.py0);
        return this.draw();
      }
      if (this.down.picking) return this.pick(p.x, p.y, this.down.button === 2);
      this.drag(p, e);
    });
    const up = (e) => {
      if (!this.down) return;
      const d = this.down;
      if (!d.pan && !d.picking) this.end(at(e), e);
      this.down = null;
      this.draw();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => {
      this.hover = null;
      this.draw();
    });
  }

  updateHud(p) {
    const a = this.a;
    if (!a || !this.hud) return;
    const inside = p.x >= 0 && p.y >= 0 && p.x < a.w && p.y < a.h;
    let col = '';
    if (inside) {
      const v = this.cel()[p.y * a.w + p.x];
      col = v ? `  ${a.palette[v - 1]}` : '  clear';
    }
    this.hud.textContent = inside ? `${p.x}, ${p.y}${col}` : `${a.w} × ${a.h}`;
    const L = a.layers.find((q) => q.id === this.layer);
    this.hudR.textContent = `${L ? L.name : ''} · frame ${this.frame + 1}/${a.frames.length}`;
  }

  layerLocked() {
    const L = this.a.layers.find((q) => q.id === this.layer);
    if (L && L.locked) {
      toast('That layer\'s locked (see Layers).', 'bad', 1500);
      return true;
    }
    if (L && !L.visible) {
      toast('That layer\'s hidden: show it to draw on it.', 'bad', 1500);
      return true;
    }
    return false;
  }

  // The colour index a button draws with.
  ink(button) {
    if (this.tool === 'eraser') return 0;
    return this.useColor(button === 2 ? 'bg' : 'fg');
  }

  begin(p, e) {
    const t = this.tool;
    const d = this.down;
    if (t === 'picker') {
      this.pick(p.x, p.y, e.button === 2);
      d.picking = true;
      return;
    }
    if (['select', 'lasso', 'wand'].includes(t)) {
      this.dropFloat();
      d.mode = e.shiftKey ? 'add' : e.altKey ? 'sub' : 'new';
      if (t === 'wand') {
        this.wandSelect(p.x, p.y, d.mode);
        d.done = true;
      } else if (t === 'lasso') d.poly = [[p.x + 0.5, p.y + 0.5]];
      return;
    }
    if (t === 'move') {
      if (this.layerLocked()) return (d.done = true);
      if (!this.float) this.lift();
      d.fdx = this.float.dx;
      d.fdy = this.float.dy;
      return;
    }
    if (this.layerLocked()) return (d.done = true);
    d.before = this.cel().slice();
    d.ink = this.ink(e.button);
    if (t === 'bucket') {
      this.fill(p.x, p.y, d.ink);
      return;
    }
    if (t === 'replace') {
      this.replaceColor(p.x, p.y, d.ink);
      d.done = true;
      return;
    }
    if (['pencil', 'eraser', 'dither', 'shade'].includes(t)) {
      d.trail = [[p.x, p.y]];
      this.stamp(p.x, p.y, d);
      this.draw();
    }
  }

  drag(p, e) {
    const d = this.down;
    if (d.done) return;
    const t = this.tool;
    if (['pencil', 'eraser', 'dither', 'shade'].includes(t)) {
      if (!d.before) return;
      const [lx, ly] = d.trail[d.trail.length - 1];
      for (const [x, y] of lineCells(lx, ly, p.x, p.y).slice(1)) {
        d.trail.push([x, y]);
        // (Pixel-perfect: no doubled corners in a one-pixel line.)
        if (t === 'pencil' && this.opts.perfect && this.opts.size === 1 && d.trail.length >= 3) {
          const [ax, ay] = d.trail[d.trail.length - 3];
          const [bx, by] = d.trail[d.trail.length - 2];
          if ((ax === bx || ay === by) && (bx === x || by === y) && Math.abs(ax - x) === 1 && Math.abs(ay - y) === 1) {
            const c = this.cel();
            for (const [mx, my] of this.mirrored(bx, by)) if (mx >= 0 && my >= 0 && mx < this.a.w && my < this.a.h) c[my * this.a.w + mx] = d.before[my * this.a.w + mx];
            d.trail.splice(d.trail.length - 2, 1);
          }
        }
        this.stamp(x, y, d);
      }
      this.draw();
      return;
    }
    if (t === 'line' || t === 'rect' || t === 'ellipse') {
      let x1 = p.x;
      let y1 = p.y;
      if (t === 'line' && e.shiftKey) [x1, y1] = snap45(d.x0, d.y0, x1, y1);
      const filled = this.opts.filled || e.shiftKey;
      const cells = t === 'line' ? lineCells(d.x0, d.y0, x1, y1) : t === 'rect' ? rectCells(d.x0, d.y0, x1, y1, filled && t === 'rect') : ellipseCells(d.x0, d.y0, x1, y1, filled);
      this.preview = this.mirroredAll(cells);
      this.previewColor = d.ink ? this.rgba(d.ink) : null;
      d.end = [x1, y1, filled];
      this.draw();
      return;
    }
    if (t === 'select') {
      this.sel = this.selMask(d.mode, rectMask(this.a, d.x0, d.y0, p.x, p.y));
      this.draw();
      return;
    }
    if (t === 'lasso') {
      d.poly.push([p.x + 0.5, p.y + 0.5]);
      this.preview = d.poly.map(([x, y]) => [Math.floor(x), Math.floor(y)]);
      this.previewColor = null;
      this.draw();
      return;
    }
    if (t === 'move' && this.float) {
      this.float.dx = d.fdx + (p.x - d.x0);
      this.float.dy = d.fdy + (p.y - d.y0);
      this.draw();
    }
  }

  end(p) {
    const d = this.down;
    const t = this.tool;
    if (d.done) return;
    if ((t === 'line' || t === 'rect' || t === 'ellipse') && d.before) {
      const [x1, y1, filled] = d.end || [p.x, p.y, this.opts.filled];
      const cells = t === 'line' ? lineCells(d.x0, d.y0, x1, y1) : t === 'rect' ? rectCells(d.x0, d.y0, x1, y1, filled) : ellipseCells(d.x0, d.y0, x1, y1, filled);
      const c = this.cel();
      for (const [x, y] of this.mirroredAll(cells)) this.put(c, x, y, d.ink);
      this.preview = null;
    }
    if (t === 'lasso' && d.poly) {
      this.preview = null;
      this.sel = this.selMask(d.mode, polyMask(this.a, d.poly));
      this.draw();
      return;
    }
    if (t === 'select') {
      if (d.x0 === p.x && d.y0 === p.y && d.mode === 'new') this.sel = null;
      this.draw();
      return;
    }
    if (d.before) this.commitStroke(d.before);
  }

  commitStroke(before) {
    const after = this.cel().slice();
    let same = true;
    for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) {
      same = false;
      break;
    }
    if (same) return;
    this.push({ type: 'cel', f: this.frame, lid: this.layer, before, after });
    this.dirtyCels.add(`${this.frame}:${this.layer}`);
    this.changed();
  }

  put(c, x, y, v) {
    const a = this.a;
    if (x < 0 || y < 0 || x >= a.w || y >= a.h) return;
    if (this.sel && !this.sel.mask[y * a.w + x]) return;
    c[y * a.w + x] = v;
  }

  mirrored(x, y) {
    const a = this.a;
    const out = [[x, y]];
    if (this.opts.mirrorX) out.push([a.w - 1 - x, y]);
    if (this.opts.mirrorY) out.push([x, a.h - 1 - y]);
    if (this.opts.mirrorX && this.opts.mirrorY) out.push([a.w - 1 - x, a.h - 1 - y]);
    return out;
  }

  mirroredAll(cells) {
    if (!this.opts.mirrorX && !this.opts.mirrorY) return cells;
    const out = [];
    for (const [x, y] of cells) out.push(...this.mirrored(x, y));
    return out;
  }

  brush(x, y) {
    const s = this.tool === 'pencil' || this.tool === 'eraser' || this.tool === 'dither' || this.tool === 'shade' ? this.opts.size : 1;
    const out = [];
    const r = (s - 1) / 2;
    for (let dy = -Math.floor(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.floor(r); dx <= Math.ceil(r); dx++) {
      if (this.opts.round && s > 2 && dx * dx + dy * dy > (r + 0.5) * (r + 0.5)) continue;
      out.push([x + dx, y + dy]);
    }
    return out;
  }

  stamp(x, y, d) {
    const c = this.cel();
    const a = this.a;
    const t = this.tool;
    for (const [bx, by] of this.brush(x, y)) {
      for (const [mx, my] of this.mirrored(bx, by)) {
        if (mx < 0 || my < 0 || mx >= a.w || my >= a.h) continue;
        if (t === 'dither') {
          const k = this.opts.dither;
          const on = k === 'checker' ? (mx + my) % 2 === 0 : k === 'sparse' ? mx % 2 === 0 && my % 2 === 0 : !(mx % 2 === 1 && my % 2 === 1);
          if (!on) continue;
        }
        if (t === 'shade') {
          const i = my * a.w + mx;
          const v = d.before[i];
          if (!v) continue;
          const go = d.button === 2 ? v - 1 : v + 1;
          this.put(c, mx, my, Math.max(1, Math.min(a.palette.length, go)));
          continue;
        }
        this.put(c, mx, my, d.ink);
      }
    }
  }

  pick(x, y, second) {
    const a = this.a;
    if (x < 0 || y < 0 || x >= a.w || y >= a.h) return;
    let v = 0;
    for (let i = a.layers.length - 1; i >= 0; i--) {
      const L = a.layers[i];
      if (!L.visible) continue;
      const c = this.cel(this.frame, L.id)[y * a.w + x];
      if (c) {
        v = c;
        break;
      }
    }
    if (second) this.bg = v;
    else this.fg = v;
    this.pend[second ? 'bg' : 'fg'] = null;
    this.drawColors();
  }

  fill(x, y, ink) {
    const a = this.a;
    if (x < 0 || y < 0 || x >= a.w || y >= a.h) return;
    const c = this.cel();
    const want = c[y * a.w + x];
    if (want === ink) return;
    if (this.opts.global) {
      for (let i = 0; i < c.length; i++) if (c[i] === want && (!this.sel || this.sel.mask[i])) c[i] = ink;
    } else {
      const stack = [[x, y]];
      const seen = new Uint8Array(a.w * a.h);
      while (stack.length) {
        const [px, py] = stack.pop();
        if (px < 0 || py < 0 || px >= a.w || py >= a.h) continue;
        const i = py * a.w + px;
        if (seen[i] || c[i] !== want || (this.sel && !this.sel.mask[i])) continue;
        seen[i] = 1;
        c[i] = ink;
        stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
      }
    }
    this.draw();
  }

  replaceColor(x, y, ink) {
    const a = this.a;
    if (x < 0 || y < 0 || x >= a.w || y >= a.h) return;
    const want = this.cel()[y * a.w + x];
    if (want === ink) return;
    this.structural(() => {
      const frames = this.opts.allFrames ? a.frames.map((_, i) => i) : [this.frame];
      for (const f of frames) {
        const c = this.cel(f, this.layer);
        for (let i = 0; i < c.length; i++) if (c[i] === want) c[i] = ink;
        this.dirtyCels.add(`${f}:${this.layer}`);
      }
    });
    this.changed();
    this.draw();
  }

  // ------------------------------------------------------------ selection
  selMask(mode, mask) {
    if (mode === 'new' || !this.sel) return mode === 'sub' ? null : { mask };
    const m = this.sel.mask.slice();
    for (let i = 0; i < m.length; i++) m[i] = mode === 'add' ? m[i] | mask[i] : m[i] & ~mask[i] & 1;
    return m.some((v) => v) ? { mask: m } : null;
  }

  wandSelect(x, y, mode) {
    const a = this.a;
    if (x < 0 || y < 0 || x >= a.w || y >= a.h) return;
    const c = this.cel();
    const want = c[y * a.w + x];
    const m = new Uint8Array(a.w * a.h);
    const stack = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop();
      if (px < 0 || py < 0 || px >= a.w || py >= a.h) continue;
      const i = py * a.w + px;
      if (m[i] || c[i] !== want) continue;
      m[i] = 1;
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    this.sel = this.selMask(mode, m);
    this.draw();
  }

  selectColor(idx) {
    const c = this.cel();
    const m = new Uint8Array(c.length);
    for (let i = 0; i < c.length; i++) m[i] = c[i] === idx ? 1 : 0;
    this.dropFloat();
    this.sel = m.some((v) => v) ? { mask: m } : null;
    this.setTool('select');
  }

  selectAll() {
    this.dropFloat();
    this.sel = { mask: new Uint8Array(this.a.w * this.a.h).fill(1) };
    this.draw();
  }

  selectNone() {
    this.dropFloat();
    this.sel = null;
    this.draw();
  }

  selectInvert() {
    this.dropFloat();
    const m = this.sel ? this.sel.mask.map((v) => (v ? 0 : 1)) : new Uint8Array(this.a.w * this.a.h).fill(1);
    this.sel = m.some((v) => v) ? { mask: m } : null;
    this.draw();
  }

  // The selection (or the whole layer) lifted to be moved.
  lift() {
    const a = this.a;
    const c = this.cel();
    this.floatBefore = c.slice();
    const data = new Uint8Array(a.w * a.h);
    for (let i = 0; i < c.length; i++) {
      if (this.sel && !this.sel.mask[i]) continue;
      data[i] = c[i];
      c[i] = 0;
    }
    this.float = { data, dx: 0, dy: 0 };
    if (!this.sel) this.sel = { mask: new Uint8Array(a.w * a.h).fill(1) };
  }

  // Put down where it is.
  dropFloat() {
    const fl = this.float;
    if (!fl || !this.a) return;
    const a = this.a;
    const c = this.cel();
    const mask = new Uint8Array(a.w * a.h);
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const v = fl.data[y * a.w + x];
      const tx = x + fl.dx;
      const ty = y + fl.dy;
      if (tx < 0 || ty < 0 || tx >= a.w || ty >= a.h) continue;
      if (this.sel && this.sel.mask[y * a.w + x]) mask[ty * a.w + tx] = 1;
      if (v) c[ty * a.w + tx] = v;
    }
    this.float = null;
    this.sel = mask.some((v) => v) ? { mask } : null;
    if (this.floatBefore) this.commitStroke(this.floatBefore);
    this.floatBefore = null;
    this.draw();
  }

  copy(cut = false) {
    const a = this.a;
    const c = this.cel();
    const data = new Uint8Array(a.w * a.h);
    for (let i = 0; i < c.length; i++) if (!this.sel || this.sel.mask[i]) data[i] = c[i];
    clipboard = { w: a.w, h: a.h, data, palette: a.palette.slice() };
    if (cut) {
      const before = c.slice();
      for (let i = 0; i < c.length; i++) if (!this.sel || this.sel.mask[i]) c[i] = 0;
      this.commitStroke(before);
      this.draw();
    }
    toast(cut ? 'Cut.' : 'Copied.', '', 900);
  }

  paste() {
    if (!clipboard || this.layerLocked()) return;
    const a = this.a;
    this.dropFloat();
    // (Colours from other art: the nearest of these.)
    const pal = a.palette.map(hexToRgba);
    const map = clipboard.palette.map((hx) => {
      const i = a.palette.indexOf(hx);
      if (i >= 0) return i + 1;
      const c = hexToRgba(hx);
      let best = 1;
      let bd = Infinity;
      pal.forEach((q, j) => {
        const d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = j + 1;
        }
      });
      return best;
    });
    const data = new Uint8Array(a.w * a.h);
    const mask = new Uint8Array(a.w * a.h);
    for (let y = 0; y < Math.min(a.h, clipboard.h); y++) for (let x = 0; x < Math.min(a.w, clipboard.w); x++) {
      const v = clipboard.data[y * clipboard.w + x];
      if (!v) continue;
      data[y * a.w + x] = map[v - 1];
      mask[y * a.w + x] = 1;
    }
    this.floatBefore = this.cel().slice();
    this.float = { data, dx: 0, dy: 0 };
    this.sel = { mask };
    this.setTool('move');
    this.tool = 'move';
    this.draw();
  }

  clearSel() {
    if (this.layerLocked()) return;
    const c = this.cel();
    const before = c.slice();
    for (let i = 0; i < c.length; i++) if (!this.sel || this.sel.mask[i]) c[i] = 0;
    this.commitStroke(before);
    this.draw();
  }

  // ------------------------------------------------------------ whole-layer changes
  eachTarget(fn) {
    if (this.layerLocked()) return;
    const c = this.cel();
    const before = c.slice();
    const box = this.selBox();
    fn(c, before, box);
    this.commitStroke(before);
    this.draw();
  }

  selBox() {
    const a = this.a;
    if (!this.sel) return { x0: 0, y0: 0, x1: a.w - 1, y1: a.h - 1 };
    let x0 = a.w;
    let y0 = a.h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (this.sel.mask[y * a.w + x]) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  }

  flip(horizontal) {
    this.dropFloat();
    const a = this.a;
    this.eachTarget((c, before, b) => {
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
        const sx = horizontal ? b.x1 - (x - b.x0) : x;
        const sy = horizontal ? y : b.y1 - (y - b.y0);
        const i = y * a.w + x;
        if (this.sel && !this.sel.mask[i]) continue;
        c[i] = before[sy * a.w + sx];
      }
    });
    if (this.sel) {
      const m = this.sel.mask.slice();
      const b = this.selBox();
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) m[y * a.w + x] = this.sel.mask[(horizontal ? y : b.y1 - (y - b.y0)) * a.w + (horizontal ? b.x1 - (x - b.x0) : x)];
      this.sel = { mask: m };
    }
  }

  rotate() {
    this.dropFloat();
    const a = this.a;
    const b = this.selBox();
    const w = b.x1 - b.x0 + 1;
    const hh = b.y1 - b.y0 + 1;
    if (!this.sel && a.w !== a.h) return toast('Turn needs square art (or a selection).', 'bad');
    const n = Math.max(w, hh);
    this.eachTarget((c, before) => {
      const cx = b.x0;
      const cy = b.y0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const tx = cx + x;
        const ty = cy + y;
        if (tx >= a.w || ty >= a.h) continue;
        if (this.sel && !this.sel.mask[ty * a.w + tx] && !(x < hh && y < w)) continue;
        if (this.sel) c[ty * a.w + tx] = 0;
      }
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const v = before[(cy + y) * a.w + cx + x];
        if (this.sel && !this.sel.mask[(cy + y) * a.w + cx + x]) continue;
        const nx = cx + (hh - 1 - y);
        const ny = cy + x;
        if (nx < a.w && ny < a.h) c[ny * a.w + nx] = v;
      }
    });
    this.sel = null;
  }

  outline() {
    this.dropFloat();
    const a = this.a;
    const ink = this.useColor('fg') || 1;
    this.eachTarget((c, before) => {
      for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
        const i = y * a.w + x;
        if (before[i]) continue;
        if (this.sel && !this.sel.mask[i]) continue;
        const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < a.w && yy < a.h && before[yy * a.w + xx];
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) c[i] = ink;
      }
    });
  }

  async shiftDialog() {
    let dx = Math.floor(this.a.w / 2);
    let dy = 0;
    const v = await dialog({ title: 'Shift the layer', icon: 'move', body: [h('div', { class: 'note' }, 'Every pixel moves this far, wrapping round the edges: shift a block texture by half to see its seams, and fix them.'), h('div', { class: 'row' }, field('Across', numberInput({ value: dx, int: true, onChange: (q) => (dx = q) })), field('Down', numberInput({ value: dy, int: true, onChange: (q) => (dy = q) })))], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Shift', kind: 'primary', value: 'ok' }] });
    if (v !== 'ok') return;
    const a = this.a;
    this.dropFloat();
    this.sel = null;
    this.eachTarget((c, before) => {
      for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) c[(((y + dy) % a.h) + a.h) % a.h * a.w + ((((x + dx) % a.w) + a.w) % a.w)] = before[y * a.w + x];
    });
  }

  // ------------------------------------------------------------ size
  async resizeDialog() {
    const a = this.a;
    let W = a.w;
    let H = a.h;
    let mode = 'canvas';
    let anchor = 4;
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 26px)', gap: '3px' } });
    const drawGrid = () => {
      clear(grid);
      for (let i = 0; i < 9; i++) {
        const b = h('button', { class: `btn small icon${i === anchor ? ' on' : ''}`, type: 'button' }, ic(i === anchor ? 'dot' : 'minus', 8));
        b.addEventListener('click', () => {
          anchor = i;
          drawGrid();
        });
        grid.append(b);
      }
    };
    drawGrid();
    const v = await dialog({ title: 'Size', icon: 'rect', body: [
      h('div', { class: 'row' }, field('Width', numberInput({ value: W, min: 1, max: LIMITS.assetSide, int: true, onChange: (q) => (W = q) })), field('Height', numberInput({ value: H, min: 1, max: LIMITS.assetSide, int: true, onChange: (q) => (H = q) }))),
      field('How', seg([['canvas', 'More room (or less)'], ['scale', 'Scale the art']], mode, (q) => (mode = q))),
      field('Anchor', grid, { tip: 'Where the art stays, given more room' }),
    ], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Resize', kind: 'primary', value: 'ok' }] });
    if (v !== 'ok' || (W === a.w && H === a.h)) return;
    this.dropFloat();
    this.sel = null;
    this.structural(() => {
      const ax = anchor % 3;
      const ay = Math.floor(anchor / 3);
      const ox = mode === 'canvas' ? Math.round(((W - a.w) * ax) / 2) : 0;
      const oy = mode === 'canvas' ? Math.round(((H - a.h) * ay) / 2) : 0;
      for (let f = 0; f < a.frames.length; f++) {
        for (const L of a.layers) {
          const src = this.cel(f, L.id);
          const out = new Uint8Array(W * H);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            let sx;
            let sy;
            if (mode === 'scale') {
              sx = Math.min(a.w - 1, Math.floor(((x + 0.5) * a.w) / W));
              sy = Math.min(a.h - 1, Math.floor(((y + 0.5) * a.h) / H));
            } else {
              sx = x - ox;
              sy = y - oy;
            }
            if (sx >= 0 && sy >= 0 && sx < a.w && sy < a.h) out[y * W + x] = src[sy * a.w + sx];
          }
          a.frames[f].cels[L.id] = encodeCel(out);
        }
      }
      a.w = W;
      a.h = H;
      a.pivot = { x: Math.floor(W / 2), y: H - 1 };
      this.cels.clear();
      this.dirtyCels.clear();
    });
    this.build();
    this.fit(true);
    this.changed();
  }

  // ------------------------------------------------------------ pictures in and out
  async importPng() {
    const f = await pickFile('image/png,image/gif,image/jpeg,image/webp');
    if (!f) return;
    let img;
    try {
      img = await readImage(f);
    } catch (e) {
      return toast(e.message, 'bad');
    }
    const a = this.a;
    let how = 'layer';
    let fw = a.w;
    let fh = a.h;
    let colors = 'palette';
    const v = await dialog({ title: 'Bring in a picture', icon: 'import', body: [
      h('div', { class: 'note' }, `${f.name}: ${img.width}×${img.height}.`),
      field('As', seg([['layer', 'A new layer here'], ['frames', 'Frames (a sprite sheet)'], ['new', 'New art of its own']], how, (q) => (how = q))),
      h('div', { class: 'row' }, field('Frame width', numberInput({ value: fw, min: 1, max: 256, int: true, onChange: (q) => (fw = q) })), field('Frame height', numberInput({ value: fh, min: 1, max: 256, int: true, onChange: (q) => (fh = q) }))),
      field('Colours', seg([['palette', 'Keep to this palette'], ['picture', 'Bring its colours in']], colors, (q) => (colors = q))),
    ], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Bring it in', kind: 'primary', value: 'ok' }] });
    if (v !== 'ok') return;
    if (how === 'new') {
      const W = Math.min(LIMITS.assetSide, img.width);
      const H = Math.min(LIMITS.assetSide, img.height);
      const c = canvas(W, H);
      c.getContext('2d').drawImage(img, 0, 0, W, H);
      const q = quantize(c.getContext('2d').getImageData(0, 0, W, H).data, W, H, 255);
      const id = await this.makeAsset({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Picture', w: W, h: H, quiet: true });
      const na = this.app.mod.assets[id];
      na.palette = q.palette;
      na.frames[0].cels.l1 = encodeCel(q.idx);
      this.app.touch('assets', id);
      this.app.open('assets', id);
      return;
    }
    const tiles = [];
    if (how === 'frames') {
      for (let y = 0; y + fh <= img.height; y += fh) for (let x = 0; x + fw <= img.width; x += fw) tiles.push([x, y]);
      if (!tiles.length) return toast('The picture\'s smaller than one frame.', 'bad');
    } else tiles.push([0, 0]);
    this.structural(() => {
      // (Colours: the picture's own into the palette first, if wanted.)
      const sw = how === 'frames' ? fw : img.width;
      const sh = how === 'frames' ? fh : img.height;
      const grab = (sx, sy) => {
        const c = canvas(a.w, a.h);
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(img, sx, sy, Math.min(sw, img.width - sx), Math.min(sh, img.height - sy), 0, 0, Math.min(a.w, sw), Math.min(a.h, sh));
        return x.getImageData(0, 0, a.w, a.h).data;
      };
      if (colors === 'picture') {
        const all = grab(0, 0);
        const q = quantize(all, a.w, a.h, Math.max(1, LIMITS.palette - a.palette.length));
        for (const c of q.palette) if (!a.palette.includes(c) && a.palette.length < LIMITS.palette) a.palette.push(c);
      }
      if (how === 'layer') {
        let n = a.layers.length + 1;
        while (a.layers.some((l) => l.id === `l${n}`)) n++;
        const L = { id: `l${n}`, name: f.name.slice(0, 20), visible: true, opacity: 1, blend: 'normal' };
        a.layers.push(L);
        for (const fr of a.frames) fr.cels[L.id] = encodeCel(new Uint8Array(a.w * a.h));
        const q = quantize(grab(0, 0), a.w, a.h, 255, a.palette);
        a.frames[this.frame].cels[L.id] = encodeCel(q.idx);
        this.layer = L.id;
      } else {
        const lid = this.layer;
        tiles.slice(0, LIMITS.frames).forEach(([sx, sy], i) => {
          const q = quantize(grab(sx, sy), a.w, a.h, 255, a.palette);
          const fi = i === 0 ? this.frame : a.frames.length;
          if (i > 0) {
            const fr = { dur: a.frames[this.frame].dur, cels: {} };
            for (const L of a.layers) fr.cels[L.id] = encodeCel(new Uint8Array(a.w * a.h));
            a.frames.push(fr);
          }
          a.frames[fi].cels[lid] = encodeCel(q.idx);
        });
      }
      this.cels.clear();
    });
    this.build();
    this.fit(false);
    this.changed();
    toast('Brought in.', 'good');
  }

  exportPng(scale) {
    const a = this.a;
    const src = this.frameCanvas(this.frame);
    const c = canvas(a.w * scale, a.h * scale);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    c.toBlob((b) => download(`${a.name.replace(/[^\w-]+/g, '_')}${a.frames.length > 1 ? `_${this.frame + 1}` : ''}.png`, b));
  }

  exportSheet(scale) {
    const a = this.a;
    const c = canvas(a.w * a.frames.length * scale, a.h * scale);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    a.frames.forEach((_, i) => x.drawImage(this.frameCanvas(i), i * a.w * scale, 0, a.w * scale, a.h * scale));
    c.toBlob((b) => download(`${a.name.replace(/[^\w-]+/g, '_')}_sheet.png`, b));
  }

  // ------------------------------------------------------------ preview
  drawPreview() {
    if (!this.previewPanel || !this.a) return;
    const b = this.previewPanel.body;
    clear(b);
    const a = this.a;
    b.append(seg([['sprite', 'Sprite'], ['block', 'As a block'], ['item', 'In a slot'], ['tile', 'Tiled']], this.previewAs, (v) => {
      this.previewAs = v;
      this.drawPreview();
    }));
    const W = 220;
    const H = 120;
    const c = canvas(W, H);
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    c.style.background = '#0a080e';
    c.style.borderRadius = '4px';
    c.style.border = '1px solid var(--line)';
    b.append(c);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const t0 = performance.now();
    const frames = a.frames.map((_, i) => this.frameCanvas(i));
    const draw = () => {
      if (!c.isConnected) return;
      const now = performance.now() - t0;
      let acc = 0;
      const total = a.frames.reduce((s, f) => s + f.dur, 0) || 1;
      const k = now % total;
      let fi = 0;
      for (let i = 0; i < a.frames.length; i++) {
        acc += a.frames[i].dur;
        if (k < acc) {
          fi = i;
          break;
        }
      }
      const img = frames[fi];
      x.clearRect(0, 0, W, H);
      if (this.previewAs === 'block') previewBlock(x, frames[0], W, H);
      else if (this.previewAs === 'item') previewSlot(x, img, W, H);
      else if (this.previewAs === 'tile') {
        const s = Math.max(1, Math.floor(Math.min(W / (a.w * 3), H / (a.h * 3)) * 2) / 2);
        for (let yy = 0; yy * a.h * s < H; yy++) for (let xx = 0; xx * a.w * s < W; xx++) x.drawImage(frames[0], xx * a.w * s, yy * a.h * s, a.w * s, a.h * s);
      } else {
        // On grass, at 1×, 2× and 4×.
        x.fillStyle = '#3e6a2e';
        x.fillRect(0, H - 30, W, 30);
        let px = 8;
        for (const s of [1, 2, 4]) {
          const dw = a.w * s;
          const dh = a.h * s;
          if (px + dw > W) break;
          x.drawImage(img, px, H - 22 - dh, dw, dh);
          px += dw + 12;
        }
      }
      requestAnimationFrame(draw);
    };
    draw();
    b.append(h('div', { class: 'note' }, a.frames.length > 1 ? `${a.frames.length} frames, playing.` : 'One frame.'));
  }

  // ------------------------------------------------------------ keys
  onKey(e) {
    if (!this.a) return false;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') {
      this.spaceDown = true;
      return true;
    }
    if (ctrl) {
      if (e.code === 'KeyC') return this.copy(false), true;
      if (e.code === 'KeyX') return this.copy(true), true;
      if (e.code === 'KeyV') return this.paste(), true;
      if (e.code === 'KeyA') return this.selectAll(), true;
      if (e.code === 'KeyD') return this.selectNone(), true;
      return false;
    }
    if (e.shiftKey && e.code === 'KeyH') return this.flip(true), true;
    if (e.shiftKey && e.code === 'KeyV') return this.flip(false), true;
    if (e.shiftKey && e.code === 'KeyR') return this.rotate(), true;
    if (e.code === 'KeyN') return this.addFrame(!e.shiftKey), true;
    if (KEYS[e.code]) return this.setTool(KEYS[e.code]), true;
    if (e.code === 'KeyX') return this.swapColors(), true;
    if (e.code === 'BracketLeft') return (this.opts.size = Math.max(1, this.opts.size - 1)), this.drawOpts(), this.draw(), true;
    if (e.code === 'BracketRight') return (this.opts.size = Math.min(16, this.opts.size + 1)), this.drawOpts(), this.draw(), true;
    if (e.key === '+' || e.key === '=') return this.zoomBy(1), true;
    if (e.key === '-') return this.zoomBy(-1), true;
    if (e.key === '0') return this.fit(true), true;
    if (e.key === ',') return this.goFrame(this.frame - 1), true;
    if (e.key === '.') return this.goFrame(this.frame + 1), true;
    if (e.code === 'Enter') {
      if (this.float) this.dropFloat();
      else this.togglePlay();
      return true;
    }
    if (e.code === 'Delete' || e.code === 'Backspace') return this.clearSel(), true;
    if (e.code === 'Escape') {
      if (this.float) this.dropFloat();
      else this.selectNone();
      return true;
    }
    return false;
  }
}

// ------------------------------------------------------------ shapes
export function lineCells(x0, y0, x1, y1) {
  const out = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 4096; n++) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}
function snap45(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const a = Math.atan2(dy, dx);
  const s = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
  const r = Math.max(Math.abs(dx), Math.abs(dy));
  return [x0 + Math.round(Math.cos(s) * r), y0 + Math.round(Math.sin(s) * r)];
}
export function rectCells(x0, y0, x1, y1, filled) {
  const out = [];
  const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [c, d] = [Math.min(y0, y1), Math.max(y0, y1)];
  for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) if (filled || x === a || x === b || y === c || y === d) out.push([x, y]);
  return out;
}
export function ellipseCells(x0, y0, x1, y1, filled) {
  const out = [];
  const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [c, d] = [Math.min(y0, y1), Math.max(y0, y1)];
  const cx = (a + b) / 2;
  const cy = (c + d) / 2;
  const rx = (b - a) / 2 + 0.5;
  const ry = (d - c) / 2 + 0.5;
  const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0001;
  for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) {
    if (!inside(x, y)) continue;
    if (filled || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) out.push([x, y]);
  }
  return out;
}
function rectMask(a, x0, y0, x1, y1) {
  const m = new Uint8Array(a.w * a.h);
  for (const [x, y] of rectCells(x0, y0, x1, y1, true)) if (x >= 0 && y >= 0 && x < a.w && y < a.h) m[y * a.w + x] = 1;
  return m;
}
function polyMask(a, poly) {
  const m = new Uint8Array(a.w * a.h);
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
    }
    if (inside) m[y * a.w + x] = 1;
  }
  return m;
}

// ------------------------------------------------------------ previews
function previewBlock(x, img, W, H) {
  // A few of it laid as ground, the game's way: tops, and their fronts
  // a shade darker below.
  x.fillStyle = '#16121c';
  x.fillRect(0, 0, W, H);
  const s = 2;
  const tw = 16 * s;
  const fh = 12 * s;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const px = 14 + col * tw;
      const py = 8 + row * tw;
      x.drawImage(img, px, py, tw, tw);
      if (row === 2) {
        x.drawImage(img, 0, img.height * 0.25, img.width, img.height * 0.75, px, py + tw, tw, fh);
        x.fillStyle = 'rgba(10,6,20,0.32)';
        x.fillRect(px, py + tw, tw, fh);
      }
    }
  }
}
function previewSlot(x, img, W, H) {
  x.fillStyle = '#100c15';
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 5; i++) {
    const px = 14 + i * 40;
    const py = 40;
    x.fillStyle = i === 2 ? '#5a4620' : '#221b2a';
    x.fillRect(px, py, 36, 36);
    x.strokeStyle = i === 2 ? '#ffe070' : '#43384f';
    x.strokeRect(px + 0.5, py + 0.5, 35, 35);
    if (i === 2) x.drawImage(img, px + 2, py + 2, 32, 32);
  }
}

// A picture of one of the game's own (an item's icon, a block's top, a
// creature's first frame), to start from.
// (Round 65) The game's people one can start from, by their work.
const PERSON_JOBS = ['farmer', 'guard', 'merchant', 'blacksmith', 'innkeeper', 'cook', 'baker', 'priest', 'scholar', 'mayor', 'noble', 'tailor', 'carpenter', 'herbalist', 'fisher', 'miner', 'lumberjack', 'trapper', 'laborer', 'beggar', 'adventurer', 'glassblower', 'sporewright', 'pearldiver'];

function gamePicture(type, key, frame = 0) {
  if (type === 'person') {
    // (Facing right, as art here does: frame 0 standing, 1 and 2 steps.)
    const look = makeLook(new RNG(7 + key.length * 131), 'vale', 'adult', key, null);
    const px = drawHumanoid(look, 1, Math.min(2, frame % 3));
    const c = canvas(px.w, px.h);
    c.getContext('2d').putImageData(px.toImageData(), 0, 0);
    return c;
  }
  if (type === 'block') {
    const id = B[key];
    if (id !== undefined && TEX.atlas) {
      const b = BLOCKS[id];
      const s = (b.render === 'cube' ? TEX.top[id * 4] : TEX.sprite[id * 4])?.[0];
      if (s) {
        const c = canvas(s.w || 16, b.render === 'cube' ? 16 : s.h || 16);
        c.getContext('2d').drawImage(TEX.atlas, s.x, s.y, c.width, c.height, 0, 0, c.width, c.height);
        return c;
      }
    }
  }
  return vanillaIcon(type, key);
}
