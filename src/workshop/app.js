// The Workshop (round 62): where mods are made. Opened from the title
// screen, it covers the game: on the left everything in the mod you're
// working on, in the middle the tool you're using on one of them, on the
// right that thing's settings. Ten tools:
//   Overview  the mod itself: its name, picture, what's in it, what's wrong
//   Pixel     pixel art (pictures for blocks, items, creatures, effects)
//   VFX       effects: particles and animated sprites
//   Rig       characters cut into parts on bones, moved by simulation
//   Builder   structures, layouts (towns, camps), dungeons and loot tables
//   Story     stories: new ones as graphs, and changes to the game's own
//   Graph     entities (blocks, items, creatures, effects, events) as
//             visual code
//   Biome     new biomes, and changes to the game's own (round 63)
//   World     the world's map: its lands, where biomes and towns go, set
//             places, realms and people (round 63)
//   Character the character screen's tabs (round 63)
// Everything's saved as you go (see ModLibrary). Anything in the explorer
// can be dragged onto any tool that can use it; right-click it for what
// else can be done with it.
import { h, ic, clear, button, field, textInput, colorButton, menu, contextMenu, dialog, confirm, prompt, toast, tooltips, splitter, dragSource, dropTarget, download, pickFile, readText, canvas, overlay, closeMenu, gesture } from './kit.js';
import { ensurePixelFont } from './pixfont.js';
import { newMod, freeId, modHash, exportMod, problems as modProblems, KIND_NAMES, COLLECTIONS, composite, cleanName, countThings, newAsset } from '../mod/format.js';
import { NODES, makeNode, emptyGraph, lint } from '../mod/graph.js';
import { TEMPLATES, TEMPLATE_INFO } from '../mod/nodes.js';
import { GAME_VERSION } from '../version.js';
import { starter } from './graph.js';
import { voxPicture, structVox, layoutVox } from './voxview.js';
import { VfxPlayer, newEffect, newLayer, EMITTER_PRESETS } from '../mod/vfx.js';
import { BIOMES } from '../world/biomes.js';
import { GAME_BIOMES, biomeFields } from '../mod/biomes.js';
import { biomeWhole } from './biomeview.js';
import { glyphCanvas } from './common.js';

// Which tool edits each collection.
export const TOOL_OF = { assets: 'pixel', vfx: 'vfx', rigs: 'rig', structures: 'builder', layouts: 'builder', dungeons: 'builder', loot: 'builder', stories: 'story', patches: 'story', entities: 'graph', biomes: 'biome', worlds: 'world', chargen: 'chargen' };
const TOOLS = [
  { id: 'overview', name: 'Overview', icon: 'home', key: '1', tip: 'The mod: its name, its picture, what\'s in it, and what\'s wrong with it.' },
  { id: 'pixel', name: 'Pixel', icon: 'pencil', key: '2', tip: 'Pixel art: textures, icons, creatures, animations.' },
  { id: 'vfx', name: 'VFX', icon: 'sparkle', key: '3', tip: 'Effects: particles, glows, animated sprites.' },
  { id: 'rig', name: 'Rig', icon: 'bone', key: '4', tip: 'Characters: cut art into parts on bones, and let it move.' },
  { id: 'builder', name: 'Builder', icon: 'house', key: '5', tip: 'Structures, towns, dungeons and loot tables.' },
  { id: 'story', name: 'Story', icon: 'scroll', key: '6', tip: 'Stories: new ones, and changes to the game\'s own.' },
  { id: 'graph', name: 'Graph', icon: 'node', key: '7', tip: 'Entities as visual code: blocks, items, creatures, effects, events.' },
  { id: 'biome', name: 'Biome', icon: 'tree', key: '8', tip: 'Biomes: new kinds of land, and changes to the game\'s own.' },
  { id: 'world', name: 'World', icon: 'globe', key: '9', tip: 'The world map: its lands, where biomes and towns go, set places, realms and people.' },
  { id: 'chargen', name: 'Character', icon: 'bust', key: '0', tip: 'The character screen: its tabs, new ones and changes to the game\'s.' },
];
const LOADERS = {
  overview: async () => ({ default: OverviewTool }),
  pixel: () => import('./pixel.js'),
  vfx: () => import('./vfx.js'),
  rig: () => import('./rig.js'),
  builder: () => import('./builder.js'),
  story: () => import('./story.js'),
  graph: () => import('./graph.js'),
  biome: () => import('./biome.js'),
  world: () => import('./world.js'),
  chargen: () => import('./chargen.js'),
};
// The explorer's sections, in order.
const SECTIONS = [
  { key: 'assets', name: 'Art', icon: 'pencil' },
  { key: 'vfx', name: 'Effects', icon: 'sparkle' },
  { key: 'rigs', name: 'Rigs', icon: 'bone' },
  { key: 'entities', name: 'Entities', icon: 'node' },
  { key: 'structures', name: 'Structures', icon: 'house' },
  { key: 'layouts', name: 'Layouts', icon: 'grid' },
  { key: 'dungeons', name: 'Dungeons', icon: 'stairs' },
  { key: 'loot', name: 'Loot tables', icon: 'chest' },
  { key: 'stories', name: 'Stories', icon: 'scroll' },
  { key: 'patches', name: 'Story changes', icon: 'book' },
  { key: 'biomes', name: 'Biomes', icon: 'tree' },
  { key: 'worlds', name: 'World maps', icon: 'globe' },
  { key: 'chargen', name: 'Character tabs', icon: 'bust' },
];

let cssDone = false;
function loadCss() {
  ensurePixelFont();
  if (cssDone) return;
  cssDone = true;
  document.head.append(h('link', { rel: 'stylesheet', href: new URL('./workshop.css', import.meta.url).href }));
}

// Open the Workshop. `o`: { library (ModLibrary), author (your name),
// onExit(), onPlaytest(mod), audio }. Returns the app.
export function openWorkshop(o) {
  loadCss();
  const app = new Workshop(o);
  app.mount();
  return app;
}

export class Workshop {
  constructor(o) {
    this.o = o;
    this.lib = o.library;
    this.mod = null;
    this.tool = null;
    this.toolId = 'overview';
    this.tools = {};
    this.sel = null; // { kind, id }
    this.history = new Map(); // `${kind}:${id}` -> { undo: [], redo: [] }
    this.saveT = null;
    this.saving = false;
    this.dirty = false;
    this.thumbs = new Map();
    this.closed = {};
    try {
      this.closed = JSON.parse(localStorage.getItem('ws-closed') || '{}');
    } catch {
      this.closed = {};
    }
  }

