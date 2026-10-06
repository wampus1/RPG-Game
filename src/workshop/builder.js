// The Builder (round 62): structures built block by block, seen just as
// the game will show them (its own slant, its own textures), a layer at a
// time with the layers over it faded or hidden; with the tools of a
// builder rather than a painter: walls with their doors and windows,
// whole rooms with roofs in one drag, roofs that step up to a ridge,
// pillars, stairs, fills, copying and turning and mirroring; markers for
// what happens there (chests and their loot, triggers, spawners, people, a
// boss, the ways in and down); and where in the world it's put.
// Loot tables, layouts (several structures as a hamlet or a camp) and
// dungeons (a way in and floors below) are edited here too: see
// buildkinds.js.
import { h, ic, clear, button, group, field, numberInput, slider, check, seg, select, chips, panel, dialog, toast, canvas, textInput, contextMenu, dropTarget, popover, closePopover, colorButton, soundPicker } from './kit.js';
import { titleBar, menuButton, refPicker, blockName, biomeOptions } from './common.js';
import { blockArt, blockIcon, blockGroups, modBlocks } from './blockart.js';
import { renderVox, pickBlock, pickCell, frameOf, structVox, toView, cellY, T, voxPicture } from './voxview.js';
import * as OPS from './buildops.js';
import { bpDecode, bpEncode, bpAt } from '../mod/build.js';
import { LIMITS } from '../mod/format.js';
import { SOUNDS } from '../mod/nodes.js';
import { LH } from '../config.js';
import { BLOCKS, B, META_ROT, META_STATE } from '../world/blocks.js';
import { TEX } from '../render/textures.js';
import { iconBits } from './icons.js';
import { LootEditor, LayoutEditor, DungeonEditor } from './buildkinds.js';

const TOOLS = [
  ['brush', 'pencil', 'Brush: put blocks down (right button: take them away)', 'B'],
  ['erase', 'eraser', 'Erase: back to the ground as it was', 'E'],
  ['line', 'line', 'Line of blocks', 'L'],
  ['rect', 'rect', 'Rectangle: a floor (Shift: just its edge)', 'U'],
  ['ellipse', 'ellipse', 'Circle or oval (Shift: just its edge)', 'O'],
  ['fill', 'bucket', 'Fill the touching blocks of one kind on this layer', 'G'],
  null,
  ['walls', 'wall', 'Walls: drag out a rectangle: walls round it, with a door and windows', 'W'],
  ['room', 'house', 'Room: a floor, walls, a door, windows and a roof, in one drag', 'R'],
  ['roof', 'roof', 'Roof: drag over the top of some walls', 'F'],
  ['pillar', 'pillar', 'Pillar: a column of blocks, as high as you set', 'P'],
  ['stairs', 'stairs', 'Stairs: drag the way they climb', 'S'],
  null,
  ['pick', 'picker', 'Pick a block up to build with (or Alt+click with any tool)', 'I'],
  ['select', 'select', 'Select: copy, cut, move, turn, mirror, fill, replace', 'M'],
  ['mark', 'flag', 'Markers: chests, triggers, spawners, people, a boss, ways in and down', 'K'],
  ['hand', 'hand', 'Look about (or hold Space, or the middle button)', 'H'],
];
const KEYS = { KeyB: 'brush', KeyE: 'erase', KeyL: 'line', KeyU: 'rect', KeyO: 'ellipse', KeyG: 'fill', KeyW: 'walls', KeyR: 'room', KeyF: 'roof', KeyP: 'pillar', KeyS: 'stairs', KeyI: 'pick', KeyM: 'select', KeyK: 'mark', KeyH: 'hand' };
const HINTS = {
  brush: 'Left: put the block down. Right: take it away. [ ] brush size. Q turns the block. Alt+click picks one up.',
  erase: 'Takes blocks away (back to the ground as it was). [ ] size.',
  line: 'Drag a line of blocks on this layer. Set "Tall" to make it a wall.',
  rect: 'Drag a rectangle. Shift: only its edge. Set "Tall" for a solid block of them.',
  ellipse: 'Drag a circle or oval. Shift: only its edge.',
  fill: 'Click: every touching block of that kind on this layer becomes yours (empty ground too).',
  walls: 'Drag a rectangle: walls round it, as high as you set, with a door and windows if you like.',
  room: 'Drag a rectangle on the floor layer: a whole room, floor, walls, door, windows and roof.',
  roof: 'Drag over the walls\' top: a roof stepping up to a ridge (or hipped, flat, one slope).',
  pillar: 'Click: a column of the block from this layer up.',
  stairs: 'Drag from the bottom step the way they climb.',
  pick: 'Click a block to build with it. Shift+click: and go to its layer.',
  select: 'Drag to select (through every layer, or just this one). Drag the selection to move it. Ctrl+C/X/V, Delete, Shift+R turn, Shift+H mirror.',
  mark: 'Click to put a marker down (or click one to set it up). Drag it to move it. Delete takes it away.',
  hand: 'Drag to look about. The wheel zooms. Shift+wheel: up and down the layers.',
};
export const MARKS = {
  chest: { name: 'Chest', icon: 'chest', color: '#f0c040', tip: 'A chest (or a barrel, or a crate) filled from a loot table the first time it\'s opened.' },
  trigger: { name: 'Trigger', icon: 'bolt', color: '#c080ff', tip: 'Something that happens when someone steps near: words, a sound, an effect, creatures, an item, an event, a story.' },
  spawn: { name: 'Spawner', icon: 'spawn', color: '#ff6060', tip: 'Creatures that are here when someone comes near (and, if you like, come back after they\'re killed).' },
  npc: { name: 'Person', icon: 'person', color: '#70e070', tip: 'Someone who lives here: a person (NPC) of yours, or one of the game\'s creatures.' },
  boss: { name: 'Boss', icon: 'crown', color: '#ff4080', tip: 'The master of the place: fought in an arena about this spot.' },
  sign: { name: 'Sign', icon: 'scroll', color: '#d8b080', tip: 'A sign with words on it, to read.' },
  entry: { name: 'Way in', icon: 'door', color: '#60d0ff', tip: 'For a dungeon\'s way in: the hole that leads down.' },
  up: { name: 'Way up', icon: 'up', color: '#e8e8e8', tip: 'On a dungeon floor: the stairs back up (where you arrive on it).' },
  down: { name: 'Way down', icon: 'down', color: '#a0a0ff', tip: 'On a dungeon floor: the stairs down to the next floor.' },
};
const WHERE = [['wild', 'In the wilds'], ['near towns', 'Near towns'], ['far from towns', 'Far from towns'], ['by the sea', 'By the sea'], ['nowhere', 'Nowhere on its own']];
const ISLES = [['any', 'Any island'], ['thessa', 'Thessa'], ['kharos', 'Kharos'], ['myrrow', 'Myrrow']];
const ROOF_STYLES = [['gable', 'Gable'], ['hip', 'Hipped'], ['flat', 'Flat'], ['shed', 'One slope'], ['none', 'None']];
const DOORS = [['front', 'Front'], ['back', 'Back'], ['left', 'Left'], ['right', 'Right'], ['none', 'None']];
const ZOOMS = [1, 1.5, 2, 3, 4, 5, 6, 8];
const SIDES = ['south', 'west', 'north', 'east'];
let clipboard = null;

// ============================================================ blueprints
// A structure's cells, unpacked to work on: get and set by block name.
export class Blueprint {
  constructor(st) {
    this.st = st;
    if (!Array.isArray(st.pal) || !st.pal.length) st.pal = ['keep'];
    st.pal[0] = 'keep';
    st.marks ||= [];
    st.ground = Math.max(0, Math.min(st.h - 1, st.ground ?? 1));
    const d = bpDecode(st);
    this.idx = d.idx;
    this.meta = d.meta;
    this.dirty = false;
  }

  get w() {
    return this.st.w;
  }

  get d() {
    return this.st.d;
  }

  get h() {
    return this.st.h;
  }

  get ground() {
    return this.st.ground;
  }

  get(x, y, z) {
    const st = this.st;
    if (x < 0 || z < 0 || y < 0 || x >= st.w || z >= st.d || y >= st.h) return null;
    const i = bpAt(st, x, y, z);
    const v = this.idx[i];
    return v ? [st.pal[v], this.meta[i]] : null;
  }

  set(x, y, z, ref, meta = 0) {
    const st = this.st;
    if (x < 0 || z < 0 || y < 0 || x >= st.w || z >= st.d || y >= st.h) return;
    const i = bpAt(st, x, y, z);
    const v = !ref || ref === 'keep' ? 0 : this.palIndex(ref);
    if (v < 0) return;
    if (this.idx[i] === v && this.meta[i] === (v ? meta | 0 : 0)) return;
    this.idx[i] = v;
    this.meta[i] = v ? meta | 0 : 0;
    this.dirty = true;
  }

  palIndex(ref) {
    const pal = this.st.pal;
    let i = pal.indexOf(ref, 1);
    if (i > 0) return i;
    if (pal.length >= LIMITS.palette) {
      this.compact();
      if (pal.length >= LIMITS.palette) {
        toast('That\'s as many kinds of block as one structure can have.', 'bad');
        return -1;
      }
    }
    pal.push(ref);
    i = pal.length - 1;
    return i;
  }

  // Kinds of block no longer used, gone from the list.
  compact() {
    const pal = this.st.pal;
    const used = new Uint8Array(pal.length);
    for (const v of this.idx) used[v] = 1;
    const map = new Uint8Array(pal.length);
    const out = ['keep'];
    for (let i = 1; i < pal.length; i++) if (used[i]) {
      map[i] = out.length;
      out.push(pal[i]);
    }
    if (out.length === pal.length) return;
    for (let i = 0; i < this.idx.length; i++) this.idx[i] = map[this.idx[i]];
    this.st.pal = out;
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return false;
    this.compact();
    bpEncode(this.st, this.idx, this.meta);
    this.dirty = false;
    return true;
  }

  // How many of each block.
  counts() {
    const n = new Map();
    for (const v of this.idx) if (v) n.set(v, (n.get(v) || 0) + 1);
    const out = new Map();
    for (const [v, c] of n) out.set(this.st.pal[v], (out.get(this.st.pal[v]) || 0) + c);
    return out;
  }

  layerCount(y) {
    const st = this.st;
    let n = 0;
    const a = y * st.w * st.d;
    for (let i = 0; i < st.w * st.d; i++) if (this.idx[a + i]) n++;
    return n;
  }

  // A new size: `ax`, `az` where the old sits in the new (0 one side, 0.5
  // the middle, 1 the other), `below` layers added (or taken, if less
  // than 0) under it.
  resize(w, d, hh, ax = 0.5, az = 0.5, below = 0) {
    const st = this.st;
    const ox = Math.round((w - st.w) * ax);
    const oz = Math.round((d - st.d) * az);
    const idx = new Uint8Array(w * d * hh);
    const meta = new Uint8Array(w * d * hh);
    for (let y = 0; y < st.h; y++) for (let z = 0; z < st.d; z++) for (let x = 0; x < st.w; x++) {
      const nx = x + ox;
      const nz = z + oz;
      const ny = y + below;
      if (nx < 0 || nz < 0 || ny < 0 || nx >= w || nz >= d || ny >= hh) continue;
      const i = bpAt(st, x, y, z);
      const j = (ny * d + nz) * w + nx;
      idx[j] = this.idx[i];
      meta[j] = this.meta[i];
    }
    st.marks = (st.marks || []).map((m) => ({ ...m, x: m.x + ox, z: m.z + oz, y: m.y + below })).filter((m) => m.x >= 0 && m.z >= 0 && m.y >= 0 && m.x < w && m.z < d && m.y < hh);
    st.w = w;
    st.d = d;
    st.h = hh;
    st.ground = Math.max(0, Math.min(hh - 1, (st.ground ?? 1) + below));
    this.idx = idx;
    this.meta = meta;
    this.dirty = true;
  }
}

// A turned block's turn (for rotatable blocks), a quarter `q` times.
const turnRef = (ref, meta, q) => {
  const b = B[ref] !== undefined ? BLOCKS[B[ref]] : null;
  return b && b.rotatable ? (meta & ~META_ROT) | (((meta & META_ROT) + q) & 3) : meta;
};
const mirrorRef = (ref, meta) => {
  const b = B[ref] !== undefined ? BLOCKS[B[ref]] : null;
  if (!b || !b.rotatable) return meta;
  const r = meta & META_ROT;
  return (meta & ~META_ROT) | (r === 1 ? 3 : r === 3 ? 1 : r);
};
const hasState = (ref) => {
  const id = B[ref];
  if (id === undefined) return false;
  const arr = TEX.sprite[id * 4];
  return !!(arr && arr[4]);
};