  // ------------------------------------------------------------ the frame
  mount() {
    this.root = h('div', { id: 'workshop' });
    document.body.append(this.root);
    tooltips(this.root);
    this.top = h('div', { class: 'ws-top' });
    this.explorer = h('aside', { class: 'ws-explorer' });
    this.stage = h('section', { class: 'ws-stage' });
    this.inspector = h('aside', { class: 'ws-inspector' });
    this.status = h('div', { class: 'ws-status' });
    const body = h('div', { class: 'ws-body' }, this.explorer, splitter(this.explorer, 'left', 'explorer'), this.stage, splitter(this.inspector, 'right', 'inspector'), this.inspector);
    this.root.append(this.top, body, this.status);
    this.keys = (e) => this.onKey(e);
    window.addEventListener('keydown', this.keys);
    this.beforeUnload = (e) => {
      if (this.dirty) {
        this.saveNow();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', this.beforeUnload);
    const last = (() => {
      try {
        return localStorage.getItem('ws-last-mod');
      } catch {
        return null;
      }
    })();
    if (this.o.openMod) {
      if (this.o.openSel) this.sel = this.o.openSel;
      this.openMod(this.o.openMod, this.o.openTool);
    }
    else if (last && this.lib.has(last)) this.openMod(last);
    else this.home();
  }

  async close() {
    await this.saveNow();
    this.tool?.unmount?.();
    window.removeEventListener('keydown', this.keys);
    window.removeEventListener('beforeunload', this.beforeUnload);
    closeMenu();
    overlay().remove();
    this.root.remove();
  }

  async exit() {
    await this.close();
    this.o.onExit?.();
  }

  hint(text) {
    this.hintEl.textContent = text || 'Drag anything from the explorer onto a tool. Right-click it for more. Press ? for shortcuts.';
  }

  // ------------------------------------------------------------ top bar
  drawTop() {
    clear(this.top);
    const brand = h('div', { class: 'ws-brand', 'data-tip': 'All your mods' }, h('span', { class: 'logo' }, ic('gear', 12)), 'WORKSHOP');
    brand.addEventListener('click', () => this.home());
    this.top.append(button(null, { icon: 'prev', kind: 'ghost', title: 'Back to the game\'s title screen', onClick: () => this.exit() }), brand);
    if (!this.mod) return;
    const m = this.mod;
    const pick = h('div', { class: 'ws-modpick', 'data-tip': 'Switch mod, or start another' }, h('span', { class: 'swatch', style: { background: m.color } }, this.modIcon(18)), h('span', { class: 'name' }, m.name), h('span', { class: 'ver' }, `v${m.version}`), ic('next', 8));
    pick.addEventListener('click', (e) => this.modMenu(e));
    this.top.append(pick);
    const tabs = h('div', { class: 'ws-tabs' });
    for (const t of TOOLS) {
      const tab = h('div', { class: `ws-tab${t.id === this.toolId ? ' on' : ''}`, 'data-tip': `${t.name}: ${t.tip}`, 'data-key': `Ctrl+${t.key}` }, ic(t.icon), h('span', { class: 'nm' }, t.name));
      tab.addEventListener('click', () => this.useTool(t.id));
      tabs.append(tab);
    }
    this.top.append(tabs);
    const acts = h('div', { class: 'ws-actions' },
      button(null, { icon: 'search', kind: 'ghost', title: 'Find anything in the mod', key: 'Ctrl+K', onClick: () => this.quickOpen() }),
      button(null, { icon: 'undo', kind: 'ghost', title: 'Undo', key: 'Ctrl+Z', onClick: () => this.undo() }),
      button(null, { icon: 'redo', kind: 'ghost', title: 'Redo', key: 'Ctrl+Y', onClick: () => this.redo() }),
      button('Export', { icon: 'export', title: 'Save the mod as a file to send to someone (.tmod)', onClick: () => this.exportMod() }),
      button('Playtest', { icon: 'play', kind: 'go', title: 'Try the mod out in a world of its own, then come back here', key: 'F5', onClick: () => this.playtest() }));
    this.top.append(acts);
  }

  modIcon(size) {
    const m = this.mod;
    if (m && m.icon && m.assets[m.icon]) {
      const c = this.assetCanvas(m.assets[m.icon], 0);
      c.style.width = `${size}px`;
      c.style.height = `${size}px`;
      return c;
    }
    return h('span', { style: { color: '#1a1008', fontWeight: 700, fontSize: `${Math.round(size * 0.6)}px` } }, (m ? m.name : '?').slice(0, 1).toUpperCase());
  }

  modMenu(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const items = [{ head: 'Your mods' }];
    for (const q of this.lib.list().slice(0, 12)) items.push({ label: `${q.name}  v${q.version}`, swatch: q.color, onClick: () => this.openMod(q.id), off: this.mod && q.id === this.mod.id });
    items.push({ sep: true }, { label: 'New mod...', icon: 'plus', onClick: () => this.newMod() }, { label: 'Import a mod file...', icon: 'import', onClick: () => this.importMod() }, { label: 'All mods', icon: 'home', onClick: () => this.home() });
    menu(items, r.left, r.bottom + 4);
  }

  // ------------------------------------------------------------ the mods
  async home() {
    await this.saveNow();
    this.tool?.unmount?.();
    this.tool = null;
    this.mod = null;
    this.sel = null;
    this.drawTop();
    clear(this.explorer);
    this.explorer.classList.add('hidden');
    this.inspector.classList.add('hidden');
    clear(this.stage);
    this.drawStatus();
    const wrap = h('div', { class: 'home scroll' });
    wrap.append(h('h1', null, 'Tessera Workshop'), h('div', { class: 'sub' }, 'Make mods for the game: draw pixel art, build structures and dungeons, write stories, and wire up blocks, items, creatures and bosses as visual code. Group it all into a mod, try it out with Playtest, and turn it on in any world you make (single player or multiplayer). Export a mod to send it to a friend; anyone joining a modded world you host can install its mods with one button.'));
    const cards = h('div', { class: 'cards' });
    const nw = h('div', { class: 'card new' }, ic('plus', 24), h('div', null, 'New mod'));
    nw.addEventListener('click', () => this.newMod());
    const im = h('div', { class: 'card new' }, ic('import', 24), h('div', null, 'Import a mod file (.tmod)'));
    im.addEventListener('click', () => this.importMod());
    cards.append(nw, im);
    const list = this.lib.list();
    for (const q of list) {
      const icon = h('div', { class: 'modicon', style: { background: q.color } }, h('b', { style: { color: '#1a1008', fontSize: '20px' } }, q.name.slice(0, 1).toUpperCase()));
      const card = h('div', { class: 'card' },
        h('div', { class: 't' }, icon, h('div', null, h('div', null, q.name), h('div', { class: 'note' }, `v${q.version} · by ${q.author}`))),
        h('div', { class: 'd' }, `${q.things || 0} things · ${Math.max(1, Math.round((q.size || 0) / 1024))} KB${q.from ? ` · from ${q.from}` : q.mine === false ? ' · imported' : ''}`),
        h('div', { class: 'm' }, `Changed ${ago(q.updated)}`));
      card.addEventListener('click', () => this.openMod(q.id));
      card.addEventListener('contextmenu', (e) => contextMenu(e, [
        { label: 'Open', icon: 'folder', onClick: () => this.openMod(q.id) },
        { label: 'Duplicate', icon: 'copy', onClick: () => this.duplicateMod(q.id) },
        { label: 'Export...', icon: 'export', onClick: async () => {
          const m = await this.lib.get(q.id);
          if (m) download(`${fileName(m.name)}.tmod`, exportMod(m));
        } },
        { sep: true },
        { label: 'Delete', icon: 'trash', danger: true, onClick: () => this.deleteMod(q.id, q.name) },
      ]));
      cards.append(card);
    }
    wrap.append(h('h2', null, list.length ? 'Your mods' : 'Start here'), cards);
    if (!list.length) {
      wrap.append(h('h2', null, 'How it works'), h('div', { class: 'steps note' },
        h('div', null, '1. Make a mod (a folder for everything you make).'),
        h('div', null, '2. Draw something in Pixel, then right-click it in the explorer: Make a block from it, or an item, or a creature.'),
        h('div', null, '3. In Graph, wire up what it does: what happens when it\'s used, struck, stepped on.'),
        h('div', null, '4. Build structures and dungeons in Builder; write stories in Story.'),
        h('div', null, '5. Playtest it; then turn it on for a world when you start one (New game, or Multiplayer).')));
    }
    this.stage.append(wrap);
  }

  async newMod() {
    const name = await prompt('New mod', 'Name', '', { placeholder: 'e.g. Crystal Caves', yes: 'Create', text: 'A mod holds everything you make for it. You can change its name later.' });
    if (name === null) return;
    const m = newMod({ name: cleanName(name, 40, 'My Mod'), author: this.o.author || 'Someone' });
    const colors = ['#ffe070', '#80e070', '#70e0e0', '#80a8ff', '#c090ff', '#ff9adf', '#ffa050', '#ff6a5a'];
    m.color = colors[Math.floor(Math.random() * colors.length)];
    await this.lib.put(m, { mine: true });
    this.openMod(m.id, 'overview');
    toast(`"${m.name}" made. Start by drawing something, or pick a quick start below.`, 'good');
  }

  async importMod() {
    const f = await pickFile('.tmod,.json,application/json');
    if (!f) return;
    try {
      const text = await readText(f);
      let replace = true;
      const { importMod } = await import('../mod/format.js');
      const incoming = importMod(text);
      if (this.lib.has(incoming.id)) {
        const mine = await this.lib.get(incoming.id);
        if (mine && modHash(mine) === incoming.hash) {
          toast(`You already have "${incoming.name}", exactly as it is.`);
          return this.openMod(incoming.id);
        }
        const v = await dialog({ title: 'You have this mod already', icon: 'warn', body: h('div', { class: 'note' }, `"${incoming.name}" (v${incoming.version}) is already here, as v${mine ? mine.version : '?'}. Replace yours with this one, or keep both (this one as a copy)?`), buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Keep both', value: 'copy' }, { label: 'Replace mine', kind: 'danger', value: 'replace' }] });
        if (!v) return;
        replace = v === 'replace';
      }
      const { mod } = await this.lib.add(text, { replace, copy: !replace, mine: false, from: 'a file' });
      toast(`Imported "${mod.name}" (${countThings(mod)} things).`, 'good');
      this.openMod(mod.id);
    } catch (e) {
      toast(e.message || String(e), 'bad', 5000);
    }
  }

  async duplicateMod(id) {
    const m = await this.lib.get(id);
    if (!m) return;
    const { rid } = await import('../mod/format.js');
    m.id = rid(8);
    m.name = `${m.name} (copy)`.slice(0, 40);
    await this.lib.put(m, { mine: true });
    this.home();
  }

  async deleteMod(id, name) {
    if (!(await confirm('Delete this mod?', `"${name}" and everything in it will be gone from this computer. Worlds that use it keep their own copy, and anyone you've sent it to keeps theirs.`, { danger: true, yes: 'Delete it' }))) return;
    await this.lib.remove(id);
    toast(`"${name}" deleted.`);
    this.home();
  }

  async openMod(id, toolId = null) {
    await this.saveNow();
    const m = await this.lib.get(id);
    if (!m) {
      toast('That mod couldn\'t be opened.', 'bad');
      return this.home();
    }
    const keepSel = this.sel && m[this.sel.kind] && m[this.sel.kind][this.sel.id] ? this.sel : null;
    this.mod = m;
    this.sel = keepSel;
    this.history.clear();
    this.thumbs.clear();
    try {
      localStorage.setItem('ws-last-mod', id);
    } catch {
      // Fine.
    }
    this.explorer.classList.remove('hidden');
    this.inspector.classList.remove('hidden');
    this.tool?.unmount?.();
    this.tool = null;
    this.drawExplorer();
    await this.useTool(toolId || this.toolId || 'overview', true);
  }

  // ------------------------------------------------------------ tools
  async useTool(id, force = false) {
    if (!this.mod) return;
    if (this.toolId === id && this.tool && !force) return;
    this.tool?.unmount?.();
    this.toolId = id;
    this.drawTop();
    clear(this.stage);
    clear(this.inspector);
    if (!this.tools[id]) {
      this.stage.append(h('div', { class: 'empty-stage' }, h('div', null, 'Loading...')));
      const mod = await LOADERS[id]();
      const T = mod.default;
      this.tools[id] = new T(this);
      clear(this.stage);
    }
    this.tool = this.tools[id];
    this.tool.mount(this.stage, this.inspector);
    const want = this.sel && TOOL_OF[this.sel.kind] === id && this.mod[this.sel.kind][this.sel.id] ? this.sel : null;
    if (id !== 'overview') {
      const keep = this.tool.current && this.tool.current();
      if (want && (!keep || keep.id !== want.id)) this.tool.open(want.kind, want.id);
      else if (!keep) this.tool.open(null, null);
    }
    this.drawStatus();
    this.drawExplorerSel();
  }

  // Open a thing in its tool.
  async open(kind, id) {
    if (!this.mod || !this.mod[kind] || !this.mod[kind][id]) return;
    this.sel = { kind, id };
    const t = TOOL_OF[kind];
    if (this.toolId !== t || !this.tool) await this.useTool(t, true);
    else this.tool.open(kind, id);
    this.drawExplorerSel();
  }

  // ------------------------------------------------------------ making things
  // A new thing in collection `kind` (with `data` to start from), opened.
  async create(kind, data = {}, o = {}) {
    if (!this.mod) return null;
    const stem = data.name || KIND_NAMES[kind][0];
    const id = freeId(this.mod, kind, stem);
    const base = DEFAULTS[kind] ? DEFAULTS[kind](data, this) : {};
    const thing = { ...base, ...data, id, name: cleanName(data.name || base.name || stem, 48, stem) };
    this.mod[kind][id] = thing;
    this.touch(kind, id, { quiet: true });
    this.drawExplorer();
    if (o.open !== false) await this.open(kind, id);
    return id;
  }

  // What can be made new, as a menu.
  newMenu(x, y, only = null) {
    const items = [];
    const sub = (kind) => !only || only === kind;
    if (sub('assets')) items.push({ label: 'Pixel art...', icon: 'pencil', onClick: () => this.tools.pixel ? this.newAsset() : this.useTool('pixel').then(() => this.newAsset()) });
    if (sub('vfx')) items.push({ label: 'Effect', icon: 'sparkle', onClick: () => this.create('vfx', { name: 'Effect' }) });
    if (sub('rigs')) items.push({ label: 'Rig', icon: 'bone', onClick: () => this.create('rigs', { name: 'Rig' }) });
    if (sub('entities')) {
      const groups = {};
      for (const t of TEMPLATES) (groups[TEMPLATE_INFO[t].group] ||= []).push(t);
      for (const [g, list] of Object.entries(groups)) items.push({ label: `${g}`, icon: g === 'Items' ? 'sword' : g === 'Creatures' ? 'skull' : g === 'World' ? 'cube' : 'bolt', sub: list.map((t) => ({ label: NODES[t].title, icon: TEMPLATE_INFO[t].icon, onClick: () => this.newEntity(t), tip: TEMPLATE_INFO[t].blurb })) });
    }
    if (sub('structures')) items.push({ label: 'Structure...', icon: 'house', onClick: () => this.builder((b) => b.newDialog()) });
    if (sub('layouts')) items.push({ label: 'Layout (town, camp...)', icon: 'grid', onClick: () => this.create('layouts', { name: 'Layout' }) });
    if (sub('dungeons')) items.push({ label: 'Dungeon', icon: 'stairs', onClick: () => this.builder((b) => b.newDungeon()) });
    if (sub('loot')) items.push({ label: 'Loot table', icon: 'chest', onClick: () => this.create('loot', { name: 'Loot' }) });
    if (sub('stories')) items.push({ label: 'Story', icon: 'scroll', onClick: () => this.create('stories', { name: 'Story' }) });
    if (sub('patches')) items.push({ label: 'Change to a game story', icon: 'book', onClick: () => this.useTool('story').then(() => this.tools.story.pickPatch?.()) });
    if (sub('biomes')) {
      items.push({ label: 'Biome, starting from', icon: 'tree', sub: GAME_BIOMES.map((k) => ({ label: BIOMES[k].name, swatch: BIOMES[k].bg, onClick: () => this.tool3('biome', (t) => t.newBiome(k)) })) });
      items.push({ label: 'Change a game biome', icon: 'leaf', sub: GAME_BIOMES.map((k) => ({ label: BIOMES[k].name, swatch: BIOMES[k].bg, onClick: () => this.tool3('biome', (t) => t.changeBiome(k)) })) });
    }
    if (sub('worlds')) items.push({ label: 'World map', icon: 'globe', onClick: () => this.tool3('world', (t) => t.newWorld()) });
    if (sub('chargen')) items.push({ label: 'Character tab', icon: 'bust', onClick: () => this.tool3('chargen', (t) => t.newTab()) });
    if (only && items.length === 1 && !items[0].sub) return items[0].onClick();
    menu(items, x, y);
  }

  // The Builder (loaded if it isn't yet), to do something with.
  async builder(fn) {
    return this.tool3('builder', fn);
  }

  // A tool (loaded if it isn't yet), to do something with.
  async tool3(id, fn) {
    if (!this.tools[id]) {
      const T = (await LOADERS[id]()).default;
      this.tools[id] = new T(this);
    }
    return fn(this.tools[id]);
  }

  async newAsset(o = {}) {
    if (!this.tools.pixel) await this.useTool('pixel');
    return this.tools.pixel.newDialog(o);
  }

  // A new entity from a template (`fill`: its inputs to start with).
  async newEntity(tpl, fill = {}, name = null) {
    const root = makeNode(tpl, 80, 120, { v: fill });
    if (name) root.v.name = name;
    const nm = name || root.v.name || NODES[tpl].title;
    const g = emptyGraph();
    g.nodes.push(root);
    // (With a little of what it might do already, to show how.)
    const s = starter(root);
    g.nodes.push(...s.nodes);
    g.links.push(...s.links);
    g.notes = s.notes;
    return this.create('entities', { name: nm, graph: g });
  }

  // What can be done with one of the mod's things (its context menu).
  actionsFor(kind, id) {
    const m = this.mod;
    const t = m[kind][id];
    if (!t) return [];
    const items = [
      { label: 'Open', icon: 'folder', onClick: () => this.open(kind, id) },
      { label: 'Rename...', icon: 'pencil', onClick: () => this.rename(kind, id) },
      { label: 'Duplicate', icon: 'copy', onClick: () => this.duplicate(kind, id) },
    ];
    if (kind === 'assets') {
      const ref = { texture: id };
      const icon = { icon: id };
      const look = { look: id };
      items.push({ sep: true }, { head: 'Use it' },
        { label: 'Make a block from it', icon: 'cube', onClick: () => this.newEntity('tpl.block', ref, t.name) },
        { label: 'Make an item from it', icon: 'sword', sub: [
          { label: 'Weapon', onClick: () => this.newEntity('tpl.weapon', icon, t.name) },
          { label: 'Consumable', onClick: () => this.newEntity('tpl.food', icon, t.name) },
          { label: 'Tool', onClick: () => this.newEntity('tpl.tool', icon, t.name) },
          { label: 'Armour', onClick: () => this.newEntity('tpl.armor', icon, t.name) },
          { label: 'Material', onClick: () => this.newEntity('tpl.material', icon, t.name) },
        ] },
        { label: 'Make a creature from it', icon: 'skull', sub: [
          { label: 'Animal', onClick: () => this.newEntity('tpl.animal', look, t.name) },
          { label: 'Hostile', onClick: () => this.newEntity('tpl.hostile', look, t.name) },
          { label: 'Person (NPC)', onClick: () => this.newEntity('tpl.npc', look, t.name) },
          { label: 'Boss', onClick: () => this.newEntity('tpl.boss', look, t.name) },
        ] },
        { label: 'Animate it in VFX', icon: 'sparkle', onClick: () => this.create('vfx', { name: `${t.name} effect`, from: { asset: id } }) },
        { label: 'Rig it (cut into parts)', icon: 'bone', onClick: () => this.create('rigs', { name: `${t.name} rig`, asset: id }) },
        { label: 'Use as the mod\'s picture', icon: 'star', onClick: () => {
          m.icon = id;
          this.touch('meta');
          this.drawTop();
          toast('That\'s the mod\'s picture now.', 'good');
        } });
    } else if (kind === 'structures') {
      items.push({ sep: true }, { label: 'Make a dungeon with it as a floor', icon: 'stairs', onClick: () => this.create('dungeons', { name: `${t.name} dungeon`, floors: [id] }) }, { label: 'Put it in a layout', icon: 'grid', onClick: () => this.create('layouts', { name: `${t.name} layout`, pieces: [{ structure: id, x: 0, z: 0, rot: 0 }] }) });
    } else if (kind === 'vfx') {
      items.push({ sep: true }, { label: 'Make a projectile with it', icon: 'bolt', onClick: () => this.newEntity('tpl.projectile', { trail: id }, t.name) });
    } else if (kind === 'rigs') {
      items.push({ sep: true }, { label: 'Make a creature with it', icon: 'skull', sub: ['tpl.animal', 'tpl.hostile', 'tpl.npc', 'tpl.boss'].map((tp) => ({ label: NODES[tp].title, onClick: () => this.newEntity(tp, { rig: id }, t.name) })) });
    } else if (kind === 'loot') {
      items.push({ sep: true }, { label: 'Drop it from a new creature', icon: 'skull', onClick: () => this.newEntity('tpl.hostile', { loot: id }, 'Looter') });
    } else if (kind === 'biomes') {
      const ref = t.change || `@${id}`;
      items.push({ sep: true }, { head: 'Use it' },
        { label: 'Paint it on a world map', icon: 'globe', onClick: () => this.useTool('world').then(() => this.tools.world?.paintBiome?.(ref)) },
        { label: 'A beast that wanders it', icon: 'paw', onClick: () => this.newEntity('tpl.animal', { biomes: [ref], spawnTime: 'day' }, `${t.title || t.name} beast`) },
        { label: 'A monster of its nights', icon: 'skull', onClick: () => this.newEntity('tpl.hostile', { biomes: [ref], spawnTime: 'night' }, `${t.title || t.name} horror`) });
    }
    items.push({ sep: true }, { label: 'Delete', icon: 'trash', danger: true, onClick: () => this.remove(kind, id) });
    return items;
  }

  async rename(kind, id) {
    const t = this.mod[kind][id];
    const n = await prompt('Rename', 'Name', t.name);
    if (!n) return;
    this.checkpoint(kind, id);
    t.name = cleanName(n, 48, t.name);
    this.touch(kind, id);
    this.drawExplorer();
    this.tool?.renamed?.(kind, id);
  }

  duplicate(kind, id) {
    const t = JSON.parse(JSON.stringify(this.mod[kind][id]));
    delete t.id;
    t.name = `${t.name} copy`;
    return this.create(kind, t);
  }

  async remove(kind, id) {
    const t = this.mod[kind][id];
    const users = this.usersOf(kind, id);
    const more = users.length ? ` It's used by ${users.slice(0, 4).map((u) => `"${u}"`).join(', ')}${users.length > 4 ? ` and ${users.length - 4} more` : ''}, which will lose it.` : '';
    if (!(await confirm(`Delete "${t.name}"?`, `It will be gone from the mod (Undo brings it back).${more}`, { danger: true, yes: 'Delete' }))) return;
    this.pushUndo({ type: 'restore', kind, id, data: JSON.stringify(t) });
    delete this.mod[kind][id];
    if (this.mod.icon === id) this.mod.icon = null;
    if (this.sel && this.sel.kind === kind && this.sel.id === id) this.sel = null;
    this.touch(kind, id);
    this.drawExplorer();
    this.tool?.removed?.(kind, id);
    toast(`"${t.name}" deleted. (Ctrl+Z to bring it back.)`);
  }

  // Who in the mod uses a thing (by its id anywhere in their data).
  usersOf(kind, id) {
    const out = [];
    const needles = [`"${id}"`, `"@${id}"`];
    for (const k of COLLECTIONS) for (const [oid, v] of Object.entries(this.mod[k] || {})) {
      if (k === kind && oid === id) continue;
      const s = JSON.stringify(v);
      if (needles.some((q) => s.includes(q))) out.push(v.name || oid);
    }
    return out;
  }

  // ------------------------------------------------------------ changes, undo, saving
  // Before changing a thing: how it was, for Undo.
  checkpoint(kind, id) {
    if (!this.mod) return;
    const data = kind === 'meta' ? JSON.stringify(metaOf(this.mod)) : JSON.stringify(this.mod[kind][id] ?? null);
    const k = `${kind}:${id}`;
    // (A drag of a slider is one step back, not one for each small move.)
    if (gesture.on && this.gestureCk === `${gesture.n}:${k}`) return;
    this.gestureCk = gesture.on ? `${gesture.n}:${k}` : null;
    const H = this.hist(k);
    if (H.undo.length && H.undo[H.undo.length - 1] === data) return;
    H.undo.push(data);
    if (H.undo.length > 80) H.undo.shift();
    H.redo = [];
    this.lastHist = k;
  }

  hist(k) {
    if (!this.history.has(k)) this.history.set(k, { undo: [], redo: [] });
    return this.history.get(k);
  }

  pushUndo(op) {
    (this.ops ||= []).push(op);
    this.lastHist = 'ops';
  }

  // Undo the last change to what's open (or, failing that, the last delete).
  undo() {
    if (this.tool && this.tool.undo && this.tool.undo()) return;
    const cur = this.tool && this.tool.current ? this.tool.current() : null;
    const k = cur ? `${cur.kind}:${cur.id}` : this.lastHist;
    if (k && k !== 'ops' && this.history.has(k) && this.history.get(k).undo.length) return this.stepHist(k, 'undo');
    if (this.ops && this.ops.length) {
      const op = this.ops.pop();
      if (op.type === 'restore') {
        this.mod[op.kind][op.id] = JSON.parse(op.data);
        this.touch(op.kind, op.id);
        this.drawExplorer();
        toast(`"${this.mod[op.kind][op.id].name}" is back.`, 'good');
      }
    }
  }

  redo() {
    if (this.tool && this.tool.redo && this.tool.redo()) return;
    const cur = this.tool && this.tool.current ? this.tool.current() : null;
    const k = cur ? `${cur.kind}:${cur.id}` : this.lastHist;
    if (k && this.history.has(k) && this.history.get(k).redo.length) this.stepHist(k, 'redo');
  }

  stepHist(k, way) {
    const H = this.history.get(k);
    const [kind, id] = k.split(':');
    const now = kind === 'meta' ? JSON.stringify(metaOf(this.mod)) : JSON.stringify(this.mod[kind][id] ?? null);
    const back = way === 'undo' ? H.undo.pop() : H.redo.pop();
    (way === 'undo' ? H.redo : H.undo).push(now);
    const v = JSON.parse(back);
    if (kind === 'meta') Object.assign(this.mod, v);
    else if (v === null) delete this.mod[kind][id];
    else this.mod[kind][id] = v;
    this.touch(kind, id);
    this.drawExplorer();
    this.tool?.reload?.(kind, id);
    if (kind === 'meta') this.drawTop();
  }

  // Something changed: saved in a moment, its thumbnail redrawn.
  touch(kind, id, o = {}) {
    if (!this.mod) return;
    this.dirty = true;
    if (kind && id) this.thumbs.delete(`${kind}:${id}`);
    window.clearTimeout(this.saveT);
    this.saveT = setTimeout(() => this.saveNow(), o.quiet ? 300 : 900);
    this.drawStatus();
    window.clearTimeout(this.exT);
    if (kind && kind !== 'meta' && id) this.exT = setTimeout(() => {
      this.refreshThumb(kind, id);
      // (Art changed: whatever shows it changes too.)
      if (kind === 'assets' || kind === 'entities' || kind === 'structures') for (const k of [...this.thumbs.keys()]) {
        if (kind !== 'assets' && !/^(structures|layouts|dungeons):/.test(k)) continue;
        if (k.startsWith('assets:')) continue;
        this.thumbs.delete(k);
        const [ok, oid] = k.split(':');
        this.refreshThumb(ok, oid);
      }
    }, 250);
  }

  async saveNow() {
    window.clearTimeout(this.saveT);
    if (!this.mod || !this.dirty || this.saving) return;
    this.saving = true;
    this.drawStatus();
    this.tool?.flush?.();
    try {
      await this.lib.put(this.mod, { mine: true });
      this.dirty = false;
    } catch (e) {
      toast(`Couldn't save: ${e.message || e}`, 'bad', 6000);
    } finally {
      this.saving = false;
      this.drawStatus();
    }
  }

  // ------------------------------------------------------------ explorer
  drawExplorer() {
    if (!this.mod) return;
    clear(this.explorer);
    const q = h('input', { placeholder: 'Find...', spellcheck: 'false' });
    q.value = this.filter || '';
    q.addEventListener('input', () => {
      this.filter = q.value;
      this.drawTree();
    });
    q.addEventListener('keydown', (e) => e.stopPropagation());
    const add = button(null, { icon: 'plus', title: 'Make something new', onClick: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      this.newMenu(r.left, r.bottom + 4);
    } });
    this.explorer.append(h('div', { class: 'ex-head' }, h('div', { class: 'ex-search' }, ic('search'), q), add));
    this.tree = h('div', { class: 'ex-tree scroll' });
    this.explorer.append(this.tree);
    this.drawTree();
  }

  drawTree() {
    const tree = this.tree;
    clear(tree);
    const m = this.mod;
    const f = (this.filter || '').toLowerCase();
    for (const S of SECTIONS) {
      const list = Object.values(m[S.key] || {}).filter((t) => !f || (t.name || '').toLowerCase().includes(f)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (f && !list.length) continue;
      const closed = !!this.closed[S.key] && !f;
      const head = h('div', { class: `ex-cat${closed ? ' closed' : ''}` }, h('span', { class: 'chev' }, ic('chevDown', 8)), ic(S.icon, 11), h('span', { class: 'cn' }, S.name), h('span', { class: 'n' }, list.length || ''));
      const plus = button(null, { icon: 'plus', kind: 'ghost', small: true, cls: 'add', title: `New ${KIND_NAMES[S.key][0]}` });
      plus.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = plus.getBoundingClientRect();
        this.newMenu(r.left, r.bottom + 4, S.key);
      });
      head.append(plus);
      head.addEventListener('click', () => {
        this.closed[S.key] = !this.closed[S.key];
        try {
          localStorage.setItem('ws-closed', JSON.stringify(this.closed));
        } catch {
          // Fine.
        }
        this.drawTree();
      });
      tree.append(head);
      if (closed) continue;
      if (!list.length) {
        tree.append(h('div', { class: 'ex-empty' }, `No ${KIND_NAMES[S.key][1]} yet.`));
        continue;
      }
      for (const t of list) {
        const sel = this.sel && this.sel.kind === S.key && this.sel.id === t.id;
        const thumb = h('span', { class: 'thumb' }, this.thumb(S.key, t.id));
        const sub = S.key === 'entities' ? entityTag(t) : S.key === 'assets' ? `${t.w}×${t.h}${t.frames && t.frames.length > 1 ? ` ·${t.frames.length}` : ''}` : '';
        const it = h('div', { class: `ex-item${sel ? ' on' : ''}`, dataset: { kind: S.key, id: t.id }, 'data-tip': entityTip(S.key, t) }, thumb, h('span', { class: 'nm' }, t.name), sub ? h('span', { class: 'tag' }, sub) : null);
        it.addEventListener('click', () => this.open(S.key, t.id));
        it.addEventListener('contextmenu', (e) => contextMenu(e, this.actionsFor(S.key, t.id)));
        dragSource(it, () => ({ kind: S.key, id: t.id, name: t.name, tpl: S.key === 'entities' ? rootType(t) : null }));
        tree.append(it);
      }
    }
  }

  drawExplorerSel() {
    if (!this.tree) return;
    for (const el of this.tree.querySelectorAll('.ex-item')) el.classList.toggle('on', !!this.sel && el.dataset.kind === this.sel.kind && el.dataset.id === this.sel.id);
  }

  refreshThumb(kind, id) {
    if (!this.tree) return;
    const el = this.tree.querySelector(`.ex-item[data-kind="${kind}"][data-id="${id}"] .thumb`);
    if (el) {
      clear(el);
      el.append(this.thumb(kind, id));
    }
  }

  // ------------------------------------------------------------ pictures
  assetCanvas(a, frame = 0) {
    const c = canvas(a.w, a.h);
    const d = composite(a, frame);
    c.getContext('2d').putImageData(new ImageData(d, a.w, a.h), 0, 0);
    return c;
  }

  // A small picture of a thing (for lists, fields, nodes).
  thumb(kind, id) {
    const k = `${kind}:${id}`;
    const t = this.mod && this.mod[kind] && this.mod[kind][id];
    if (!t) return ic('warn');
    const asset = this.thumbAsset(kind, t);
    if (asset) {
      const src = this.thumbs.get(k) || this.assetCanvas(asset, 0);
      this.thumbs.set(k, src);
      const c = canvas(src.width, src.height);
      c.getContext('2d').drawImage(src, 0, 0);
      return c;
    }
    if (kind === 'vfx') {
      let src = this.thumbs.get(k);
      if (src === undefined) {
        try {
          src = vfxPicture(this, t);
        } catch {
          src = null;
        }
        this.thumbs.set(k, src);
      }
      if (src) {
        const c = canvas(src.width, src.height);
        c.getContext('2d').drawImage(src, 0, 0);
        return c;
      }
    }
    if (kind === 'biomes') {
      const w = biomeWhole(t);
      return glyphCanvas(w.char, w.fg, w.bg, 2);
    }
    if (kind === 'worlds' && this.thumbs.get(k)) {
      const src = this.thumbs.get(k);
      const c = canvas(src.width, src.height);
      c.getContext('2d').drawImage(src, 0, 0);
      c.style.imageRendering = 'auto';
      return c;
    }
    if (kind === 'structures' || kind === 'layouts' || kind === 'dungeons') {
      let src = this.thumbs.get(k);
      if (src === undefined) {
        try {
          const st = kind === 'dungeons' ? this.mod.structures[t.entrance] : t;
          // (A dungeon's floor seen with its roof off.)
          const floor = kind === 'structures' && Object.values(this.mod.dungeons || {}).some((D) => (D.floors || []).includes(t.id));
          src = !st ? null : kind === 'layouts' ? voxPicture(this, layoutVox(this.mod, t), 40) : voxPicture(this, structVox(st), 40, 0, floor ? { layer: (st.ground ?? 1) + 1, above: 'hide' } : {});
        } catch {
          src = null;
        }
        this.thumbs.set(k, src);
      }
      if (src) {
        const c = canvas(src.width, src.height);
        c.getContext('2d').drawImage(src, 0, 0);
        c.style.imageRendering = 'auto';
        return c;
      }
    }
    const icons = { vfx: 'sparkle', rigs: 'bone', structures: 'house', layouts: 'grid', dungeons: 'stairs', loot: 'chest', stories: 'scroll', patches: 'book', biomes: 'tree', worlds: 'globe', chargen: 'bust' };
    if (kind === 'entities') {
      const tp = rootType(t);
      return ic(TEMPLATE_INFO[tp] ? TEMPLATE_INFO[tp].icon : 'node');
    }
    return ic(icons[kind] || 'info');
  }

  thumbAsset(kind, t) {
    const A = this.mod.assets;
    if (kind === 'assets') return t;
    if (kind === 'rigs') return A[t.asset] || null;
    if (kind === 'vfx') {
      const L = (t.layers || []).find((q) => q.asset && A[q.asset]);
      return L ? A[L.asset] : null;
    }
    if (kind === 'entities') {
      const r = (t.graph && t.graph.nodes || []).find((n) => NODES[n.type] && NODES[n.type].root);
      if (!r) return null;
      const v = r.v || {};
      for (const k of ['icon', 'texture', 'look']) if (v[k] && A[v[k]]) return A[v[k]];
      const rig = v.rig && this.mod.rigs[v.rig];
      if (rig && A[rig.asset]) return A[rig.asset];
    }
    return null;
  }

  // ------------------------------------------------------------ status bar
  drawStatus() {
    clear(this.status);
    this.hintEl = h('span', { class: 'hint' });
    this.status.append(this.hintEl);
    this.hint(this.tool && this.tool.hintText ? this.tool.hintText() : null);
    if (!this.mod) {
      this.status.append(h('span', null, `Game ${GAME_VERSION}`));
      return;
    }
    const probs = this.problems();
    const errs = probs.filter((p) => p.level === 'error').length;
    const p = h('span', { class: `probs${errs ? ' bad' : ''}`, 'data-tip': 'What might be wrong with the mod (click to see)' }, ic(errs ? 'warn' : 'check', 10), ` ${probs.length ? `${probs.length} to look at` : 'No problems'}`);
    p.addEventListener('click', () => this.useTool('overview'));
    this.status.append(p, h('span', { class: this.saving ? 'saving' : this.dirty ? 'saving' : 'saved' }, this.saving ? 'Saving...' : this.dirty ? 'Changed' : 'Saved'));
  }

  problems() {
    if (!this.mod) return [];
    const extra = [];
    for (const [id, e] of Object.entries(this.mod.entities || {})) {
      const g = e.graph || { nodes: [], links: [] };
      if (!g.nodes.some((n) => NODES[n.type] && NODES[n.type].root)) extra.push({ level: 'warn', where: ['entities', id], text: `"${e.name}" has no template node, so the game makes nothing of it.` });
      for (const q of lint(g)) extra.push({ ...q, where: ['entities', id], text: `${e.name}: ${q.text}` });
      // Art missing where it's wanted.
      const r = g.nodes.find((n) => NODES[n.type] && NODES[n.type].root);
      if (r) {
        for (const [k, v] of Object.entries(r.v || {})) {
          const p = NODES[r.type].inMap[k];
          if (!p || !v) continue;
          const coll = { asset: 'assets', vfx: 'vfx', rig: 'rigs', loot: 'loot', structure: 'structures', story: 'stories', effect: 'entities' }[p.t];
          if (coll && !this.mod[coll][v]) extra.push({ level: 'error', where: ['entities', id], text: `${e.name}: its ${p.label} points at something that's been deleted.` });
          if ((p.t === 'item' || p.t === 'block' || p.t === 'creature') && typeof v === 'string' && v[0] === '@' && !this.mod.entities[v.slice(1)]) extra.push({ level: 'error', where: ['entities', id], text: `${e.name}: its ${p.label} points at an entity that's been deleted.` });
        }
        if ((r.type === 'tpl.block' && !r.v.texture) || (['tpl.weapon', 'tpl.food', 'tpl.tool', 'tpl.armor', 'tpl.material'].includes(r.type) && !r.v.icon)) extra.push({ level: 'warn', where: ['entities', id], text: `${e.name} has no picture yet: it shows as a checked square.` });
      }
    }
    return modProblems(this.mod, extra);
  }

  // ------------------------------------------------------------ keys
  onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && /^Digit[0-9]$/.test(e.code) && this.mod) {
      e.preventDefault();
      const t = TOOLS.find((q) => q.key === e.code.slice(5));
      if (t) this.useTool(t.id);
      return;
    }
    if (ctrl && e.code === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (ctrl && e.code === 'KeyY') {
      e.preventDefault();
      this.redo();
      return;
    }
    if (ctrl && e.code === 'KeyS') {
      e.preventDefault();
      this.saveNow().then(() => toast('Saved.', 'good', 1200));
      return;
    }
    if (ctrl && e.code === 'KeyK' && this.mod) {
      e.preventDefault();
      this.quickOpen();
      return;
    }
    if (e.code === 'F5' && this.mod) {
      e.preventDefault();
      this.playtest();
      return;
    }
    if (e.key === '?' && this.mod) {
      this.shortcuts();
      return;
    }
    if (this.tool && this.tool.onKey && this.tool.onKey(e)) e.preventDefault();
  }

  shortcuts() {
    const rows = [['Ctrl+1..9, 0', 'Switch tool'], ['Ctrl+K', 'Find anything'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+S', 'Save now (it saves as you go anyway)'], ['F5', 'Playtest'], ['Right-click', 'What else can be done with a thing'], ...(this.tool && this.tool.keyHelp ? this.tool.keyHelp() : [])];
    dialog({ title: 'Shortcuts', icon: 'info', body: h('div', { class: 'helpgrid' }, rows.flatMap(([k, t]) => [h('span', { class: 'kbd' }, k), h('span', { class: 'note' }, t)])), buttons: [{ label: 'Close', kind: 'primary' }] });
  }

  // Everything in the mod, searchable: picked, it's opened.
  quickOpen() {
    const all = [];
    for (const S of SECTIONS) for (const t of Object.values(this.mod[S.key] || {})) all.push({ kind: S.key, t, sec: S });
    const inp = textInput({ placeholder: 'Type to find...' });
    const list = h('div', { class: 'list scroll', style: { maxHeight: '50vh' } });
    let hits = [];
    let at = 0;
    const draw = () => {
      const q = inp.value.toLowerCase();
      hits = all.filter((x) => !q || x.t.name.toLowerCase().includes(q)).slice(0, 40);
      at = Math.min(at, Math.max(0, hits.length - 1));
      clear(list);
      hits.forEach((x, i) => {
        const li = h('div', { class: `li${i === at ? ' on' : ''}` }, h('span', { class: 'thumb', style: { width: '18px', display: 'inline-grid', placeItems: 'center' } }, this.thumb(x.kind, x.t.id)), h('span', { style: { flex: 1 } }, x.t.name), h('span', { class: 'note' }, x.sec.name));
        li.addEventListener('click', () => go(x));
        list.append(li);
      });
    };
    let done = null;
    const go = (x) => {
      done?.();
      this.open(x.kind, x.t.id);
    };
    inp.addEventListener('input', () => {
      at = 0;
      draw();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') at = Math.min(hits.length - 1, at + 1);
      else if (e.key === 'ArrowUp') at = Math.max(0, at - 1);
      else if (e.key === 'Enter' && hits[at]) go(hits[at]);
      else return;
      e.preventDefault();
      draw();
    });
    draw();
    const handle = {};
    const p = dialog({ title: 'Find in the mod', icon: 'search', body: [inp, list], buttons: [{ label: 'Close', kind: 'ghost' }], enter: false, handle });
    done = () => handle.close?.(null);
    return p;
  }

  // ------------------------------------------------------------ out of the Workshop
  async exportMod() {
    if (!this.mod) return;
    await this.saveNow();
    const errs = this.problems().filter((p) => p.level === 'error');
    if (errs.length && !(await confirm('Export with problems?', `The mod has ${errs.length} problem${errs.length > 1 ? 's' : ''} (see Overview). It will still work, but the parts with problems may not do what you mean. Export it anyway?`, { yes: 'Export anyway' }))) return;
    const text = exportMod(this.mod);
    download(`${fileName(this.mod.name)}-v${this.mod.version}.tmod`, text);
    toast(`Exported "${this.mod.name}" (${Math.max(1, Math.round(text.length / 1024))} KB). Send the file to a friend: they import it in their Workshop.`, 'good', 5000);
  }

  async playtest() {
    if (!this.mod) return;
    await this.saveNow();
    const errs = this.problems().filter((p) => p.level === 'error');
    if (errs.length) toast(`The mod has ${errs.length} problem${errs.length > 1 ? 's' : ''}: the parts with problems may not work.`, 'bad');
    const mod = JSON.parse(exportMod(this.mod));
    await this.close();
    this.o.onPlaytest?.(mod, { tool: this.toolId, sel: this.sel });
  }
}

// A moment of an effect, as a small picture (on the dark).
function vfxPicture(app, fx) {
  const art = (aid) => {
    const a = app.mod.assets[aid];
    if (!a) return null;
    return { frames: a.frames.map((f, i) => app.assetCanvas(a, i)), durs: a.frames.map((f) => f.dur || 100), tags: a.tags || [] };
  };
  const p = new VfxPlayer(fx, { art, loop: true, seed: 3 });
  p.seek(Math.max(0.05, (+fx.dur || 1) * 0.35));
  const c = canvas(40, 40);
  const x = c.getContext('2d');
  x.fillStyle = '#120e18';
  x.fillRect(0, 0, 40, 40);
  p.draw(x, 20, 30);
  return c;
}

// ------------------------------------------------------------ what's new
// What each new thing starts as.
const DEFAULTS = {
  assets: (d) => newAsset({ name: d.name || 'Sprite', w: d.w || 16, h: d.h || 16 }),
  biomes: (d) => ({ name: 'Biome', base: d.base || 'plains', ...biomeFields(d.change || d.base || 'plains'), creatures: { day: [], night: [], mode: 'add' }, ...(d.change ? {} : { place: { how: 'climate', isles: ['thessa'], temp: [40, 70], moist: [30, 60], replaces: d.base || 'plains', share: 35 } }) }),
  vfx: (d) => newEffect(d.from && d.from.asset ? { layers: [newLayer('sprite', { id: 'l1', name: 'Art', asset: d.from.asset, anim: { ...newLayer('sprite').anim, bob: 2, bobHz: 0.8, pulse: 0.06, pulseHz: 1.2 } }), newLayer('emitter', { ...EMITTER_PRESETS.magic, id: 'l2', preset: 'magic', name: 'Sparkle' })] } : {}),
  rigs: (d) => ({ name: 'Rig', asset: d.asset || null, parts: [], bones: [], anims: {} }),
  structures: () => ({ name: 'Structure', w: 11, d: 11, h: 8, ground: 1, pal: ['keep'], cells: '', metas: '', marks: [], place: { where: 'wild', biomes: [], count: 2, isle: 'any', clear: true } }),
  layouts: () => ({ name: 'Layout', pieces: [], paths: [], place: { where: 'wild', biomes: [], count: 1, isle: 'any', clear: true }, size: 48 }),
  dungeons: () => ({ name: 'Dungeon', entrance: null, floors: [], boss: null, level: 2, place: { biomes: [], count: 1, isle: 'any' } }),
  loot: () => ({ name: 'Loot', rolls: [1, 3], entries: [{ item: 'coin', w: 4, min: 2, max: 8 }, { item: 'bread', w: 2, min: 1, max: 2 }], always: [] }),
  stories: () => ({ name: 'Story', graph: { nodes: [], links: [] } }),
  patches: () => ({ name: 'Story change', motif: null }),
  entities: () => ({ name: 'Entity', graph: emptyGraph() }),
  chargen: (d) => ({ name: 'Tab', title: '', about: '', rows: [], ...(d.game ? { hideRows: [], add: {} } : { order: 50 }) }),
};

const metaOf = (m) => ({ name: m.name, author: m.author, version: m.version, description: m.description, color: m.color, icon: m.icon, tags: m.tags });
const rootType = (e) => {
  const r = (e.graph && e.graph.nodes || []).find((n) => NODES[n.type] && NODES[n.type].root);
  return r ? r.type : null;
};
const entityTag = (e) => {
  const t = rootType(e);
  return t ? NODES[t].title.replace('Person (NPC)', 'NPC').replace('World event', 'Event') : '?';
};
const entityTip = (kind, t) => (kind === 'entities' ? `${entityTag(t)}: ${t.name}` : null);
const fileName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mod';
function ago(t) {
  if (!t) return 'a while ago';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

// ============================================================ Overview
class OverviewTool {
  constructor(app) {
    this.app = app;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.draw();
  }

  unmount() {}

  open() {}

  current() {
    return { kind: 'meta', id: 'meta' };
  }

  reload() {
    this.draw();
  }

  draw() {
    const app = this.app;
    const m = app.mod;
    clear(this.stage);
    clear(this.insp);
    const wrap = h('div', { class: 'home scroll' });
    const icon = h('div', { class: 'modicon', style: { background: m.color, width: '56px', height: '56px' } }, app.modIcon(56));
    wrap.append(h('div', { class: 'row', style: { gap: '16px', alignItems: 'center' } }, icon, h('div', null, h('h1', null, m.name), h('div', { class: 'note' }, `v${m.version} · by ${m.author} · ${countThings(m)} things`))));
    if (m.description) wrap.append(h('div', { class: 'sub', style: { marginTop: '12px' } }, m.description));
    // What's in it.
    const stats = h('div', { class: 'stats' });
    for (const S of SECTIONS) {
      const n = Object.keys(m[S.key] || {}).length;
      const st = h('div', { class: 'stat', 'data-tip': `New ${KIND_NAMES[S.key][0]}` }, h('div', { class: 'v' }, n), h('div', { class: 'l' }, S.name));
      st.addEventListener('click', (e) => app.newMenu(e.clientX, e.clientY, S.key));
      stats.append(st);
    }
    wrap.append(h('h2', null, 'In this mod'), stats);
    // Quick starts.
    wrap.append(h('h2', null, 'Quick starts'));
    const cards = h('div', { class: 'cards' });
    const quick = [
      ['cube', 'A new block', 'Draw a 16×16 texture, and it becomes a block you can place and break.', () => this.quickBlock()],
      ['sword', 'A new weapon', 'Draw an icon; set its damage, style and what it does on a hit.', () => this.quickItem('tpl.weapon', 'Weapon')],
      ['skull', 'A new monster', 'Draw a creature (with a walk animation if you like), and it hunts at night.', () => this.quickCreature('tpl.hostile', 'Monster')],
      ['person', 'Someone to talk to', 'A person with lines to say and answers to pick, placed in a structure.', () => this.quickCreature('tpl.npc', 'Wanderer')],
      ['crown', 'A boss', 'A master with phases and abilities, at the bottom of a dungeon of your own.', () => this.quickCreature('tpl.boss', 'Boss')],
      ['house', 'A building', 'Walls, floors, roofs, chests with loot, triggers that set things off.', () => app.builder((b) => b.newDialog())],
      ['stairs', 'A dungeon', 'Floors you build, stairs between them, a boss at the bottom.', () => app.builder((b) => b.newDungeon())],
      ['scroll', 'A story', 'A tale that starts when something happens, with tasks and turns.', () => app.create('stories', { name: 'Story' })],
      ['sparkle', 'An effect', 'Particles and animated sprites, for spells, hits and glows.', () => app.create('vfx', { name: 'Effect' })],
      ['tree', 'A biome', 'New land: its ground, trees (or your structures), beasts, weather, and where it grows.', () => app.tool3('biome', (t) => t.newBiome('plains'))],
      ['globe', 'A world map', 'The world\'s shape: land and sea, biomes, towns, realms, places and people where you put them.', () => app.tool3('world', (t) => t.newWorld())],
      ['bust', 'A character tab', 'A tab on the character screen: callings, gifts, skills, a vow; what each choice gives.', () => app.tool3('chargen', (t) => t.newTab())],
    ];
    for (const [i, t, d, fn] of quick) {
      const c = h('div', { class: 'card' }, h('div', { class: 't' }, ic(i, 14), t), h('div', { class: 'd' }, d));
      c.addEventListener('click', fn);
      cards.append(c);
    }
    wrap.append(cards);
    // Problems.
    const probs = app.problems();
    wrap.append(h('h2', null, probs.length ? `To look at (${probs.length})` : 'Problems'));
    if (!probs.length) wrap.append(h('div', { class: 'note' }, 'Nothing wrong that the Workshop can see.'));
    else {
      const list = h('div', { class: 'problems' });
      for (const p of probs.slice(0, 60)) {
        const el = h('div', { class: `problem ${p.level}` }, ic(p.level === 'error' ? 'warn' : 'info'), h('div', null, p.text));
        if (p.where) el.addEventListener('click', () => app.open(p.where[0], p.where[1]));
        list.append(el);
      }
      wrap.append(list);
    }
    this.stage.append(wrap);
    // The mod's own settings.
    this.insp.append(h('div', { class: 'insp-head' }, ic('gear'), 'Mod settings'));
    const body = h('div', { class: 'insp-body scroll' });
    const set = (k, v) => {
      app.checkpoint('meta', 'meta');
      m[k] = v;
      app.touch('meta');
      app.drawTop();
    };
    const iconRef = h('div', { class: 'ref' });
    const drawIcon = () => {
      clear(iconRef);
      iconRef.append(h('span', { class: 'thumb' }, m.icon && m.assets[m.icon] ? app.thumb('assets', m.icon) : ic('star')), h('span', { class: `nm${m.icon ? '' : ' none'}` }, m.icon && m.assets[m.icon] ? m.assets[m.icon].name : 'Drop art here'));
    };
    drawIcon();
    dropTarget(iconRef, (p) => p.kind === 'assets', (p) => {
      set('icon', p.id);
      drawIcon();
      this.draw();
    });
    iconRef.addEventListener('click', (e) => {
      const items = Object.values(m.assets).map((a) => ({ label: a.name, onClick: () => {
        set('icon', a.id);
        this.draw();
      } }));
      if (!items.length) items.push({ label: 'Draw some art first', off: true });
      menu(items, e.clientX, e.clientY);
    });
    body.append(
      h('div', { class: 'panel-b', style: { paddingTop: '10px' } },
        field('Name', textInput({ value: m.name, max: 40, onChange: (v) => set('name', cleanName(v, 40, m.name)) })),
        field('Author', textInput({ value: m.author, max: 24, onChange: (v) => set('author', cleanName(v, 24, m.author)) })),
        field('Version', textInput({ value: m.version, max: 16, onChange: (v) => set('version', cleanName(v, 16, m.version)) }), { tip: 'Raise it when you send a new version out (1.0.0 → 1.1.0).' }),
        field('Colour', colorButton(m.color, (v) => set('color', v.slice(0, 7)))),
        field('Picture', iconRef, { tip: 'Drag art here from the explorer' }),
        field('About it', textInput({ value: m.description, long: true, max: 2000, onChange: (v) => set('description', v) }), { wide: true }),
        h('div', { class: 'hr' }),
        h('div', { class: 'note' }, h('b', null, 'Using it: '), 'when you start a new game (or host a multiplayer world), you\'re asked which mods to turn on for it. Players joining a world you host are offered the mod to install.'),
        h('div', { class: 'row' }, button('Playtest', { icon: 'play', kind: 'go', onClick: () => app.playtest() }), button('Export', { icon: 'export', onClick: () => app.exportMod() }))));
    this.insp.append(body);
  }

  async quickBlock() {
    const app = this.app;
    const id = await app.newAsset({ name: 'Block texture', w: 16, h: 16, use: 'block', quiet: true });
    if (!id) return;
    await app.newEntity('tpl.block', { texture: id }, 'New Block');
    await app.open('assets', id);
    toast('Draw the block\'s top here. Its block is already made (in Entities): open it to set how hard it is, and what it does.', 'good', 6000);
  }

  async quickItem(tpl, name) {
    const app = this.app;
    const id = await app.newAsset({ name: `${name} icon`, w: 16, h: 16, use: 'icon', quiet: true });
    if (!id) return;
    await app.newEntity(tpl, { icon: id }, name);
    await app.open('assets', id);
    toast(`Draw the ${name.toLowerCase()}'s icon. Its item is made already (in Entities).`, 'good', 5000);
  }

  async quickCreature(tpl, name) {
    const app = this.app;
    const big = tpl === 'tpl.boss';
    const id = await app.newAsset({ name, w: big ? 32 : 16, h: big ? 32 : 16, use: 'creature', frames: 2, quiet: true });
    if (!id) return;
    await app.newEntity(tpl, { look: id }, name);
    await app.open('assets', id);
    toast(`Draw the ${name.toLowerCase()} facing right (frame 2 is its step). Its entity is made already.`, 'good', 5000);
  }
}