// A new structure: what it starts as (one of PRESETS), its cells built.
export function buildPreset(p, name) {
  const st = { name, w: p.w, d: p.d, h: p.h, ground: p.ground, pal: ['keep'], cells: '', metas: '', marks: [], place: { where: p.id === 'entrance' || p.id === 'floor' ? 'nowhere' : 'wild', biomes: [], count: p.id === 'entrance' || p.id === 'floor' ? 0 : 2, isle: 'any', clear: true } };
  const bp = new Blueprint(st);
  let n = 0;
  p.build(bp, (m) => st.marks.push({ id: `k${++n}`, ...m }));
  bp.flush();
  return st;
}

// ============================================================ the tool
export default class BuilderTool {
  constructor(app) {
    this.app = app;
    this.tool = 'brush';
    this.o = { size: 1, round: false, tall: 1, height: 3, door: 'front', windows: true, style: 'gable', corner: 'log_oak', floor: 'planks', wall: 'planks', roof: 'roof_red', glass: 'glass', parapet: false, width: 1, through: true, markType: 'chest', all: false, cornerOwn: true };
    this.view = { rot: 0, above: 'ghost', ground: true, air: true, grid: true };
    this.block = 'stone_bricks';
    this.meta = 0;
    this.hot = ['stone_bricks', 'planks', 'log_oak', 'cobblestone', 'glass', 'roof_red', 'torch', 'chest', 'door'];
    this.group = 'Wood';
    this.zoom = 3;
    this.pan = { x: 0, y: 0 };
    this.over = new Map();
    this.sel = null;
    this.float = null;
    this.markSel = null;
    this.layer = 1;
    this.sub = null;
    this.kind = null;
    this.id = null;
    this.icons = new Map();
  }

  // ------------------------------------------------------------ mounting
  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.onResize = () => this.fitCanvas();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('ws-resize', this.onResize);
    this.keyUp = (e) => {
      if (e.code === 'Space') this.spaceDown = false;
    };
    window.addEventListener('keyup', this.keyUp);
    if (this.kind && this.id && this.app.mod[this.kind] && this.app.mod[this.kind][this.id]) this.open(this.kind, this.id);
  }

  unmount() {
    this.flush();
    this.sub?.unmount?.();
    window.cancelAnimationFrame(this.raf);
    this.raf = null;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('ws-resize', this.onResize);
    window.removeEventListener('keyup', this.keyUp);
  }

  current() {
    return this.kind && this.id ? { kind: this.kind, id: this.id } : null;
  }

  hintText() {
    if (this.sub) return this.sub.hintText?.() || null;
    if (!this.bp) return 'Pick a structure, a layout, a dungeon or a loot table in the explorer, or make a new one.';
    if (this.float) return 'Move it where you want it and click to put it down. Q or Shift+R turns it, Shift+H mirrors it, Escape puts it back.';
    return HINTS[this.tool];
  }

  keyHelp() {
    if (this.sub) return this.sub.keyHelp?.() || [];
    return [['B E L U O G', 'Brush, erase, line, rectangle, circle, fill'], ['W R F P S', 'Walls, room, roof, pillar, stairs'], ['I M K H', 'Pick, select, markers, look about'], ['↑ ↓ / Shift+wheel', 'Up and down the layers'], ['Home', 'The ground layer'], ['← →', 'Turn the view'], ['X', 'Layers above: faded, hidden, shown'], ['Q', 'Turn the block (doors, beds, roofs...)'], ['[ ]', 'Smaller / bigger brush'], ['1-9', 'Blocks you\'ve used lately'], ['Ctrl+C X V', 'Copy, cut, paste (between structures too)'], ['Shift+R / Shift+H', 'Turn / mirror what\'s selected'], ['Delete', 'Clear the selection, or the marker'], ['+ − 0', 'Zoom in, out, to fit']];
  }

  // ------------------------------------------------------------ opening
  open(kind, id) {
    this.flush();
    this.sub?.unmount?.();
    this.sub = null;
    window.cancelAnimationFrame(this.raf);
    this.raf = null;
    if (!kind || !id || !this.app.mod[kind] || !this.app.mod[kind][id]) {
      this.kind = null;
      this.id = null;
      this.bp = null;
      return this.empty();
    }
    const same = this.kind === kind && this.id === id;
    this.kind = kind;
    this.id = id;
    if (kind !== 'structures') {
      this.bp = null;
      const E = { loot: LootEditor, layouts: LayoutEditor, dungeons: DungeonEditor }[kind];
      this.sub = new E(this, id);
      this.sub.mount(this.stage, this.insp);
      this.app.hint(this.hintText());
      return;
    }
    this.st = this.app.mod.structures[id];
    this.bp = new Blueprint(this.st);
    if (!same) {
      this.layer = Math.min(this.st.h - 1, this.st.ground);
      // (A dungeon's floor: seen with the rock over it lifted off, on the
      // layer you walk in.)
      const floor = Object.values(this.app.mod.dungeons || {}).some((D) => (D.floors || []).includes(id));
      if (floor) {
        this.layer = Math.min(this.st.h - 1, this.st.ground + 1);
        this.view.above = 'hide';
      } else if (this.view.above === 'hide') this.view.above = 'ghost';
      this.sel = null;
      this.float = null;
      this.markSel = null;
      this.zoom = 0;
    }
    this.layer = Math.max(0, Math.min(this.st.h - 1, this.layer));
    this.over.clear();
    this.build();
  }

  reload(kind, id) {
    if (kind === this.kind && id === this.id) {
      if (this.sub) {
        this.sub.reload?.();
        return;
      }
      this.st = this.app.mod.structures[id];
      if (!this.st) return this.open(null, null);
      this.bp = new Blueprint(this.st);
      this.layer = Math.max(0, Math.min(this.st.h - 1, this.layer));
      if (this.markSel && !this.st.marks.some((m) => m.id === this.markSel)) this.markSel = null;
      this.float = null;
      this.build(false);
    } else this.sub?.otherChanged?.(kind, id);
  }

  removed(kind, id) {
    if (kind === this.kind && id === this.id) this.open(null, null);
    else this.sub?.otherChanged?.(kind, id);
  }

  renamed(kind, id) {
    if (kind === this.kind && id === this.id && this.nameEl) this.nameEl.value = this.app.mod[kind][id].name;
    this.sub?.renamed?.(kind, id);
  }

  flush() {
    this.sub?.flush?.();
    if (this.bp && this.bp.flush()) this.app.dirty = true;
  }

  // Before a change: flushed, and remembered for Undo.
  before() {
    this.flush();
    this.app.checkpoint('structures', this.id);
  }

  // After one.
  changed(o = {}) {
    this.bp.flush();
    this.app.touch('structures', this.id);
    this.dirtyView = true;
    if (o.panels !== false) {
      this.drawUsed();
      this.drawLayers();
    }
    if (o.marks) this.drawMarks();
  }

  // Nothing open: what can be made here.
  empty() {
    clear(this.stage);
    clear(this.insp);
    const app = this.app;
    const m = app.mod;
    const card = (icon, t, d, fn) => {
      const c = h('div', { class: 'card' }, h('div', { class: 't' }, ic(icon), t), h('div', { class: 'd' }, d));
      c.addEventListener('click', fn);
      return c;
    };
    const lists = h('div');
    for (const [k, name] of [['structures', 'Structures'], ['layouts', 'Layouts'], ['dungeons', 'Dungeons'], ['loot', 'Loot tables']]) {
      const items = Object.values(m[k] || {});
      if (!items.length) continue;
      const row = h('div', { class: 'list' });
      for (const t of items) {
        const li = h('div', { class: 'li' }, h('span', { class: 'thumb', style: { width: '28px', display: 'grid', placeItems: 'center' } }, app.thumb(k, t.id)), t.name);
        li.addEventListener('click', () => app.open(k, t.id));
        row.append(li);
      }
      lists.append(h('h2', null, name), row);
    }
    this.stage.append(h('div', { class: 'home scroll', style: { overflow: 'auto' } },
      h('h1', null, 'Builder'),
      h('div', { class: 'sub' }, 'Buildings and ruins block by block, seen as the game will show them; towns and camps of several; dungeons floor upon floor; and the loot in their chests.'),
      h('div', { class: 'cards' },
        card('house', 'New structure', 'A building, a ruin, a camp, a shrine... from scratch, or from one to start you off.', () => this.newDialog()),
        card('grid', 'New layout', 'Several structures set out together, with paths between: a hamlet, a camp, a graveyard.', () => app.create('layouts', { name: 'Layout' })),
        card('stairs', 'New dungeon', 'A way in, and floors of your own below it, with a master at the bottom.', () => this.newDungeon()),
        card('chest', 'New loot table', 'What a chest (or a creature) gives: how many things, which, and how likely each.', () => app.create('loot', { name: 'Loot' }))),
      lists));
    this.insp.append(h('div', { class: 'insp-head' }, ic('house'), 'Builder'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open. Structures, layouts, dungeons and loot tables are all made here.')));
  }

  // ------------------------------------------------------------ new things
  async newDialog(o = {}) {
    const app = this.app;
    let pick = OPS.PRESETS[o.preset ? OPS.PRESETS.findIndex((p) => p.id === o.preset) : 1] || OPS.PRESETS[0];
    const name = textInput({ value: o.name || pick.name, max: 48 });
    const cards = h('div', { class: 'cards', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' } });
    for (const p of OPS.PRESETS) {
      const st = buildPreset(p, p.name);
      const pic = voxPicture(app, structVox(st), 150) || ic(p.icon, 24);
      const c = h('div', { class: 'card', style: { padding: '10px', minHeight: '0' } },
        h('div', { style: { height: '110px', display: 'grid', placeItems: 'center', background: '#0d0a12', borderRadius: '4px', marginBottom: '6px' } }, pic),
        h('div', { class: 't' }, p.name, h('span', { class: 'badge' }, `${p.w}×${p.d}×${p.h}`)), h('div', { class: 'd' }, p.blurb));
      if (pic.style) {
        pic.style.maxWidth = '100%';
        pic.style.maxHeight = '104px';
        pic.style.imageRendering = 'pixelated';
      }
      c.addEventListener('click', () => {
        for (const q of cards.children) q.style.borderColor = '';
        c.style.borderColor = 'var(--gold)';
        if (OPS.PRESETS.some((q) => q.name === name.value)) name.value = p.name;
        pick = p;
      });
      if (p === pick) c.style.borderColor = 'var(--gold)';
      cards.append(c);
    }
    const v = await dialog({ title: 'New structure', icon: 'house', wide: true, body: [field('Name', name), h('div', { class: 'note' }, 'Start from:'), cards], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Create', kind: 'primary', value: 'ok' }] });
    if (v !== 'ok') return null;
    const st = buildPreset(pick, name.value || pick.name);
    delete st.name;
    return app.create('structures', { ...st, name: name.value || pick.name }, { open: o.open });
  }

  // A dungeon with a way in and a floor, ready to change.
  async newDungeon(name = 'Dungeon') {
    const app = this.app;
    const P = (id) => OPS.PRESETS.find((p) => p.id === id);
    const e = buildPreset(P('entrance'), `${name}: way in`);
    const eid = await app.create('structures', e, { open: false });
    const f1 = buildPreset(P('floor'), `${name}: floor 1`);
    const fid = await app.create('structures', f1, { open: false });
    return app.create('dungeons', { name, entrance: eid, floors: [fid], boss: null });
  }

  // ------------------------------------------------------------ the screen
  build(refit = true) {
    const app = this.app;
    const st = this.st;
    clear(this.stage);
    clear(this.insp);
    this.zoomLabel = h('span', { class: 'note', style: { minWidth: '34px', textAlign: 'center' } });
    this.sizeBtn = button(`${st.w}×${st.d}×${st.h}`, { icon: 'rect', small: true, title: 'Change the size', onClick: () => this.resizeDialog() });
    const view = this.view;
    const tog = (k, icon, tip) => {
      const b = button(null, { icon, small: true, title: tip, on: view[k], onClick: () => {
        view[k] = !view[k];
        b.classList.toggle('on', view[k]);
        this.dirtyView = true;
      } });
      return b;
    };
    this.aboveSeg = seg([['ghost', 'Fade above', 'Layers above this one, faded (X)'], ['hide', 'Hide above', 'Layers above this one, hidden'], ['show', 'Show all', 'Every layer as it is']], view.above, (v) => {
      view.above = v;
      this.dirtyView = true;
    });
    const bar = titleBar(app, 'structures', this.id,
      this.sizeBtn,
      h('span', { class: 'sep' }),
      group(button(null, { icon: 'rotate', small: true, title: 'Turn the view (←)', onClick: () => this.turnView(-1) }), button(null, { icon: 'flipH', small: true, title: 'Turn the view the other way (→)', onClick: () => this.turnView(1) })),
      this.compass = h('span', { class: 'note', 'data-tip': 'Which side you\'re looking from' }),
      this.aboveSeg,
      tog('grid', 'grid', 'The grid on this layer'),
      tog('ground', 'sun', 'The ground it\'s set in'),
      tog('air', 'eye', 'Show cells cleared to air'),
      h('span', { class: 'sep' }),
      group(button(null, { icon: 'minus', small: true, title: 'Zoom out (−)', onClick: () => this.zoomBy(-1) }), button(null, { icon: 'zoom', small: true, title: 'Fit (0)', onClick: () => this.fit() }), button(null, { icon: 'plus', small: true, title: 'Zoom in (+)', onClick: () => this.zoomBy(1) })),
      this.zoomLabel,
      h('span', { class: 'spacer' }),
      menuButton('Use it', () => this.useItems(), { small: true, kind: 'primary', icon: 'star', title: 'Put it in a layout or a dungeon' }));
    this.nameEl = bar.querySelector('.title input');
    // The tools.
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
    // The canvas, the layers down its side.
    this.wrap = h('div', { class: 'canvas-wrap' });
    this.cv = h('canvas');
    this.hud = h('div', { class: 'hud' });
    this.hudR = h('div', { class: 'hud r t' });
    this.layerBar = h('div', { class: 'layerbar' });
    this.wrap.append(this.cv, this.hud, this.hudR, this.layerBar);
    this.bindCanvas();
    // The blocks you've used lately, along the bottom.
    this.hotEl = h('div', { class: 'hotbar' });
    this.stage.append(bar, h('div', { style: { flex: 1, display: 'flex', minHeight: 0 } }, vt, this.wrap), this.hotEl);
    // The inspector.
    this.insp.append(h('div', { class: 'insp-head' }, ic('house'), st.name));
    const body = h('div', { class: 'insp-body scroll' });
    this.blockPanel = panel('Block', h('div'), { key: 'bd-block' });
    this.optsPanel = panel('Tool', h('div'), { key: 'bd-tool' });
    this.selPanel = panel('Selection', h('div'), { key: 'bd-sel' });
    this.marksPanel = panel('Markers', h('div'), { key: 'bd-marks', tools: [button(null, { icon: 'plus', small: true, kind: 'ghost', title: 'Put a marker down', onClick: () => this.setTool('mark') })] });
    this.usedPanel = panel('Blocks in it', h('div'), { key: 'bd-used', open: false });
    this.stPanel = panel('Structure', h('div'), { key: 'bd-structure' });
    body.append(this.blockPanel, this.optsPanel, this.selPanel, this.marksPanel, this.usedPanel, this.stPanel);
    this.insp.append(body);
    this.drawBlock();
    this.drawOpts();
    this.drawSel();
    this.drawMarks();
    this.drawUsed();
    this.drawStructure();
    this.drawHot();
    this.drawLayers();
    this.drawCompass();
    this.dirtyView = true;
    this.app.hint(this.hintText());
    if (refit) requestAnimationFrame(() => this.fitCanvas(true));
    else requestAnimationFrame(() => this.fitCanvas(false));
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.draw();
    };
    window.cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  }

  useItems() {
    const app = this.app;
    const t = this.st;
    const out = [
      { label: 'Put it in a new layout', icon: 'grid', onClick: () => app.create('layouts', { name: `${t.name} layout`, pieces: [{ structure: this.id, x: 4, z: 4, rot: 0 }] }) },
      { label: 'Make a dungeon with it as a floor', icon: 'stairs', onClick: () => app.create('dungeons', { name: `${t.name} dungeon`, floors: [this.id] }) },
      { label: 'Make a dungeon with it as the way in', icon: 'door', onClick: () => app.create('dungeons', { name: `${t.name} dungeon`, entrance: this.id, floors: [] }) },
    ];
    const lays = Object.values(app.mod.layouts || {});
    if (lays.length) out.push({ label: 'Add it to a layout', icon: 'grid', sub: lays.map((L) => ({ label: L.name, onClick: () => {
      app.checkpoint('layouts', L.id);
      L.pieces.push({ structure: this.id, x: 2, z: 2, rot: 0 });
      app.touch('layouts', L.id);
      app.open('layouts', L.id);
    } })) });
    out.push({ sep: true }, { label: 'Export a picture (PNG)', icon: 'export', onClick: () => this.exportPng() });
    return out;
  }

  exportPng() {
    const vox = structVox(this.st, this.bp);
    const F = frameOf(vox, this.view.rot);
    const c = canvas(F.pw * 3, F.ph * 3);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.scale(3, 3);
    renderVox(x, this.app, vox, { rot: this.view.rot, ground: false });
    c.toBlob((b) => {
      const a = h('a', { href: URL.createObjectURL(b), download: `${String(this.st.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png` });
      document.body.append(a);
      a.click();
      a.remove();
    });
  }

  setTool(id) {
    if (this.float && id !== 'select') this.dropFloat();
    this.tool = id;
    for (const [k, b] of Object.entries(this.toolBtns || {})) b.classList.toggle('on', k === id);
    this.drawOpts();
    this.app.hint(this.hintText());
  }

  // ------------------------------------------------------------ view
  vox() {
    return { w: this.st.w, d: this.st.d, h: this.st.h, ground: this.st.ground, get: (x, y, z) => this.bp.get(x, y, z) };
  }

  fitCanvas(refit = false) {
    if (!this.cv || !this.wrap.isConnected) return;
    const r = this.wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.max(1, Math.round(r.width * dpr));
    this.cv.height = Math.max(1, Math.round(r.height * dpr));
    this.cw = r.width;
    this.ch = r.height;
    if (refit || !this.zoom) this.fit();
    this.dirtyView = true;
  }

  fit() {
    const F = frameOf(this.vox(), this.view.rot);
    const k = Math.min((this.cw - 90) / F.pw, (this.ch - 40) / F.ph);
    this.zoom = ZOOMS.reduce((b, z) => (z <= k ? z : b), 1);
    this.pan.x = Math.round((this.cw - 60 - F.pw * this.zoom) / 2);
    this.pan.y = Math.round((this.ch - F.ph * this.zoom) / 2);
    this.zoomLabel && (this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`);
    this.dirtyView = true;
  }

  zoomBy(d, cx = null, cy = null) {
    const i = ZOOMS.indexOf(this.zoom);
    const ni = Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 3 : i) + d));
    const z = ZOOMS[ni];
    const px = cx ?? this.cw / 2;
    const py = cy ?? this.ch / 2;
    this.pan.x = px - ((px - this.pan.x) * z) / this.zoom;
    this.pan.y = py - ((py - this.pan.y) * z) / this.zoom;
    this.zoom = z;
    this.zoomLabel.textContent = `${Math.round(z * 100)}%`;
    this.dirtyView = true;
  }

  turnView(d) {
    // (Keep what's in the middle in the middle.)
    this.view.rot = (this.view.rot + d + 4) & 3;
    this.fit();
    this.drawCompass();
    this.dirtyView = true;
  }

  drawCompass() {
    if (this.compass) this.compass.textContent = `${SIDES[this.view.rot][0].toUpperCase()}`;
  }

  setLayer(y) {
    const ny = Math.max(0, Math.min(this.st.h - 1, y));
    if (ny === this.layer) return;
    this.layer = ny;
    if (this.sel && !this.o.through) {
      this.sel.y0 = ny;
      this.sel.y1 = ny;
    }
    this.dirtyView = true;
    this.drawLayers();
    this.updateHud();
  }

  drawLayers() {
    if (!this.layerBar) return;
    const st = this.st;
    clear(this.layerBar);
    const upB = button(null, { icon: 'up', small: true, kind: 'ghost', title: 'Up a layer (↑)', onClick: () => this.setLayer(this.layer + 1) });
    const dnB = button(null, { icon: 'down', small: true, kind: 'ghost', title: 'Down a layer (↓)', onClick: () => this.setLayer(this.layer - 1) });
    const list = h('div', { class: 'lb-list' });
    for (let y = st.h - 1; y >= 0; y--) {
      const n = this.bp.layerCount(y);
      const g = y === st.ground;
      const el = h('div', { class: `lb${y === this.layer ? ' on' : ''}${g ? ' ground' : ''}${y < st.ground ? ' under' : ''}`, 'data-tip': g ? `Layer ${y}: the ground (grass level). ${n} blocks.` : y < st.ground ? `Layer ${y}: below ground (dug in). ${n} blocks.` : `Layer ${y}: ${y - st.ground} up. ${n} blocks.` }, h('span', { class: 'n' }, String(y)), h('span', { class: 'bar', style: { width: `${Math.min(100, Math.round((n / (st.w * st.d)) * 100))}%` } }));
      el.addEventListener('click', () => this.setLayer(y));
      list.append(el);
    }
    this.layerBar.append(upB, list, dnB);
  }

  // ------------------------------------------------------------ drawing
  draw() {
    if (!this.cv || !this.bp) return;
    if (!this.dirtyView) return;
    this.dirtyView = false;
    const vox = this.vox();
    const rot = this.view.rot;
    const F = frameOf(vox, rot);
    // The blocks (drawn into a picture of their own when they change).
    const key = `${this.bp.idx.length}`;
    if (!this.off || this.off.width !== F.pw || this.off.height !== F.ph || this.offKey !== key) {
      this.off = canvas(F.pw, F.ph);
      this.offKey = key;
    }
    const ox = this.off.getContext('2d');
    ox.clearRect(0, 0, F.pw, F.ph);
    renderVox(ox, this.app, vox, { rot, layer: this.layer, above: this.view.above, over: this.over, ground: this.view.ground, air: this.view.air });
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#08060b';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(this.zoom * dpr, 0, 0, this.zoom * dpr, this.pan.x * dpr, this.pan.y * dpr);
    ctx.imageSmoothingEnabled = false;
    // (A shadow of the plot on the ground.)
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fillRect(0, cellY(F, vox, 0, this.st.ground), F.W * T, F.D * T + LH);
    ctx.drawImage(this.off, 0, 0);
    const lw = 1 / this.zoom;
    // The grid on this layer.
    const y0 = cellY(F, vox, 0, this.layer);
    if (this.view.grid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let u = 0; u <= F.W; u++) {
        ctx.moveTo(u * T, y0);
        ctx.lineTo(u * T, y0 + F.D * T);
      }
      for (let v = 0; v <= F.D; v++) {
        ctx.moveTo(0, y0 + v * T);
        ctx.lineTo(F.W * T, y0 + v * T);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(240,192,64,0.55)';
    ctx.lineWidth = lw * 1.5;
    ctx.strokeRect(0, y0, F.W * T, F.D * T);
    // The markers.
    this.drawMarkPins(ctx, F, vox);
    // The selection.
    if (this.sel) this.drawSelBox(ctx, F, vox, this.sel, '#60d0ff');
    if (this.float) this.drawSelBox(ctx, F, vox, this.floatBox(), '#f0c040');
    // Where the pointer is.
    if (this.hover && !this.dragging && !this.float) this.drawHover(ctx, F, vox);
    if (this.dragBox) this.drawSelBox(ctx, F, vox, this.dragBox, 'rgba(240,192,64,0.9)');
  }

  // A box of cells (x0..x1, z0..z1, y0..y1) outlined, as seen.
  drawSelBox(ctx, F, vox, b, color) {
    const rot = this.view.rot;
    const [u0, v0] = toView(b.x0, b.z0, vox.w, vox.d, rot);
    const [u1, v1] = toView(b.x1, b.z1, vox.w, vox.d, rot);
    const ua = Math.min(u0, u1);
    const ub = Math.max(u0, u1) + 1;
    const va = Math.min(v0, v1);
    const vb = Math.max(v0, v1) + 1;
    const top = cellY(F, vox, 0, b.y1);
    const bot = cellY(F, vox, 0, b.y0) + LH;
    ctx.lineWidth = 1.5 / this.zoom;
    ctx.strokeStyle = color;
    ctx.setLineDash([3 / this.zoom * 2, 2 / this.zoom * 2]);
    ctx.strokeRect(ua * T, top + va * T, (ub - ua) * T, (vb - va) * T);
    ctx.strokeRect(ua * T, bot + va * T, (ub - ua) * T, (vb - va) * T);
    ctx.beginPath();
    for (const u of [ua, ub]) for (const v of [va, vb]) {
      ctx.moveTo(u * T, top + v * T);
      ctx.lineTo(u * T, bot + v * T);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawHover(ctx, F, vox) {
    const hv = this.hover;
    const t = this.tool;
    const y = this.layer;
    const color = t === 'erase' ? '#ff6060' : t === 'pick' ? '#60d0ff' : t === 'mark' ? MARKS[this.o.markType].color : '#f0c040';
    ctx.lineWidth = 1.5 / this.zoom;
    ctx.strokeStyle = color;
    if (t === 'pick') {
      const p = this.pickAt(this.mouse);
      if (p) {
        const [u, v] = toView(p.x, p.z, vox.w, vox.d, this.view.rot);
        const sy = cellY(F, vox, v, p.y);
        ctx.strokeRect(u * T, sy, T, T + LH);
      }
      return;
    }
    const cells = (t === 'brush' || t === 'erase') ? this.brushCells(hv.x, hv.z) : [[hv.x, hv.z]];
    const art = (t === 'brush' || t === 'pillar' || t === 'line' || t === 'rect' || t === 'ellipse' || t === 'fill' || t === 'stairs' || t === 'walls') ? blockArt(this.app, this.block, this.viewMeta(this.block, this.meta)) : null;
    for (const [x, z] of cells) {
      const [u, v] = toView(x, z, vox.w, vox.d, this.view.rot);
      const sy = cellY(F, vox, v, y);
      if (art && art.render !== 'air') {
        ctx.globalAlpha = 0.55;
        if (art.render === 'cube') {
          ctx.drawImage(art.top, u * T, sy);
          ctx.drawImage(art.front, u * T, sy + T);
        } else if (art.render === 'flat') ctx.drawImage(art.top, u * T, sy + LH);
        else if (art.sprite) ctx.drawImage(art.sprite, u * T, sy + 28 - art.sprite.height);
        ctx.globalAlpha = 1;
      }
      ctx.strokeRect(u * T, sy, T, T);
    }
  }

  viewMeta(ref, meta) {
    const r = this.view.rot;
    return r ? (meta & ~3) | (((meta & 3) + r) & 3) : meta;
  }

  drawMarkPins(ctx, F, vox) {
    this.pins = [];
    for (const m of this.st.marks || []) {
      const M = MARKS[m.type];
      if (!M) continue;
      const [u, v] = toView(m.x, m.z, vox.w, vox.d, this.view.rot);
      const sy = cellY(F, vox, v, m.y);
      const on = m.id === this.markSel;
      const faded = m.y > this.layer && this.view.above !== 'show';
      ctx.globalAlpha = faded ? 0.3 : m.y === this.layer ? 1 : 0.75;
      // Its reach (a trigger's ring, a boss's arena).
      if ((m.type === 'trigger' || m.type === 'boss') && (on || m.y === this.layer)) {
        const r = m.type === 'trigger' ? Math.max(1, m.r || 3) : Math.max(4, m.r || 7);
        ctx.strokeStyle = M.color;
        ctx.lineWidth = 1 / this.zoom;
        ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
        ctx.beginPath();
        if (m.type === 'trigger') ctx.ellipse(u * T + 8, sy + 8, r * T, r * T, 0, 0, Math.PI * 2);
        else ctx.rect((u - r) * T, sy - r * T, (2 * r + 1) * T, (2 * r + 1) * T);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // The cell, and a pin over it with its icon.
      ctx.fillStyle = `${M.color}33`;
      ctx.fillRect(u * T, sy, T, T);
      ctx.strokeStyle = M.color;
      ctx.lineWidth = (on ? 2 : 1) / this.zoom;
      ctx.strokeRect(u * T, sy, T, T);
      const px = u * T + 8;
      const py = sy - 9;
      ctx.fillStyle = on ? '#ffffff' : M.color;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px - 3, py + 5);
      ctx.lineTo(px + 3, py + 5);
      ctx.lineTo(px, py + 10);
      ctx.fill();
      ctx.fillStyle = '#1a1220';
      const bits = iconBits(M.icon);
      for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) if (bits[r][c] === '#') ctx.fillRect(px - 4 + c * 0.66, py - 4 + r * 0.66, 0.7, 0.7);
      ctx.globalAlpha = 1;
      this.pins.push({ m, x: px, y: py });
    }
  }

  // ------------------------------------------------------------ pointer
  toWorld(e) {
    const r = this.cv.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    return { mx, my, wx: (mx - this.pan.x) / this.zoom, wy: (my - this.pan.y) / this.zoom };
  }

  cellAt(p, clamp = false) {
    return pickCell(this.vox(), p.wx, p.wy, this.layer, this.view.rot, clamp);
  }

  pickAt(p) {
    if (!p) return null;
    return pickBlock(this.app, this.vox(), p.wx, p.wy, { rot: this.view.rot, layer: this.layer, above: this.view.above });
  }

  pinAt(p) {
    for (const q of [...(this.pins || [])].reverse()) if (Math.hypot(p.wx - q.x, p.wy - q.y) <= 8) return q.m;
    return null;
  }

  bindCanvas() {
    const cv = this.cv;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.shiftKey) {
        this.setLayer(this.layer + (e.deltaY < 0 || e.deltaX < 0 ? 1 : -1));
        return;
      }
      const p = this.toWorld(e);
      this.zoomBy(e.deltaY < 0 ? 1 : -1, p.mx, p.my);
    }, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const p = this.toWorld(e);
      this.mouse = p;
      if (e.button === 1 || this.spaceDown || this.tool === 'hand') {
        this.panning = { x: p.mx, y: p.my, px: this.pan.x, py: this.pan.y };
        return;
      }
      if (e.altKey && e.button === 0) {
        this.pickUp(p, e.shiftKey);
        return;
      }
      this.begin(p, e);
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.toWorld(e);
      this.mouse = p;
      if (this.panning) {
        this.pan.x = this.panning.px + p.mx - this.panning.x;
        this.pan.y = this.panning.py + p.my - this.panning.y;
        this.dirtyView = true;
        return;
      }
      const c = this.cellAt(p);
      const was = this.hover;
      this.hover = c;
      if (this.dragging) this.drag(p, e);
      else if (this.float && this.float.follow) this.moveFloat(p);
      if (!was || !c || was.x !== c.x || was.z !== c.z || this.tool === 'pick') this.dirtyView = true;
      this.updateHud();
    });
    const up = (e) => {
      if (this.panning) {
        this.panning = null;
        return;
      }
      if (this.dragging) this.end(this.toWorld(e), e);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => {
      this.hover = null;
      this.dirtyView = true;
    });
    // Things dropped on it: a structure (pasted in), a mod block (to build with).
    dropTarget(this.wrap, (q) => q.kind === 'structures' || (q.kind === 'entities' && q.tpl === 'tpl.block'), (q, e) => {
      if (q.kind === 'entities') {
        this.useBlock(`@${q.id}`);
        toast(`Building with ${q.name}.`);
        return;
      }
      const other = this.app.mod.structures[q.id];
      if (!other || q.id === this.id) return;
      const bp = new Blueprint(JSON.parse(JSON.stringify(other)));
      const cells = [];
      for (let y = 0; y < bp.h; y++) for (let z = 0; z < bp.d; z++) for (let x = 0; x < bp.w; x++) {
        const c = bp.get(x, y, z);
        if (c) cells.push([x, y - bp.ground, z, c[0], c[1]]);
      }
      this.setTool('select');
      this.float = { cells, w: bp.w, d: bp.d, follow: true, x: 0, z: 0, marks: (other.marks || []).map((m) => ({ ...m, y: m.y - bp.ground })) };
      this.measureFloat();
      if (e) this.moveFloat(this.toWorld(e));
      else this.showFloat();
      toast(`"${other.name}" is following the pointer: click to put it down.`);
    });
  }

  updateHud() {
    if (!this.hud) return;
    const c = this.hover;
    const st = this.st;
    const g = st.ground;
    const where = this.layer === g ? 'the ground' : this.layer < g ? `${g - this.layer} below ground` : `${this.layer - g} up`;
    this.hud.textContent = `${c ? `x ${c.x} · z ${c.z} · ` : ''}layer ${this.layer} (${where})`;
    const here = c ? this.bp.get(c.x, this.layer, c.z) : null;
    this.hudR.textContent = here ? `Here: ${this.blockLabel(here[0])}` : `Building with ${this.blockLabel(this.block)}`;
  }

  blockLabel(ref) {
    if (!ref) return '';
    if (ref[0] === '@') {
      const e = this.app.mod.entities[ref.slice(1)];
      return e ? e.name : `${ref} (deleted)`;
    }
    if (ref === 'air') return 'Air (cleared)';
    return blockName(ref);
  }

  pickUp(p, andLayer) {
    const b = this.pickAt(p);
    if (!b) return;
    const c = this.bp.get(b.x, b.y, b.z);
    if (!c) return;
    this.useBlock(c[0], c[1]);
    if (andLayer) this.setLayer(b.y);
  }

  brushCells(x, z) {
    const n = this.o.size;
    const out = [];
    const a = Math.floor((n - 1) / 2);
    for (let dz = -a; dz < n - a; dz++) for (let dx = -a; dx < n - a; dx++) {
      if (this.o.round && n > 2 && Math.hypot(dx + (n % 2 ? 0 : 0.5), dz + (n % 2 ? 0 : 0.5)) > n / 2) continue;
      out.push([x + dx, z + dz]);
    }
    return out;
  }

  // What a shape tool puts down (into `this.over`, to be seen before it's
  // let go).
  grid(over) {
    const bp = this.bp;
    if (!over) return bp;
    return {
      w: bp.w, d: bp.d, h: bp.h, ground: bp.ground,
      get: (x, y, z) => {
        const k = `${x},${y},${z}`;
        return this.over.has(k) ? this.over.get(k) : bp.get(x, y, z);
      },
      set: (x, y, z, ref, meta = 0) => {
        if (x < 0 || z < 0 || y < 0 || x >= bp.w || z >= bp.d || y >= bp.h) return;
        this.over.set(`${x},${y},${z}`, !ref || ref === 'keep' ? null : [ref, meta | 0]);
      },
    };
  }

  applyOver() {
    for (const [k, v] of this.over) {
      const [x, y, z] = k.split(',').map(Number);
      this.bp.set(x, y, z, v ? v[0] : null, v ? v[1] : 0);
    }
    this.over.clear();
  }

  begin(p, e) {
    const t = this.tool;
    const c = this.cellAt(p, ['rect', 'ellipse', 'walls', 'room', 'roof', 'line', 'stairs', 'select'].includes(t));
    // A marker's pin, whatever the tool: chosen.
    const pin = this.pinAt(p);
    if (pin && t !== 'brush' && t !== 'erase') {
      this.chooseMark(pin.id);
      if (t === 'mark') this.dragging = { kind: 'markmove', id: pin.id, moved: false };
      return;
    }
    if (t === 'pick') return this.pickUp(p, e.shiftKey);
    if (this.float) {
      if (this.float.follow || !this.inFloat(c)) {
        this.dropFloat();
        return;
      }
      this.dragging = { kind: 'floatmove', from: c, at: { x: this.float.x, z: this.float.z } };
      return;
    }
    if (!c) return;
    const erase = t === 'erase' || (t === 'brush' && e.button === 2);
    if (t === 'brush' || t === 'erase') {
      this.before();
      this.dragging = { kind: 'paint', erase, last: c };
      this.paint(c.x, c.z, erase);
      this.changed({ panels: false });
      return;
    }
    if (t === 'fill') {
      this.before();
      const ref = e.button === 2 ? null : this.block;
      if (this.o.all) {
        const k0 = this.bp.get(c.x, this.layer, c.z);
        for (let z = 0; z < this.st.d; z++) for (let x = 0; x < this.st.w; x++) {
          const k = this.bp.get(x, this.layer, z);
          if ((!k && !k0) || (k && k0 && k[0] === k0[0])) this.bp.set(x, this.layer, z, ref, this.meta);
        }
      } else OPS.flood(this.bp, c.x, this.layer, c.z, ref, this.meta);
      this.changed();
      return;
    }
    if (t === 'pillar') {
      this.before();
      OPS.pillar(this.bp, c.x, c.z, this.layer, Math.max(1, this.o.height), e.button === 2 ? null : this.block, this.meta);
      this.changed();
      return;
    }
    if (t === 'mark') {
      const at = this.st.marks.find((m) => m.x === c.x && m.z === c.z && m.y === this.layer);
      if (at) {
        this.chooseMark(at.id);
        this.dragging = { kind: 'markmove', id: at.id, moved: false };
        return;
      }
      this.addMark(this.o.markType, c.x, this.layer, c.z);
      return;
    }
    if (t === 'select') {
      if (this.sel && this.inSel(c) && !e.shiftKey) {
        // Dragging what's selected: lifted, and moved.
        this.lift(true);
        this.dragging = { kind: 'floatmove', from: c, at: { x: this.float.x, z: this.float.z } };
        return;
      }
      this.dragging = { kind: 'select', a: c };
      this.dragBox = this.boxOf(c, c);
      this.dirtyView = true;
      return;
    }
    // The shapes: seen as they're dragged, put down when let go.
    this.dragging = { kind: 'shape', a: c, shift: e.shiftKey, erase: e.button === 2 };
    this.shape(c, e.shiftKey);
  }

  drag(p, e) {
    const D = this.dragging;
    const clamp = D.kind !== 'paint';
    const c = this.cellAt(p, clamp);
    if (!c) return;
    if (D.kind === 'paint') {
      // (Every cell between this and the last, so fast strokes leave no gaps.)
      const n = Math.max(Math.abs(c.x - D.last.x), Math.abs(c.z - D.last.z));
      for (let i = 1; i <= n; i++) this.paint(Math.round(D.last.x + ((c.x - D.last.x) * i) / n), Math.round(D.last.z + ((c.z - D.last.z) * i) / n), D.erase);
      D.last = c;
      this.dirtyView = true;
      return;
    }
    if (D.kind === 'shape') {
      D.shift = e.shiftKey;
      this.shape(c, e.shiftKey);
      return;
    }
    if (D.kind === 'select') {
      this.dragBox = this.boxOf(D.a, c);
      this.dirtyView = true;
      return;
    }
    if (D.kind === 'floatmove') {
      this.float.x = D.at.x + (c.x - D.from.x);
      this.float.z = D.at.z + (c.z - D.from.z);
      this.showFloat();
      return;
    }
    if (D.kind === 'markmove') {
      const m = this.st.marks.find((q) => q.id === D.id);
      if (!m || (m.x === c.x && m.z === c.z && m.y === this.layer)) return;
      if (!D.moved) this.app.checkpoint('structures', this.id);
      D.moved = true;
      m.x = c.x;
      m.z = c.z;
      m.y = this.layer;
      this.dirtyView = true;
    }
  }

  end(p, e) {
    const D = this.dragging;
    this.dragging = null;
    if (D.kind === 'paint') {
      this.changed();
      return;
    }
    if (D.kind === 'shape') {
      this.before();
      this.applyOver();
      this.changed();
      return;
    }
    if (D.kind === 'select') {
      this.sel = this.dragBox;
      this.dragBox = null;
      this.drawSel();
      this.dirtyView = true;
      return;
    }
    if (D.kind === 'floatmove') {
      this.dirtyView = true;
      return;
    }
    if (D.kind === 'markmove' && D.moved) {
      this.app.touch('structures', this.id);
      this.drawMarks();
    }
    void p;
    void e;
  }

  paint(x0, z0, erase) {
    const tall = Math.max(1, this.o.tall);
    for (const [x, z] of this.brushCells(x0, z0)) for (let k = 0; k < tall; k++) this.bp.set(x, this.layer + k, z, erase ? null : this.block, this.meta);
  }

  // A shape from cell a to cell b, into `over`.
  shape(b, shift) {
    const a = this.dragging.a;
    const g = this.grid(true);
    const y = this.layer;
    const o = this.o;
    const ref = this.dragging.erase ? null : this.block;
    this.over.clear();
    const tall = Math.max(1, o.tall);
    switch (this.tool) {
      case 'line':
        for (let k = 0; k < tall; k++) OPS.line(g, a.x, a.z, b.x, b.z, y + k, ref, this.meta);
        break;
      case 'rect':
        for (let k = 0; k < tall; k++) OPS.rect(g, a.x, a.z, b.x, b.z, y + k, ref, this.meta, shift);
        break;
      case 'ellipse':
        for (let k = 0; k < tall; k++) OPS.ellipse(g, a.x, a.z, b.x, b.z, y + k, ref, this.meta, !shift);
        break;
      case 'walls':
        OPS.walls(g, a.x, a.z, b.x, b.z, y, Math.max(1, o.height), { wall: ref || 'keep', corner: o.cornerOwn ? o.corner : ref, door: o.door, windows: o.windows, glass: o.glass, hollow: false });
        break;
      case 'room':
        OPS.room(g, a.x, a.z, b.x, b.z, y, { floor: o.floor, wall: o.wall, corner: o.cornerOwn ? o.corner : o.wall, roof: o.roof, style: o.style, height: o.height, door: o.door, windows: o.windows, glass: o.glass, parapet: o.parapet });
        break;
      case 'roof':
        OPS.roof(g, a.x, a.z, b.x, b.z, y, { roof: o.roof, style: o.style === 'none' ? 'gable' : o.style, wall: this.block, parapet: o.parapet });
        break;
      case 'stairs':
        OPS.steps(g, a.x, a.z, b.x, b.z, y, ref, Math.max(1, o.width));
        break;
      default:
    }
    this.dragBox = this.boxOf(a, b);
    this.dirtyView = true;
  }

  boxOf(a, b) {
    const t = this.tool === 'select' && this.o.through;
    return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), y0: t ? 0 : this.layer, y1: t ? this.st.h - 1 : this.layer };
  }

  // ------------------------------------------------------------ selection
  inSel(c) {
    const s = this.sel;
    return !!(c && s && c.x >= s.x0 && c.x <= s.x1 && c.z >= s.z0 && c.z <= s.z1);
  }

  inFloat(c) {
    const f = this.float;
    return !!(c && f && c.x >= f.x && c.x < f.x + f.w && c.z >= f.z && c.z < f.z + f.d);
  }

  floatBox() {
    const f = this.float;
    return { x0: f.x, z0: f.z, x1: f.x + f.w - 1, z1: f.z + f.d - 1, y0: Math.max(0, f.y + f.minY), y1: Math.min(this.st.h - 1, f.y + f.maxY) };
  }

  // What's selected, as a lump of cells: [[dx, dy, dz, ref, meta]].
  selCells() {
    const s = this.sel;
    const cells = [];
    for (let y = s.y0; y <= s.y1; y++) for (let z = s.z0; z <= s.z1; z++) for (let x = s.x0; x <= s.x1; x++) {
      const c = this.bp.get(x, y, z);
      if (c) cells.push([x - s.x0, y, z - s.z0, c[0], c[1]]);
    }
    const marks = (this.st.marks || []).filter((m) => m.x >= s.x0 && m.x <= s.x1 && m.z >= s.z0 && m.z <= s.z1 && m.y >= s.y0 && m.y <= s.y1).map((m) => ({ ...m, x: m.x - s.x0, z: m.z - s.z0 }));
    return { cells, marks, w: s.x1 - s.x0 + 1, d: s.z1 - s.z0 + 1 };
  }

  clearSel() {
    const s = this.sel;
    for (let y = s.y0; y <= s.y1; y++) for (let z = s.z0; z <= s.z1; z++) for (let x = s.x0; x <= s.x1; x++) this.bp.set(x, y, z, null);
    this.st.marks = this.st.marks.filter((m) => !(m.x >= s.x0 && m.x <= s.x1 && m.z >= s.z0 && m.z <= s.z1 && m.y >= s.y0 && m.y <= s.y1));
  }

  // The selection lifted up to be moved (`cut`: gone from where it was).
  lift(cut) {
    if (!this.sel) return;
    this.before();
    const q = this.selCells();
    // (Layers kept as they are: a lifted lump is put down at the same
    // heights, wherever across it goes.)
    this.float = { cells: q.cells.map(([x, y, z, r, m]) => [x, y, z, r, m]), marks: q.marks, w: q.w, d: q.d, x: this.sel.x0, z: this.sel.z0, y: 0, abs: true };
    this.measureFloat();
    if (cut) this.clearSel();
    this.sel = null;
    this.showFloat();
    this.drawSel();
  }

  measureFloat() {
    const f = this.float;
    f.minY = Math.min(0, ...f.cells.map((c) => c[1]));
    f.maxY = Math.max(0, ...f.cells.map((c) => c[1]));
  }

  showFloat() {
    const f = this.float;
    this.over.clear();
    if (!f) return;
    const base = f.abs ? 0 : this.layer;
    f.y = base;
    for (const [x, y, z, r, m] of f.cells) {
      const X = f.x + x;
      const Y = base + y;
      const Z = f.z + z;
      if (X < 0 || Z < 0 || Y < 0 || X >= this.st.w || Z >= this.st.d || Y >= this.st.h) continue;
      this.over.set(`${X},${Y},${Z}`, [r, m]);
    }
    this.dirtyView = true;
    this.app.hint(this.hintText());
  }

  moveFloat(p) {
    const c = this.cellAt(p, true);
    if (!c || !this.float) return;
    this.float.x = c.x - Math.floor(this.float.w / 2);
    this.float.z = c.z - Math.floor(this.float.d / 2);
    this.showFloat();
  }

  dropFloat() {
    const f = this.float;
    if (!f) return;
    if (f.follow || !f.abs) this.before();
    this.showFloat();
    this.applyOver();
    const base = f.abs ? 0 : this.layer;
    let n = this.st.marks.length;
    for (const m of f.marks || []) {
      const X = f.x + m.x;
      const Y = base + m.y;
      const Z = f.z + m.z;
      if (X < 0 || Z < 0 || Y < 0 || X >= this.st.w || Z >= this.st.d || Y >= this.st.h) continue;
      let id = m.id;
      while (this.st.marks.some((q) => q.id === id)) id = `k${++n}`;
      this.st.marks.push({ ...m, id, x: X, y: Y, z: Z });
    }
    this.sel = { ...this.floatBox() };
    this.float = null;
    this.changed({ marks: true });
    this.drawSel();
    this.app.hint(this.hintText());
  }

  cancelFloat() {
    if (!this.float) return;
    const f = this.float;
    this.float = null;
    this.over.clear();
    // (Lifted from here: put back as it was.)
    if (f.abs && !f.follow) this.app.undo();
    this.dirtyView = true;
    this.app.hint(this.hintText());
  }

  // Turned a quarter (clockwise from above), or mirrored left to right.
  turnFloat(mirror = false) {
    if (!this.float) {
      if (!this.sel) return;
      this.lift(true);
    }
    const f = this.float;
    if (mirror) f.cells = f.cells.map(([x, y, z, r, m]) => [f.w - 1 - x, y, z, r, mirrorRef(r, m)]);
    else {
      f.cells = f.cells.map(([x, y, z, r, m]) => [f.d - 1 - z, y, x, r, turnRef(r, m, 1)]);
      f.marks = (f.marks || []).map((m) => ({ ...m, x: f.d - 1 - m.z, z: m.x }));
      const cx = f.x + f.w / 2;
      const cz = f.z + f.d / 2;
      [f.w, f.d] = [f.d, f.w];
      f.x = Math.round(cx - f.w / 2);
      f.z = Math.round(cz - f.d / 2);
    }
    if (mirror) f.marks = (f.marks || []).map((m) => ({ ...m, x: f.w - 1 - m.x }));
    this.showFloat();
  }

  copy(cut) {
    if (!this.sel) return;
    const q = this.selCells();
    const y0 = this.sel.y0;
    clipboard = { cells: q.cells.map(([x, y, z, r, m]) => [x, y - y0, z, r, m]), marks: q.marks.map((m) => ({ ...m, y: m.y - y0 })), w: q.w, d: q.d, mod: this.app.mod.id };
    if (cut) {
      this.before();
      this.clearSel();
      this.changed({ marks: true });
    }
    toast(cut ? 'Cut.' : 'Copied (it can be pasted into another structure too).');
  }

  paste() {
    if (!clipboard) return toast('Nothing copied yet.');
    this.setTool('select');
    this.float = { cells: clipboard.cells.map((c) => [...c]), marks: (clipboard.marks || []).map((m) => ({ ...m })), w: clipboard.w, d: clipboard.d, follow: true, x: 0, z: 0 };
    this.measureFloat();
    if (this.mouse) this.moveFloat(this.mouse);
    else this.showFloat();
  }

  selectAll() {
    this.setTool('select');
    this.sel = { x0: 0, z0: 0, x1: this.st.w - 1, z1: this.st.d - 1, y0: 0, y1: this.st.h - 1 };
    this.drawSel();
    this.dirtyView = true;
  }

  deleteSel() {
    if (!this.sel) return false;
    this.before();
    this.clearSel();
    this.changed({ marks: true });
    return true;
  }

  fillSel(ref) {
    if (!this.sel) return;
    this.before();
    const s = this.sel;
    for (let y = s.y0; y <= s.y1; y++) for (let z = s.z0; z <= s.z1; z++) for (let x = s.x0; x <= s.x1; x++) this.bp.set(x, y, z, ref, this.meta);
    this.changed();
  }

  // Every block of one kind (in the selection, or everywhere) made another.
  replace(from, to, toMeta = 0, inSel = true) {
    this.before();
    const s = inSel && this.sel ? this.sel : { x0: 0, z0: 0, y0: 0, x1: this.st.w - 1, z1: this.st.d - 1, y1: this.st.h - 1 };
    let n = 0;
    for (let y = s.y0; y <= s.y1; y++) for (let z = s.z0; z <= s.z1; z++) for (let x = s.x0; x <= s.x1; x++) {
      const c = this.bp.get(x, y, z);
      if (!c || c[0] !== from) continue;
      this.bp.set(x, y, z, to, to === from ? c[1] : B[to] !== undefined && BLOCKS[B[to]].rotatable ? c[1] & META_ROT : toMeta);
      n++;
    }
    this.changed();
    toast(`${n} block${n === 1 ? '' : 's'} changed.`);
  }

  // ------------------------------------------------------------ markers
  addMark(type, x, y, z, extra = {}) {
    this.app.checkpoint('structures', this.id);
    this.flush();
    const st = this.st;
    if (type === 'entry') st.marks = st.marks.filter((m) => m.type !== 'entry');
    if (type === 'up') st.marks = st.marks.filter((m) => m.type !== 'up');
    let n = st.marks.length + 1;
    while (st.marks.some((m) => m.id === `k${n}`)) n++;
    const m = { id: `k${n}`, type, x, y, z, ...markDefaults(type), ...extra };
    st.marks.push(m);
    // (A chest marker wants a chest; a sign, a sign.)
    const here = this.bp.get(x, y, z);
    const isBox = here && B[here[0]] !== undefined && BLOCKS[B[here[0]]].interact === 'container';
    if (type === 'chest' && !isBox && !(here && here[0][0] === '@')) this.bp.set(x, y, z, 'chest', 2);
    if (type === 'sign' && !(here && (here[0] === 'sign' || here[0] === 'hanging_sign'))) this.bp.set(x, y, z, 'sign', 2);
    this.markSel = m.id;
    this.changed({ marks: true });
    this.drawMarks();
    return m;
  }

  chooseMark(id) {
    this.markSel = id;
    const m = this.st.marks.find((q) => q.id === id);
    if (m && m.y !== this.layer) this.setLayer(m.y);
    this.drawMarks();
    this.dirtyView = true;
  }

  deleteMark(id) {
    this.app.checkpoint('structures', this.id);
    this.st.marks = this.st.marks.filter((m) => m.id !== id);
    if (this.markSel === id) this.markSel = null;
    this.app.touch('structures', this.id);
    this.drawMarks();
    this.dirtyView = true;
  }

  drawMarks() {
    if (!this.marksPanel) return;
    const body = this.marksPanel.body;
    clear(body);
    const app = this.app;
    const st = this.st;
    // What kind of marker the tool puts down.
    const types = h('div', { class: 'palette-strip', style: { marginBottom: '8px' } });
    for (const [k, M] of Object.entries(MARKS)) {
      const b = h('div', { class: `blockbtn${this.o.markType === k ? ' on' : ''}`, 'data-tip': `${M.name}: ${M.tip}`, style: { width: '34px', height: '34px', color: M.color } }, ic(M.icon, 16));
      b.addEventListener('click', () => {
        this.o.markType = k;
        this.setTool('mark');
        this.drawMarks();
      });
      types.append(b);
    }
    body.append(h('div', { class: 'note' }, 'Put down with the marker tool (K):'), types);
    const list = h('div', { class: 'list' });
    for (const m of st.marks) {
      const M = MARKS[m.type] || MARKS.trigger;
      const del = button(null, { icon: 'trash', small: true, kind: 'ghost', title: 'Take it away', onClick: (e) => {
        e.stopPropagation();
        this.deleteMark(m.id);
      } });
      const li = h('div', { class: `li${m.id === this.markSel ? ' on' : ''}` }, h('span', { style: { color: M.color } }, ic(M.icon)), h('span', { style: { flex: 1 } }, markLabel(app, m)), h('span', { class: 'note' }, `${m.x},${m.y},${m.z}`), del);
      li.addEventListener('click', () => this.chooseMark(m.id));
      list.append(li);
    }
    if (!st.marks.length) list.append(h('div', { class: 'note' }, 'No markers yet. Chests and their loot, triggers, creatures and people are all markers.'));
    body.append(list);
    const m = st.marks.find((q) => q.id === this.markSel);
    if (m) body.append(h('div', { class: 'hr' }), this.markForm(m));
  }

  // A marker's settings.
  markForm(m) {
    const app = this.app;
    const M = MARKS[m.type];
    const set = (k, v, redraw = false) => {
      app.checkpoint('structures', this.id);
      if (v === null || v === undefined || v === '') delete m[k];
      else m[k] = v;
      app.touch('structures', this.id);
      this.dirtyView = true;
      if (redraw) this.drawMarks();
    };
    const f = h('div', { class: 'mark-form' });
    f.append(h('div', { class: 'row', style: { alignItems: 'center', marginBottom: '6px' } }, h('span', { style: { color: M.color } }, ic(M.icon, 14)), h('b', null, M.name), h('span', { class: 'grow' }), button('Remove', { icon: 'trash', small: true, kind: 'ghost', onClick: () => this.deleteMark(m.id) })));
    f.append(h('div', { class: 'note', style: { marginBottom: '8px' } }, M.tip));
    const num = (k, label, def, min, max, tip) => field(label, numberInput({ value: m[k] ?? def, min, max, int: true, onChange: (v) => set(k, v) }), { tip });
    const creature = (label, tip) => field(label, refPicker(app, 'creature', m.creature || null, (v) => set('creature', v, true), { tip, create: () => app.newEntity(m.type === 'boss' ? 'tpl.boss' : m.type === 'npc' ? 'tpl.npc' : 'tpl.hostile') }), { tip });
    if (m.type === 'chest') {
      f.append(field('Loot', refPicker(app, 'loot', m.loot || null, (v) => set('loot', v, true), { none: 'Nothing (empty)', create: async () => {
        const id = await app.create('loot', { name: `${this.st.name} loot` }, { open: false });
        set('loot', id, true);
        toast('A new loot table: open it (the arrow) to fill it.', 'good');
      } }), { tip: 'What it\'s filled with, the first time it\'s opened.' }));
      const here = this.bp.get(m.x, m.y, m.z);
      f.append(field('Block', seg([['chest', 'Chest'], ['barrel', 'Barrel'], ['crate', 'Crate']], here ? here[0] : 'chest', (v) => {
        this.before();
        this.bp.set(m.x, m.y, m.z, v, v === 'chest' ? 2 : 0);
        this.changed();
      })));
    } else if (m.type === 'trigger') {
      f.append(field('Reach', slider({ value: m.r ?? 3, min: 1, max: 12, int: true, onChange: (v) => set('r', v) }), { tip: 'How near (in blocks) someone must come.' }));
      f.append(check('Only the first time', !!m.once, (v) => set('once', v || null), { tip: 'Otherwise it happens again each time someone walks away and comes back.' }));
      f.append(field('Words', textInput({ long: true, value: m.message || '', placeholder: 'What the player reads (on screen)', onChange: (v) => set('message', v.slice(0, 300)) }), { wide: true }));
      f.append(field('Colour', colorButton(m.color || '#ffe070', (v) => set('color', v))));
      f.append(field('Sound', soundPicker(SOUNDS, m.sound || '', (v) => set('sound', v || null), { none: '(none)' })));
      f.append(field('Effect', refPicker(app, 'vfx', m.vfx || null, (v) => set('vfx', v)), { tip: 'An effect of yours, played there.' }));
      f.append(creature('Creatures', 'Brought out when it goes off.'));
      if (m.creature) f.append(num('count', 'How many', 1, 1, 8));
      f.append(field('Item', refPicker(app, 'item', m.item || null, (v) => set('item', v, true)), { tip: 'Given to whoever set it off.' }));
      if (m.item) f.append(num('itemCount', 'How many', 1, 1, 64));
      f.append(field('Event', textInput({ value: m.event || '', placeholder: 'an event name', onChange: (v) => set('event', v.trim().slice(0, 40)) }), { tip: 'Sends this event (On event nodes in your graphs hear it).' }));
      f.append(field('Story', refPicker(app, 'story', m.story || null, (v) => set('story', v)), { tip: 'Starts one of your stories.' }));
    } else if (m.type === 'spawn') {
      f.append(creature('Creature'));
      f.append(num('count', 'How many', 1, 1, 8));
      f.append(check('Come back after they\'re killed', !!m.respawn, (v) => set('respawn', v || null, true)));
      if (m.respawn) f.append(num('respawnMins', 'After (game minutes)', 300, 10, 100000, 'A game day is 1440 minutes.'));
    } else if (m.type === 'npc') {
      f.append(creature('Who', 'One of your people (made with the Person template), or any creature.'));
    } else if (m.type === 'boss') {
      f.append(creature('Boss', 'One of your bosses (or any creature: it fights as a master).'));
      f.append(field('Arena', slider({ value: m.r ?? 7, min: 4, max: 16, int: true, onChange: (v) => set('r', v) }), { tip: 'How far about it the fight is held (in a dungeon, the doors shut on it).' }));
    } else if (m.type === 'sign') {
      f.append(field('Title', textInput({ value: m.title || '', placeholder: 'SIGN', onChange: (v) => set('title', v.slice(0, 24)) })));
      f.append(field('Words', textInput({ long: true, value: m.text || '', onChange: (v) => set('text', v.slice(0, 400)) }), { wide: true }));
    } else if (m.type === 'up') {
      f.append(field('Facing', seg([[0, 'Back'], [1, 'Left'], [2, 'Front'], [3, 'Right']], m.rot ?? 2, (v) => set('rot', v))));
    }
    return f;
  }

  // ------------------------------------------------------------ the panels
  useBlock(ref, meta = 0) {
    this.block = ref;
    this.meta = meta;
    this.hot = [ref, ...this.hot.filter((q) => q !== ref)].slice(0, 9);
    if (!['brush', 'line', 'rect', 'ellipse', 'fill', 'pillar', 'stairs', 'walls'].includes(this.tool) && this.tool !== 'select') this.setTool('brush');
    this.drawBlock(false);
    this.drawHot();
    this.updateHud();
    this.dirtyView = true;
  }

  icon(ref, size = 32) {
    const k = `${ref}:${size}`;
    let src = this.icons.get(k);
    if (!src || ref[0] === '@') {
      src = blockIcon(this.app, ref, size);
      this.icons.set(k, src);
    }
    const c = canvas(size, size);
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  drawHot() {
    if (!this.hotEl) return;
    clear(this.hotEl);
    this.hot.forEach((ref, i) => {
      const b = h('div', { class: `blockbtn${ref === this.block ? ' on' : ''}`, 'data-tip': `${this.blockLabel(ref)} (${i + 1})` }, this.icon(ref), h('span', { class: 'mk', style: { color: 'var(--dim)', left: '3px', right: 'auto' } }, String(i + 1)));
      b.addEventListener('click', () => this.useBlock(ref));
      this.hotEl.append(b);
    });
    this.hotEl.append(h('span', { class: 'note', style: { marginLeft: '8px' } }, 'Blocks you\'ve used lately (1-9). Alt+click any block in the structure to build with it.'));
  }

  drawBlock(full = true) {
    const body = this.blockPanel.body;
    if (full || !this.blockHead) {
      clear(body);
      this.blockHead = h('div', { class: 'row', style: { alignItems: 'center', marginBottom: '8px' } });
      const q = textInput({ placeholder: 'Find a block...', value: this.find || '', onInput: (v) => {
        this.find = v;
        this.drawBlockGrid();
      } });
      this.groupEl = h('div', { class: 'chips', style: { marginBottom: '6px' } });
      this.gridEl = h('div', { class: 'palette-strip scroll', style: { maxHeight: '260px', overflow: 'auto' } });
      body.append(this.blockHead, q, this.groupEl, this.gridEl);
      this.drawGroups();
      this.drawBlockGrid();
      dropTarget(body, (p) => p.kind === 'entities' && p.tpl === 'tpl.block', (p) => this.useBlock(`@${p.id}`));
    }
    clear(this.blockHead);
    const ref = this.block;
    const b = B[ref] !== undefined ? BLOCKS[B[ref]] : null;
    const big = this.icon(ref, 48);
    big.style.width = '48px';
    big.style.height = '48px';
    big.style.imageRendering = 'pixelated';
    const info = h('div', { class: 'grow' }, h('div', { style: { fontWeight: 700 } }, this.blockLabel(ref)), h('div', { class: 'note' }, ref[0] === '@' ? 'One of this mod\'s blocks' : ref));
    const ctrls = h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } });
    if (b && b.rotatable) ctrls.append(button(`Turn ${['↑', '→', '↓', '←'][this.meta & 3]}`, { small: true, icon: 'rotate', title: 'Turn it (Q)', onClick: () => this.turnBlock() }));
    if (hasState(ref)) ctrls.append(check(ref.includes('door') ? 'Open' : 'Lit / other look', !!(this.meta & META_STATE), (v) => {
      this.meta = v ? this.meta | META_STATE : this.meta & ~META_STATE;
      this.drawBlock(false);
    }));
    if (ref[0] === '@') ctrls.append(button('Open', { small: true, icon: 'next', onClick: () => this.app.open('entities', ref.slice(1)) }));
    info.append(ctrls);
    this.blockHead.append(h('div', { class: 'blockbtn on', style: { width: '56px', height: '56px' } }, big), info);
  }

  turnBlock() {
    const b = B[this.block] !== undefined ? BLOCKS[B[this.block]] : null;
    if (!b || !b.rotatable) return;
    this.meta = (this.meta & ~META_ROT) | (((this.meta & META_ROT) + 1) & 3);
    this.drawBlock(false);
    this.dirtyView = true;
  }

  drawGroups() {
    clear(this.groupEl);
    const groups = ['This mod', 'Used here', ...Object.keys(blockGroups())];
    for (const g of groups) {
      const c = h('span', { class: `chip${g === this.group ? ' on' : ''}` }, g);
      c.addEventListener('click', () => {
        this.group = g;
        this.drawGroups();
        this.drawBlockGrid();
      });
      this.groupEl.append(c);
    }
  }

  drawBlockGrid() {
    const el = this.gridEl;
    clear(el);
    const f = (this.find || '').toLowerCase();
    let list;
    if (f) {
      const all = Object.values(blockGroups()).flat();
      list = [...modBlocks(this.app).map(([r]) => r), 'air', ...all].filter((r) => r.toLowerCase().includes(f) || this.blockLabel(r).toLowerCase().includes(f));
    } else if (this.group === 'This mod') list = modBlocks(this.app).map(([r]) => r);
    else if (this.group === 'Used here') list = this.bp ? [...this.bp.counts().keys()] : [];
    else list = [...(this.group === 'Ground' ? ['air'] : []), ...(blockGroups()[this.group] || [])];
    for (const ref of list.slice(0, 300)) {
      const b = h('div', { class: `blockbtn${ref === this.block ? ' on' : ''}`, 'data-tip': ref === 'air' ? 'Air: clears what\'s there (the ground, a hill, trees)' : this.blockLabel(ref) }, this.icon(ref));
      b.addEventListener('click', () => {
        this.useBlock(ref);
        for (const q of el.children) q.classList.remove('on');
        b.classList.add('on');
      });
      b.addEventListener('contextmenu', (e) => contextMenu(e, this.blockMenu(ref)));
      el.append(b);
    }
    if (!list.length) el.append(h('div', { class: 'note' }, this.group === 'This mod' ? 'No blocks of your own yet: make art in Pixel, then right-click it, "Make a block from it".' : 'None.'));
  }

  blockMenu(ref) {
    const items = [{ label: 'Build with it', icon: 'pencil', onClick: () => this.useBlock(ref) }];
    if (this.bp) {
      const n = this.bp.counts().get(ref) || 0;
      if (n && ref !== this.block) items.push({ label: `Change all ${n} into ${this.blockLabel(this.block)}`, icon: 'replace', onClick: () => this.replace(ref, this.block, this.meta, false) });
      if (n) items.push({ label: `Take all ${n} away`, icon: 'trash', danger: true, onClick: () => this.replace(ref, null, 0, false) });
    }
    if (ref[0] === '@') items.push({ label: 'Open it', icon: 'next', onClick: () => this.app.open('entities', ref.slice(1)) });
    return items;
  }

  drawUsed() {
    if (!this.usedPanel || !this.bp) return;
    const body = this.usedPanel.body;
    clear(body);
    const counts = [...this.bp.counts()].sort((a, b) => b[1] - a[1]);
    const list = h('div', { class: 'list' });
    for (const [ref, n] of counts) {
      const ico = this.icon(ref, 20);
      ico.style.width = '20px';
      ico.style.height = '20px';
      const li = h('div', { class: `li${ref === this.block ? ' on' : ''}` }, ico, h('span', { style: { flex: 1 } }, this.blockLabel(ref)), h('span', { class: 'note' }, String(n)));
      li.addEventListener('click', () => this.useBlock(ref));
      li.addEventListener('contextmenu', (e) => contextMenu(e, this.blockMenu(ref)));
      list.append(li);
    }
    if (!counts.length) list.append(h('div', { class: 'note' }, 'Nothing built yet.'));
    body.append(list, h('div', { class: 'note', style: { marginTop: '6px' } }, 'Right-click one to change all of it into another, or take it all away.'));
    if (this.group === 'Used here' && this.gridEl) this.drawBlockGrid();
  }

  drawOpts() {
    if (!this.optsPanel) return;
    const body = this.optsPanel.body;
    clear(body);
    const o = this.o;
    const t = this.tool;
    const name = (TOOLS.find((q) => q && q[0] === t) || [])[2] || '';
    body.append(h('div', { class: 'note', style: { marginBottom: '8px' } }, name));
    const blockField = (label, k, tip) => field(label, blockButton(this, o[k], (v) => {
      o[k] = v;
    }), { tip });
    if (t === 'brush' || t === 'erase') {
      body.append(field('Size', slider({ value: o.size, min: 1, max: 9, int: true, onChange: (v) => (o.size = v) })));
      body.append(check('Round', o.round, (v) => (o.round = v)));
    }
    if (['brush', 'erase', 'line', 'rect', 'ellipse'].includes(t)) body.append(field('Tall', slider({ value: o.tall, min: 1, max: 16, int: true, onChange: (v) => (o.tall = v) }), { tip: 'How many layers up from this one it fills (a line 3 tall is a wall).' }));
    if (t === 'fill') body.append(check('Every one on the layer (not just touching)', o.all, (v) => (o.all = v)));
    if (t === 'pillar' || t === 'walls' || t === 'room') body.append(field(t === 'room' ? 'Wall height' : 'Height', slider({ value: o.height, min: 1, max: 12, int: true, onChange: (v) => (o.height = v) })));
    if (t === 'walls' || t === 'room') {
      body.append(field('Door', seg(DOORS, o.door, (v) => (o.door = v)), { tip: 'Which side the door\'s in (front is the side toward you, seen from the south).' }));
      body.append(check('Windows', o.windows, (v) => (o.windows = v)));
      body.append(check('Corner posts of their own', o.cornerOwn, (v) => {
        o.cornerOwn = v;
        this.drawOpts();
      }));
      if (o.cornerOwn) body.append(blockField('Corners', 'corner'));
      if (o.windows) body.append(blockField('Windows of', 'glass'));
    }
    if (t === 'walls') body.append(h('div', { class: 'note' }, 'The walls are of the block you\'re building with.'));
    if (t === 'room') {
      body.append(blockField('Floor', 'floor'), blockField('Walls', 'wall'));
    }
    if (t === 'room' || t === 'roof') {
      body.append(field('Roof', seg(t === 'roof' ? ROOF_STYLES.filter((r) => r[0] !== 'none') : ROOF_STYLES, o.style, (v) => (o.style = v))));
      body.append(blockField('Roof of', 'roof'));
      body.append(check('A low wall round a flat roof', o.parapet, (v) => (o.parapet = v)));
      if (t === 'roof') body.append(h('div', { class: 'note' }, 'Its ends are walled up with the block you\'re building with.'));
    }
    if (t === 'stairs') body.append(field('Wide', slider({ value: o.width, min: 1, max: 5, int: true, onChange: (v) => (o.width = v) })));
    if (t === 'select') {
      body.append(check('Through every layer', o.through, (v) => {
        o.through = v;
        if (this.sel) {
          this.sel.y0 = v ? 0 : this.layer;
          this.sel.y1 = v ? this.st.h - 1 : this.layer;
          this.drawSel();
          this.dirtyView = true;
        }
      }, { tip: 'Otherwise just the layer you\'re on.' }));
      body.append(h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } }, button('All', { small: true, onClick: () => this.selectAll() }), button('Paste', { small: true, icon: 'copy', disabled: !clipboard, onClick: () => this.paste() })));
    }
    if (t === 'mark') body.append(h('div', { class: 'note' }, `Putting down: ${MARKS[o.markType].name}. Choose another under Markers.`));
  }

  drawSel() {
    if (!this.selPanel) return;
    const body = this.selPanel.body;
    clear(body);
    const s = this.sel;
    this.selPanel.style.display = s ? '' : 'none';
    if (!s) return;
    const n = this.selCells().cells.length;
    body.append(h('div', { class: 'note', style: { marginBottom: '6px' } }, `${s.x1 - s.x0 + 1}×${s.z1 - s.z0 + 1}, layers ${s.y0} to ${s.y1}: ${n} block${n === 1 ? '' : 's'}.`));
    const y0 = numberInput({ value: s.y0, min: 0, max: this.st.h - 1, int: true, onChange: (v) => {
      s.y0 = Math.min(v, s.y1);
      this.drawSel();
      this.dirtyView = true;
    } });
    const y1 = numberInput({ value: s.y1, min: 0, max: this.st.h - 1, int: true, onChange: (v) => {
      s.y1 = Math.max(v, s.y0);
      this.drawSel();
      this.dirtyView = true;
    } });
    body.append(h('div', { class: 'row' }, field('Layers from', y0), field('to', y1)));
    body.append(h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } },
      button('Copy', { small: true, icon: 'copy', onClick: () => this.copy(false) }),
      button('Cut', { small: true, icon: 'cut', onClick: () => this.copy(true) }),
      button('Turn', { small: true, icon: 'rotate', title: 'Shift+R', onClick: () => this.turnFloat(false) }),
      button('Mirror', { small: true, icon: 'flipH', title: 'Shift+H', onClick: () => this.turnFloat(true) }),
      button('Fill', { small: true, icon: 'bucket', title: 'With the block you\'re building with', onClick: () => this.fillSel(this.block) }),
      button('Clear', { small: true, icon: 'trash', title: 'Delete', onClick: () => this.deleteSel() }),
      button('Hollow', { small: true, icon: 'rect', title: 'Keep only the outside of it', onClick: () => this.hollowSel() })));
    // Replace one block with another, in it.
    const counts = new Map();
    for (const c of this.selCells().cells) counts.set(c[3], (counts.get(c[3]) || 0) + 1);
    if (counts.size) {
      let from = [...counts.keys()][0];
      body.append(h('div', { class: 'hr' }), field('Change', select([...counts].map(([r, k]) => [r, `${this.blockLabel(r)} (${k})`]), from, (v) => (from = v))), h('div', { class: 'row' }, h('span', { class: 'note' }, `into ${this.blockLabel(this.block)}`), button('Change', { small: true, icon: 'replace', onClick: () => this.replace(from, this.block, this.meta, true) })));
    }
  }

  hollowSel() {
    if (!this.sel) return;
    this.before();
    const s = this.sel;
    for (let y = s.y0 + 1; y < s.y1; y++) for (let z = s.z0 + 1; z < s.z1; z++) for (let x = s.x0 + 1; x < s.x1; x++) this.bp.set(x, y, z, 'air');
    this.changed();
  }

  drawStructure() {
    const body = this.stPanel.body;
    clear(body);
    const app = this.app;
    const st = this.st;
    st.place ||= { where: 'wild', biomes: [], count: 2, isle: 'any', clear: true };
    const P = st.place;
    const set = (fn, redraw = false) => {
      app.checkpoint('structures', this.id);
      fn();
      app.touch('structures', this.id);
      if (redraw) this.drawStructure();
    };
    body.append(h('div', { class: 'row', style: { alignItems: 'center' } }, h('span', { class: 'grow' }, `${st.w} across, ${st.d} deep, ${st.h} high`), button('Change size...', { small: true, onClick: () => this.resizeDialog() })));
    body.append(field('Ground layer', numberInput({ value: st.ground, min: 0, max: st.h - 1, int: true, onChange: (v) => set(() => {
      this.flush();
      st.ground = v;
      this.bp = new Blueprint(st);
      this.dirtyView = true;
      this.drawLayers();
    }) }), { tip: 'The layer that sits at grass level in the world. Layers under it are dug into the ground (cellars, crypts).' }));
    // Where it goes.
    const users = this.partOf();
    if (users.length) body.append(h('div', { class: 'note', style: { margin: '6px 0' } }, `Part of ${users.map((u) => `"${u}"`).join(', ')}: it's put in the world as that${P.where !== 'nowhere' && P.count ? ' (and on its own too, as set below)' : ''}.`));
    body.append(field('Where', select(WHERE, P.where || 'wild', (v) => set(() => (P.where = v), true)), { tip: 'Where in a new world it\'s put. "Nowhere on its own": only as part of a layout or a dungeon, or placed by a graph.' }));
    if (P.where !== 'nowhere') {
      body.append(field('How many', slider({ value: P.count ?? 2, min: 0, max: 12, int: true, onChange: (v) => set(() => (P.count = v)) }), { tip: 'How many of it in each world.' }));
      body.append(field('Island', select(ISLES, P.isle || 'any', (v) => set(() => (P.isle = v)))));
      body.append(field('Biomes', chips(biomeOptions(app), P.biomes || [], (v) => set(() => (P.biomes = v))), { wide: true, tip: 'None chosen: any.' }));
      body.append(check('Clear the ground over it (trees, hills)', P.clear !== false, (v) => set(() => (P.clear = v))));
    }
    body.append(h('div', { class: 'note', style: { marginTop: '8px' } }, 'Playtest (F5) puts it right in front of you, too.'));
  }

  partOf() {
    const m = this.app.mod;
    const out = [];
    for (const D of Object.values(m.dungeons || {})) if (D.entrance === this.id || (D.floors || []).includes(this.id)) out.push(D.name);
    for (const L of Object.values(m.layouts || {})) if ((L.pieces || []).some((p) => p.structure === this.id)) out.push(L.name);
    return out;
  }

  async resizeDialog() {
    const st = this.st;
    let W = st.w;
    let D = st.d;
    let H = st.h;
    let ax = 0.5;
    let az = 0.5;
    let below = 0;
    const anchor = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 26px)', gap: '3px' } });
    const drawA = () => {
      clear(anchor);
      for (const zz of [0, 0.5, 1]) for (const xx of [0, 0.5, 1]) {
        const b = h('button', { class: `btn small${ax === xx && az === zz ? ' on' : ''}`, type: 'button', style: { width: '26px', height: '22px', padding: 0 } }, ax === xx && az === zz ? ic('dot', 8) : '');
        b.addEventListener('click', () => {
          ax = xx;
          az = zz;
          drawA();
        });
        anchor.append(b);
      }
    };
    drawA();
    const v = await dialog({ title: 'Size', icon: 'rect', body: [
      h('div', { class: 'row' }, field('Across', numberInput({ value: W, min: 1, max: LIMITS.blueprintSide, int: true, onChange: (x) => (W = x) })), field('Deep', numberInput({ value: D, min: 1, max: LIMITS.blueprintSide, int: true, onChange: (x) => (D = x) })), field('High', numberInput({ value: H, min: 1, max: LIMITS.blueprintH, int: true, onChange: (x) => (H = x) }))),
      field('Keep it', anchor, { tip: 'Where what\'s built stays, in the new size (seen from above, the front at the bottom).' }),
      field('Layers added under it', numberInput({ value: 0, min: -st.h + 1, max: LIMITS.blueprintH, int: true, onChange: (x) => (below = x) }), { tip: 'To dig a cellar under it, say. Less than 0 takes layers away from the bottom.' }),
      h('div', { class: 'note' }, 'Anything outside the new size is lost (Undo brings it back).'),
    ], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Change', kind: 'primary', value: 'ok' }] });
    if (v !== 'ok') return;
    this.before();
    this.bp.resize(Math.max(1, Math.min(LIMITS.blueprintSide, W)), Math.max(1, Math.min(LIMITS.blueprintSide, D)), Math.max(1, Math.min(LIMITS.blueprintH, H + below)), ax, az, below);
    this.bp.flush();
    this.layer = Math.max(0, Math.min(this.st.h - 1, this.layer + below));
    this.sel = null;
    this.app.touch('structures', this.id);
    this.build();
  }

  // ------------------------------------------------------------ keys
  onKey(e) {
    if (this.sub) return this.sub.onKey?.(e) || false;
    if (!this.bp) return false;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) {
      const act = { KeyC: () => this.copy(false), KeyX: () => this.copy(true), KeyV: () => this.paste(), KeyA: () => this.selectAll(), KeyD: () => {
        this.sel = null;
        this.drawSel();
        this.dirtyView = true;
      } }[e.code];
      if (!act) return false;
      act();
      return true;
    }
    if (e.code === 'Space') {
      this.spaceDown = true;
      return true;
    }
    if (e.shiftKey && (e.code === 'KeyR' || e.code === 'KeyH')) {
      this.turnFloat(e.code === 'KeyH');
      return true;
    }
    if (e.code === 'KeyQ') {
      if (this.float) this.turnFloat(false);
      else this.turnBlock();
      return true;
    }
    if (KEYS[e.code] && !e.altKey) {
      this.setTool(KEYS[e.code]);
      return true;
    }
    if (/^Digit[1-9]$/.test(e.code)) {
      const r = this.hot[+e.code.slice(5) - 1];
      if (r) this.useBlock(r);
      return true;
    }
    switch (e.key) {
      case 'ArrowUp': case 'PageUp': this.setLayer(this.layer + 1); return true;
      case 'ArrowDown': case 'PageDown': this.setLayer(this.layer - 1); return true;
      case 'ArrowLeft': this.turnView(-1); return true;
      case 'ArrowRight': this.turnView(1); return true;
      case 'Home': this.setLayer(this.st.ground); return true;
      case '[': this.o.size = Math.max(1, this.o.size - 1); this.drawOpts(); return true;
      case ']': this.o.size = Math.min(9, this.o.size + 1); this.drawOpts(); return true;
      case '+': case '=': this.zoomBy(1); return true;
      case '-': case '_': this.zoomBy(-1); return true;
      case '0': this.fit(); return true;
      case 'x': case 'X': {
        const order = ['ghost', 'hide', 'show'];
        this.view.above = order[(order.indexOf(this.view.above) + 1) % 3];
        for (const b of this.aboveSeg.children) b.classList.toggle('on', b.textContent === { ghost: 'Fade above', hide: 'Hide above', show: 'Show all' }[this.view.above]);
        this.dirtyView = true;
        return true;
      }
      case 'Enter': if (this.float) this.dropFloat(); return true;
      case 'Escape':
        if (this.float) this.cancelFloat();
        else if (this.dragging) {
          this.dragging = null;
          this.over.clear();
          this.dragBox = null;
        } else if (this.sel) {
          this.sel = null;
          this.drawSel();
        } else if (this.markSel) {
          this.markSel = null;
          this.drawMarks();
        }
        this.dirtyView = true;
        return true;
      case 'Delete': case 'Backspace':
        if (this.sel) this.deleteSel();
        else if (this.markSel) this.deleteMark(this.markSel);
        return true;
      default:
    }
    return false;
  }
}

// What a new marker starts as.
function markDefaults(type) {
  return {
    chest: { loot: null }, trigger: { r: 3, once: true, message: 'Something stirs.' }, spawn: { creature: 'skeleton', count: 2 }, npc: { creature: null }, boss: { creature: null, r: 7 },
    sign: { title: 'SIGN', text: 'Here lies...' }, up: { rot: 2 }, down: {}, entry: {},
  }[type] || {};
}

export function markLabel(app, m) {
  const M = MARKS[m.type];
  const nm = (t, v) => {
    if (!v) return null;
    if (v[0] === '@') return app.mod.entities[v.slice(1)]?.name || '(deleted)';
    if (t === 'loot') return app.mod.loot[v]?.name || '(deleted)';
    return v.replace(/_/g, ' ');
  };
  if (m.type === 'chest') return `Chest: ${nm('loot', m.loot) || 'empty'}`;
  if (m.type === 'spawn') return `${m.count || 1}× ${nm('c', m.creature) || '(no creature)'}`;
  if (m.type === 'npc' || m.type === 'boss') return `${M.name}: ${nm('c', m.creature) || '(nobody yet)'}`;
  if (m.type === 'trigger') return `Trigger${m.message ? `: "${String(m.message).slice(0, 18)}${m.message.length > 18 ? '...' : ''}"` : ''}`;
  if (m.type === 'sign') return `Sign: ${m.title || ''}`;
  return M ? M.name : m.type;
}

// A button showing a block; click it for a list to choose another.
export function blockButton(tool, value, onChange) {
  const app = tool.app;
  let v = value;
  const el = h('div', { class: 'ref', 'data-tip': 'Click to choose a block (or drag one of your blocks here)' });
  const draw = () => {
    clear(el);
    const c = blockIcon(app, v, 20);
    el.append(h('span', { class: 'thumb' }, c), h('span', { class: 'nm' }, tool.blockLabel(v)));
    const use = h('span', { class: 'x', 'data-tip': 'The block you\'re building with' }, ic('picker', 9));
    use.addEventListener('click', (e) => {
      e.stopPropagation();
      v = tool.block;
      draw();
      onChange(v);
    });
    el.append(use);
  };
  draw();
  el.addEventListener('click', () => {
    const box = h('div', { style: { width: '300px' } });
    const q = textInput({ placeholder: 'Find a block...' });
    const grid = h('div', { class: 'palette-strip scroll', style: { maxHeight: '280px', overflow: 'auto', marginTop: '6px' } });
    const all = [...modBlocks(app).map(([r]) => r), 'air', ...Object.values(blockGroups()).flat()];
    const fill = () => {
      clear(grid);
      const f = q.value.toLowerCase();
      for (const r of all.filter((x) => !f || x.includes(f) || tool.blockLabel(x).toLowerCase().includes(f)).slice(0, 160)) {
        const b = h('div', { class: `blockbtn${r === v ? ' on' : ''}`, 'data-tip': tool.blockLabel(r) }, blockIcon(app, r, 32));
        b.addEventListener('click', () => {
          v = r;
          draw();
          onChange(v);
          closePopover();
        });
        grid.append(b);
      }
    };
    q.addEventListener('input', fill);
    box.append(q, grid);
    fill();
    popover(el, box);
    setTimeout(() => q.focus(), 10);
  });
  dropTarget(el, (p) => p.kind === 'entities' && p.tpl === 'tpl.block', (p) => {
    v = `@${p.id}`;
    draw();
    onChange(v);
  });
  return el;
}
