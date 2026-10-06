// The Character tool (round 63): the character screen as a world made with
// the mod has it, live (try it: click about it, type a name, pick), with
// its tabs along the bottom to put in order (drag them), hide, rename, add
// and take away. On the right, the tab you're on: what it says, its rows
// (a choice of one, of several, points to spend, words to write), each
// choice and what choosing it gives (things from the explorer, coins,
// stats, health, traits, a lasting effect, a companion, a story begun,
// values the mod's graphs read, looks, where on the world map they begin);
// and for the game's own tabs, which of their rows show, and origins,
// starting gear and traits of the mod's own.
import { h, ic, clear, button, field, textInput, numberInput, check, seg, select, chips, panel, toast, contextMenu, colorButton, dialog, dropTarget, prompt } from './kit.js';
import { titleBar, menuButton, refPicker, pickRef, refLabel, refThumb } from './common.js';
import { CharacterWindow, effectsText } from '../ui/create.js';
import { drawGrid } from '../ui/ascii.js';
import { VIEW_W, VIEW_H, CHAR_W, CHAR_H } from '../config.js';
import { charGenOf, chosenEffects, GAME_TABS, GAME_ORDER, GAME_ROWS, LOOK_KEYS } from '../mod/chargen.js';
import { ORIGINS, KITS, TRAITS, SKINS, HAIRS, CLOTHES } from '../game/hero.js';
import { freeId } from '../mod/format.js';

const GAME_NAMES = { basics: 'Basics', looks: 'Looks', stats: 'Stats', traits: 'Traits' };
const KIND_INFO = {
  pick: ['A choice of one', 'list', 'Turned with the arrows: one of its choices.'],
  many: ['Several', 'checklist', 'Boxes to tick: as many as you allow.'],
  points: ['Points to spend', 'bars', 'Points spread over a few things, each point giving what it gives.'],
  text: ['Words', 'text', 'Written in: a motto, a vow, a name for something.'],
};
const ITEM_TPL = ['tpl.food', 'tpl.weapon', 'tpl.tool', 'tpl.armor', 'tpl.material', 'tpl.block'];
const CREATURE_TPL = ['tpl.animal', 'tpl.hostile', 'tpl.npc', 'tpl.boss'];
// What choosing something can give (as the effects keep it).
const GIVES = [
  ['items', 'Things', 'sword'], ['coins', 'Coins', 'coin'], ['stats', 'Stats', 'bars'], ['hp', 'Health', 'heart'], ['traits', 'Traits', 'star'],
  ['effect', 'A lasting effect', 'sparkle'], ['companion', 'A companion', 'paw'], ['story', 'A story begun', 'scroll'], ['flags', 'Values for graphs', 'node'],
  ['look', 'Looks', 'paint'], ['start', 'Where they begin', 'flag'],
];
const STATS4 = [['str', 'STR'], ['agi', 'AGI'], ['end', 'END'], ['cha', 'CHA']];
const LOOK_NAMES = { skin: 'Skin', hair: 'Hair', eyeColor: 'Eyes', shirt: 'Shirt', pants: 'Trousers', shoes: 'Shoes', accent: 'Trims', neck: 'Kerchief', gloves: 'Gloves', cape: 'Cloak' };
const LOOK_DEF = { skin: SKINS[0], hair: HAIRS[0], shirt: CLOTHES[0] };
const ADD_NAMES = { origin: ['Origin', 'More origins'], kit: ['Starting gear', 'More starting gear'], trait: ['Trait', 'More traits'] };

// A short id, free in `list` (each thing in it with an id).
function uid(list, stem) {
  const base = String(stem || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 16) || 'x';
  const taken = (id) => (list || []).some((q) => q && q.id === id);
  if (!taken(base)) return base;
  for (let i = 2; ; i++) if (!taken(`${base}_${i}`)) return `${base}_${i}`;
}

// A thing dragged in from the explorer, as a choice: what it gives.
function fromThing(p) {
  if (p.kind === 'entities' && ITEM_TPL.includes(p.tpl)) return { name: p.name, effects: { items: [[`@${p.id}`, 1]] } };
  if (p.kind === 'entities' && CREATURE_TPL.includes(p.tpl)) return { name: p.name, effects: { companion: `@${p.id}` } };
  if (p.kind === 'entities' && p.tpl === 'tpl.effect') return { name: p.name, effects: { effect: p.id } };
  if (p.kind === 'stories') return { name: p.name, effects: { story: p.id } };
  if (p.kind === 'assets') return { name: p.name, art: p.id };
  return null;
}
const takes = (p) => !!fromThing(p);

export default class CharGenTool {
  constructor(app) {
    this.app = app;
    this.id = null;
    // (A game tab looked at, with no change of the mod's to it yet.)
    this.gameTab = null;
    this.row = null;
    this.pick = null;
    this.ui = { audio: null, mouseCell: { x: -1, y: -1 }, time: 0, close() {}, open() {} };
    this.win = null;
  }

  get t() {
    return this.id && this.app.mod.chargen[this.id] ? this.app.mod.chargen[this.id] : null;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.onResize = () => this.fit();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('ws-resize', this.onResize);
    this.build();
  }

  unmount() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('ws-resize', this.onResize);
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  current() {
    return this.t ? { kind: 'chargen', id: this.id } : null;
  }

  hintText() {
    return 'Try the screen: click about it, type a name, pick. Drag the tabs along the bottom to put them in order; click the eye to hide one. Drag things from the explorer onto a row\'s choices.';
  }

  keyHelp() {
    return [['Click the screen', 'Its keys go to it (Esc lets go)'], ['Drag a tab', 'Put it elsewhere'], ['Double-click a tab', 'Rename it']];
  }

  onKey() {
    return false;
  }

  open(kind, id) {
    this.id = id && this.app.mod.chargen[id] ? id : null;
    this.gameTab = this.t && this.t.game ? this.t.game : null;
    this.row = null;
    this.pick = null;
    if (!this.cv) return this.build();
    this.sync(true);
    this.drawChrome();
  }

  reload() {
    if (this.id && !this.t) this.id = null;
    this.sync(false);
    this.drawChrome();
  }

  removed(kind, id) {
    if (kind === 'chargen' && id === this.id) {
      this.id = null;
      this.row = null;
      this.pick = null;
    }
    this.sync(false);
    this.drawChrome();
  }

  renamed() {
    this.drawChrome();
  }

  otherChanged() {
    this.sync(false);
  }

  // ------------------------------------------------------------ the tabs
  // The tabs as they stand, hidden ones too: [{ key, game, name, hidden,
  // ent, order }].
  stripTabs() {
    const mod = this.app.mod;
    const ents = Object.values(mod.chargen);
    const out = [];
    for (const g of GAME_TABS) {
      const e = ents.find((t) => t.game === g) || null;
      out.push({ key: g, game: g, name: String((e && e.title) || GAME_NAMES[g]).toUpperCase(), hidden: !!(e && e.hide), ent: e, order: e && typeof e.order === 'number' ? e.order : GAME_ORDER[g] });
    }
    for (const e of ents) if (!e.game) out.push({ key: `m:${mod.id}:${e.id}`, game: null, name: String(e.title || e.name || 'MORE').toUpperCase(), hidden: !!e.hide, ent: e, order: typeof e.order === 'number' ? e.order : 50 });
    return out.sort((a, b) => a.order - b.order);
  }

  // The mod's change to a game tab (made, if there's none yet).
  ensure() {
    if (this.t) return this.t;
    const g = this.gameTab;
    if (!g) return null;
    return this.gameEnt(g);
  }

  gameEnt(g) {
    const app = this.app;
    const had = Object.values(app.mod.chargen).find((t) => t.game === g);
    if (had) return had;
    const id = freeId(app.mod, 'chargen', `${GAME_NAMES[g]} changed`);
    app.checkpoint('chargen', id);
    app.mod.chargen[id] = { id, name: `${GAME_NAMES[g]} (changed)`, game: g, title: '', about: '', rows: [], hideRows: [], add: {} };
    app.touch('chargen', id, { quiet: true });
    app.drawExplorer();
    if (this.gameTab === g) {
      this.id = id;
      app.sel = { kind: 'chargen', id };
      app.drawExplorerSel();
    }
    return app.mod.chargen[id];
  }

  // A new tab of the mod's own, after the others.
  async newTab() {
    const last = this.stripTabs().reduce((a, q) => Math.max(a, q.order), 40);
    const id = await this.app.create('chargen', { name: 'New tab', title: 'NEW', about: '', rows: [], order: Math.min(999, last + 10) });
    return id;
  }

  // (From the World tool) an origin of the mod's: new characters who
  // choose it begin by a place set on the world map.
  async addOriginAt(placeId, name) {
    const app = this.app;
    const e = this.gameEnt('basics');
    app.checkpoint('chargen', e.id);
    e.add ||= {};
    const L = (e.add.origin ||= []);
    const o = { id: uid(L, `from ${name}`), name: `From ${name}`.slice(0, 24), about: `You begin by ${name}.`, as: 'crash', effects: { start: placeId } };
    L.push(o);
    app.touch('chargen', e.id);
    await app.open('chargen', e.id);
    this.pick = { list: 'origin', id: o.id };
    this.sync(false);
    this.drawSide();
    toast(`"${o.name}" is an origin now: new characters who choose it begin there.`, 'good');
  }

  // A row of each kind to start with (or the kind asked for).
  addRow(kind) {
    const t = this.ensure();
    if (!t) return;
    const n = { pick: 'Choice', many: 'Gifts', points: 'Skills', text: 'Motto' }[kind];
    // (Its id the mod's own: graphs read the choice by it.)
    const all = Object.values(this.app.mod.chargen).flatMap((q) => q.rows || []);
    this.set((x) => {
      x.rows ||= [];
      const r = { id: uid(all, n), label: n, kind, about: '' };
      if (kind === 'pick' || kind === 'many') r.options = [{ id: 'one', name: 'One', about: '' }, { id: 'two', name: 'Two', about: '' }];
      if (kind === 'many') r.max = 1;
      if (kind === 'points') {
        r.points = 3;
        r.entries = [{ id: 'one', name: 'One', about: '', max: 3 }, { id: 'two', name: 'Two', about: '', max: 3 }];
      }
      x.rows.push(r);
      this.row = r.id;
      this.pick = null;
    }, { side: true });
  }

  // Tabs put in a new order: the game's keep their own places if they're
  // still in theirs (the mod's go between them); else all are numbered
  // afresh.
  moveTab(key, toKey, after) {
    if (!key || key === toKey) return;
    const seq = this.stripTabs();
    const from = seq.findIndex((q) => q.key === key);
    if (from < 0) return;
    const [q] = seq.splice(from, 1);
    let at = seq.findIndex((x) => x.key === toKey);
    if (at < 0) at = seq.length;
    else if (after) at++;
    seq.splice(at, 0, q);
    const games = seq.filter((x) => x.game);
    const inPlace = games.every((x, i) => i === 0 || GAME_ORDER[x.game] > GAME_ORDER[games[i - 1].game]);
    const orders = new Map();
    if (inPlace) {
      let prev = 0;
      for (let i = 0; i < seq.length; i++) {
        if (seq[i].game) {
          prev = GAME_ORDER[seq[i].game];
          orders.set(seq[i].key, prev);
          continue;
        }
        let j = i;
        while (j < seq.length && !seq[j].game) j++;
        const k = j - i;
        const next = j < seq.length ? GAME_ORDER[seq[j].game] : prev + 10 * (k + 1);
        for (let r = 0; r < k; r++) orders.set(seq[i + r].key, Math.round((prev + ((next - prev) * (r + 1)) / (k + 1)) * 100) / 100);
        i = j - 1;
      }
    } else seq.forEach((x, i) => orders.set(x.key, (i + 1) * 10));
    const app = this.app;
    for (const x of seq) {
      const want = orders.get(x.key);
      if (x.game) {
        const e = x.ent;
        if (want === GAME_ORDER[x.game]) {
          if (e && e.order !== undefined) {
            app.checkpoint('chargen', e.id);
            delete e.order;
            app.touch('chargen', e.id);
          }
        } else {
          const e2 = e || this.gameEnt(x.game);
          app.checkpoint('chargen', e2.id);
          e2.order = want;
          app.touch('chargen', e2.id);
        }
      } else if (x.ent.order !== want) {
        app.checkpoint('chargen', x.ent.id);
        x.ent.order = want;
        app.touch('chargen', x.ent.id);
      }
    }
    this.sync(false);
    this.drawStrip();
  }

  toggleHidden(q) {
    const e = q.ent || this.gameEnt(q.game);
    this.app.checkpoint('chargen', e.id);
    e.hide = !e.hide;
    this.app.touch('chargen', e.id);
    if (e.hide && this.stripTabs().every((x) => x.hidden)) toast('Every tab is hidden: the screen shows the Basics alone.', 'warn');
    this.sync(false);
    this.drawChrome();
  }

  async renameTab(q) {
    const n = await prompt('The tab\'s name', 'On the tab (18 letters at most)', q.name);
    if (n === null || n === undefined) return;
    const e = q.ent || this.gameEnt(q.game);
    this.app.checkpoint('chargen', e.id);
    e.title = String(n).trim().slice(0, 18);
    this.app.touch('chargen', e.id);
    this.sync(false);
    this.drawChrome();
  }

  tabMenu(q) {
    const items = [
      { label: 'Open', icon: 'folder', onClick: () => this.focusTab(q, true) },
      { label: 'Rename...', icon: 'pencil', onClick: () => this.renameTab(q) },
      { label: q.hidden ? 'Show it' : 'Hide it', icon: q.hidden ? 'eye' : 'eyeOff', onClick: () => this.toggleHidden(q) },
    ];
    if (q.game && q.ent) items.push({ sep: true }, { label: 'Back as the game has it', icon: 'undo', onClick: () => this.app.remove('chargen', q.ent.id) });
    if (!q.game) items.push({ sep: true }, { label: 'Delete the tab', icon: 'trash', danger: true, onClick: () => this.app.remove('chargen', q.ent.id) });
    return items;
  }

  // Look at a tab: its change (or the game's own as it is), on the right;
  // and on the screen, if `show`.
  focusTab(q, show) {
    this.id = q.ent ? q.ent.id : null;
    this.gameTab = q.game || null;
    this.row = null;
    this.pick = null;
    this.app.sel = this.id ? { kind: 'chargen', id: this.id } : null;
    this.app.drawExplorerSel();
    if (show && this.win) {
      this.win.showTab(q.key);
      this.shownTab = q.key;
    }
    this.drawChrome();
  }

  // ------------------------------------------------------------ changing it
  // `o.side`: the panels again.
  set(fn, o = {}) {
    const made = !this.t;
    const t = this.ensure();
    if (!t) return;
    this.app.checkpoint('chargen', this.id);
    fn(t);
    this.app.touch('chargen', this.id);
    this.sync(false);
    // (The game's tab changed for the first time: the mod's change to it
    // is what's open now.)
    if (made) return this.drawChrome();
    if (o.side) this.drawSide();
    if (o.strip) this.drawStrip();
    return null;
  }

  // The screen as the mod has it now (`fresh`: a new character on it).
  sync(fresh) {
    if (!this.cv) return;
    if (!this.win || fresh === 'new') {
      this.win = new CharacterWindow(this.ui, 1234, (hero) => this.began(hero), [this.app.mod]);
      this.win.close = () => {};
    } else this.win.setMods([this.app.mod]);
    const key = this.tabKey();
    if (key) {
      this.win.showTab(key, this.screenRow());
      this.shownTab = key;
    }
  }

  // The line on the screen for what's chosen here (an origin or gear of
  // the mod's, chosen on the screen too).
  screenRow() {
    const mid = this.app.mod.id;
    const p = this.pick;
    const w = this.win;
    if (p && (p.list === 'origin' || p.list === 'kit') && w) {
      const key = `${mid}:${p.id}`;
      if (p.list === 'origin') w.setOrigin(w.origins().find((q) => q.mod === key));
      else w.setKit(w.kits().find((q) => q.mod === key));
      return p.list;
    }
    if (p && p.list === 'trait') return `trait:${mid}:${p.id}`;
    return this.row ? `${mid}:${this.row}` : null;
  }

  // The screen's id for the tab open here.
  tabKey() {
    const t = this.t;
    if (t) return t.game ? t.game : `m:${this.app.mod.id}:${t.id}`;
    return this.gameTab;
  }

  // ------------------------------------------------------------ the stage
  build() {
    clear(this.stage);
    clear(this.insp);
    this.bar = h('div');
    this.cv = h('canvas', { class: 'cg-screen', width: VIEW_W, height: VIEW_H, tabindex: '0' });
    this.ctx = this.cv.getContext('2d');
    this.wrap = h('div', { class: 'cg-wrap' }, this.cv);
    this.strip = h('div', { class: 'cg-strip' });
    this.stage.append(this.bar, this.wrap, this.strip);
    this.input();
    this.sync('new');
    this.drawChrome();
    window.requestAnimationFrame(() => this.fit());
    let last = performance.now();
    const tick = (now) => {
      if (!this.cv || !this.cv.isConnected) {
        this.raf = 0;
        return;
      }
      this.ui.time += Math.min(0.1, (now - last) / 1000);
      last = now;
      this.drawScreen();
      this.raf = window.requestAnimationFrame(tick);
    };
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = window.requestAnimationFrame(tick);
  }

  // As big as fits (whole steps, for the letters' sake).
  fit() {
    if (!this.cv || !this.wrap.isConnected) return;
    const r = this.wrap.getBoundingClientRect();
    const k = Math.min((r.width - 16) / VIEW_W, (r.height - 16) / VIEW_H);
    // (Whole steps when it's big; halves till then, for a bigger screen.)
    const s = k >= 3 ? Math.floor(k) : k >= 1 ? Math.floor(k * 2) / 2 : Math.max(0.25, k);
    this.cv.style.width = `${Math.round(VIEW_W * s)}px`;
    this.cv.style.height = `${Math.round(VIEW_H * s)}px`;
  }

  drawScreen() {
    const w = this.win;
    const ctx = this.ctx;
    ctx.fillStyle = '#0b0912';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!w) return;
    w.grid.clear();
    w.hits = [];
    try {
      w.draw(w.grid, null);
      drawGrid(ctx, w.grid, w.x, w.y, 1, w.seed, this.ui.time);
      w.drawPixels(ctx);
    } catch (e) {
      ctx.fillStyle = '#ff6060';
      ctx.font = '10px monospace';
      ctx.fillText(`The screen couldn't be drawn: ${e.message || e}`, 8, 16);
    }
  }

  // The screen played with: the pointer, clicks, the wheel, the keys.
  input() {
    const cv = this.cv;
    const at = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * VIEW_W) / r.width, y: ((e.clientY - r.top) * VIEW_H) / r.height };
    };
    cv.addEventListener('pointermove', (e) => {
      const p = at(e);
      this.ui.mouseCell = { x: Math.floor(p.x / CHAR_W), y: Math.floor(p.y / CHAR_H) };
    });
    cv.addEventListener('pointerleave', () => {
      this.ui.mouseCell = { x: -1, y: -1 };
    });
    cv.addEventListener('pointerdown', (e) => {
      cv.focus();
      const p = at(e);
      const cx = Math.floor(p.x / CHAR_W);
      const cy = Math.floor(p.y / CHAR_H);
      this.ui.mouseCell = { x: cx, y: cy };
      const w = this.win;
      if (w && w.contains(cx, cy)) w.onClick({ type: 'down', button: e.button, x: p.x, y: p.y }, cx - w.x, cy - w.y, null);
      this.played();
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.win?.onWheel(Math.sign(e.deltaY) * 2);
    }, { passive: false });
    cv.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Escape') {
        cv.blur();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      this.win?.onKey({ code: e.code, key: e.key, shift: e.shiftKey });
      this.played();
    });
  }

  // (Moved to another tab on the screen: that tab's here too.)
  played() {
    const w = this.win;
    const tab = w && w.tabs[w.tab];
    if (!tab || tab.id === this.shownTab) return;
    this.shownTab = tab.id;
    const q = this.stripTabs().find((x) => x.key === tab.id);
    if (q) this.focusTab(q, false);
  }

  // Begun: what they'd have, in a world made with the mod.
  began(hero) {
    const cg = charGenOf([this.app.mod]);
    const fx = chosenEffects(cg, hero);
    const kit = hero.modKit ? cg.kits.find((q) => q.key === hero.modKit) : null;
    const origin = hero.modOrigin ? cg.origins.find((q) => q.key === hero.modOrigin) : null;
    const lines = [
      h('div', null, h('b', null, hero.name), `, ${origin ? origin.name : ORIGINS[hero.origin].name}; ${kit ? kit.name : KITS[hero.kit].name}.`),
      ...fx.map(({ mod, e, what }) => h('div', { class: 'row', style: { alignItems: 'flex-start' } }, ic('dot', 8), h('span', null, h('b', null, what), effectsText(mod, e) ? `: ${effectsText(mod, e)}` : ''))),
    ];
    if (!fx.length) lines.push(h('div', { class: 'note' }, 'Nothing of the mod\'s chosen gives anything yet.'));
    const vals = Object.entries(hero.modPicks || {});
    if (vals.length) lines.push(h('div', { class: 'note', style: { marginTop: '8px' } }, h('b', null, 'What graphs read (Player variables): '), vals.map(([k, v]) => `${k.split(':').slice(1).join(':')} = ${Array.isArray(v) ? v.join(',') : v && typeof v === 'object' ? JSON.stringify(v) : JSON.stringify(v)}`).join('; ')));
    dialog({ title: 'They\'d begin with', icon: 'bust', body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '520px' } }, ...lines), buttons: [{ label: 'Close', kind: 'primary' }] });
  }

  // ------------------------------------------------------------ chrome
  drawChrome() {
    this.drawBar();
    this.drawStrip();
    this.drawSide();
  }

  drawBar() {
    const app = this.app;
    clear(this.bar);
    const t = this.t;
    const tb = t ? titleBar(app, 'chargen', this.id) : h('div', { class: 'toolbar' }, h('div', { class: 'title' }, ic('bust'), h('span', { style: { color: 'var(--gold)' } }, this.gameTab ? `${GAME_NAMES[this.gameTab]}: the game's own` : 'The character screen')));
    if (t) tb.append(h('span', { class: 'note' }, t.game ? `Changes the game's ${GAME_NAMES[t.game]}` : 'A tab of the mod\'s own'));
    tb.append(h('span', { class: 'spacer' }),
      button('Another character', { icon: 'dice', small: true, title: 'Randomise them (as the 0 key does on the screen)', onClick: () => this.win && this.win.randomise() }),
      button('Begin', { icon: 'play', small: true, kind: 'primary', title: 'What they\'d have, chosen as they are now', onClick: () => this.win && this.began(JSON.parse(JSON.stringify(this.win.hero))) }));
    this.bar.append(tb);
  }

  drawStrip() {
    const s = this.strip;
    clear(s);
    s.append(h('span', { class: 'lab' }, 'Tabs'));
    const key = this.tabKey();
    for (const q of this.stripTabs()) {
      const chip = h('div', { class: `cg-tab${q.key === key ? ' on' : ''}${q.hidden ? ' off' : ''}`, draggable: 'true', 'data-tip': `${q.game ? `The game's ${GAME_NAMES[q.game]}${q.ent ? ', changed' : ''}` : 'The mod\'s own'}. Drag it elsewhere; double-click to rename; right-click for more.` }, ic(q.game ? 'tab' : 'bust', 10), h('span', null, q.name));
      const eye = h('span', { class: 'eye', 'data-tip': q.hidden ? 'Hidden: click to show it' : 'Shown: click to hide it' }, ic(q.hidden ? 'eyeOff' : 'eye', 10));
      eye.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleHidden(q);
      });
      chip.append(eye);
      chip.addEventListener('click', () => this.focusTab(q, true));
      chip.addEventListener('dblclick', () => this.renameTab(q));
      chip.addEventListener('contextmenu', (e) => contextMenu(e, this.tabMenu(q)));
      chip.addEventListener('dragstart', (e) => {
        this.dragKey = q.key;
        e.dataTransfer.setData('text/plain', q.name);
        e.dataTransfer.effectAllowed = 'move';
      });
      const side = (e) => {
        const r = chip.getBoundingClientRect();
        return e.clientX > r.left + r.width / 2;
      };
      chip.addEventListener('dragover', (e) => {
        if (!this.dragKey) return;
        e.preventDefault();
        const after = side(e);
        chip.classList.toggle('drop-l', !after);
        chip.classList.toggle('drop-r', after);
      });
      chip.addEventListener('dragleave', () => chip.classList.remove('drop-l', 'drop-r'));
      chip.addEventListener('drop', (e) => {
        if (!this.dragKey) return;
        e.preventDefault();
        chip.classList.remove('drop-l', 'drop-r');
        const k = this.dragKey;
        this.dragKey = null;
        this.moveTab(k, q.key, side(e));
      });
      chip.addEventListener('dragend', () => {
        this.dragKey = null;
        for (const c of s.querySelectorAll('.drop-l, .drop-r')) c.classList.remove('drop-l', 'drop-r');
      });
      s.append(chip);
    }
    const add = h('div', { class: 'cg-tab new', 'data-tip': 'A tab of the mod\'s own' }, ic('plus', 10), h('span', null, 'New tab'));
    add.addEventListener('click', () => this.newTab());
    s.append(add);
  }

  // ------------------------------------------------------------ the panels
  drawSide() {
    const keep = this.sideBody ? this.sideBody.scrollTop : 0;
    clear(this.insp);
    const t = this.t;
    const g = t ? t.game : this.gameTab;
    this.insp.append(h('div', { class: 'insp-head' }, ic('bust'), t ? t.name : g ? GAME_NAMES[g] : 'Character screen'));
    const body = h('div', { class: 'insp-body scroll' });
    this.sideBody = body;
    if (!t && !g) this.overview(body);
    else {
      body.append(panel('The tab', this.tabBody(t, g), { key: 'cg-tab' }));
      if (g) {
        const own = this.gameRowsBody(t, g);
        if (own) body.append(panel(`The game's ${GAME_NAMES[g].toLowerCase()}`, own, { key: 'cg-own' }));
        for (const k of g === 'basics' ? ['origin', 'kit'] : g === 'traits' ? ['trait'] : []) body.append(panel(ADD_NAMES[k][1], this.addsBody(t, k), { key: `cg-add-${k}` }));
      }
      body.append(panel(g ? 'More rows on it' : 'Rows', this.rowsBody(t, g), { key: 'cg-rows' }));
      const r = t && this.row ? (t.rows || []).find((q) => q.id === this.row) : null;
      if (r) body.append(panel(`Row: ${r.label || r.id}`, this.rowBody(r), { key: 'cg-row' }));
      const x = t && this.pick ? this.picked(t) : null;
      if (x) body.append(panel(this.pickTitle(x), this.pickBody(x), { key: 'cg-pick' }));
    }
    this.insp.append(body);
    body.scrollTop = keep;
  }

  overview(body) {
    const el = h('div');
    el.append(h('div', { class: 'note' }, 'New characters in worlds made with the mod see this screen. Its tabs are along the bottom: the game\'s four, and the mod\'s own. Click one to change it; drag them into another order; the eye hides one. What players choose here is given when the game begins, and the mod\'s graphs read it (Variable, kept with the Player).'));
    el.append(h('div', { class: 'row', style: { marginTop: '8px', flexWrap: 'wrap' } },
      button('New tab', { icon: 'plus', small: true, kind: 'primary', onClick: () => this.newTab() }),
      menuButton('Change a game tab', GAME_TABS.map((k) => ({ label: GAME_NAMES[k], icon: 'tab', onClick: () => {
        this.gameTab = k;
        const e = Object.values(this.app.mod.chargen).find((q) => q.game === k);
        this.focusTab({ key: k, game: k, ent: e || null }, true);
      } })), { small: true, icon: 'tab' })));
    body.append(panel('The character screen', el, { key: 'cg-over' }));
  }

  // The tab's own: its name on the screen, what it says, hidden or not.
  tabBody(t, g) {
    const el = h('div');
    el.append(field('On the tab', textInput({ value: t ? t.title || '' : '', max: 18, placeholder: g ? GAME_NAMES[g].toUpperCase() : 'NEW', onChange: (v) => this.set((x) => (x.title = v.trim().slice(0, 18)), { strip: true }) }), { tip: 'Its name on the screen (in capitals there).' }));
    if (!g) el.append(field('It says', textInput({ value: t.about || '', long: true, max: 200, placeholder: 'A line or two at the top of the tab.', onChange: (v) => this.set((x) => (x.about = v.trim())) }), { wide: true }));
    el.append(check(g ? 'Hide this tab (the game\'s own as it is otherwise)' : 'Hidden for now (kept, not shown)', !!(t && t.hide), (v) => this.set((x) => (x.hide = v), { strip: true })));
    if (g) el.append(h('div', { class: 'note', style: { marginTop: '6px' } }, t ? 'The mod\'s change to the game\'s own tab. Right-click it below to set it back as the game has it.' : 'The game\'s own, as it is. Change anything here and the mod keeps a change to it.'));
    else el.append(h('div', { class: 'row', style: { marginTop: '6px' } }, button('Delete the tab', { icon: 'trash', small: true, kind: 'ghost', onClick: () => this.app.remove('chargen', this.id) })));
    return el;
  }

  // Which of a game tab's own rows (and origins, gear, traits) show.
  gameRowsBody(t, g) {
    const hide = new Set((t && t.hideRows) || []);
    const flip = (k, on) => this.set((x) => {
      const s = new Set(x.hideRows || []);
      if (on) s.delete(k);
      else s.add(k);
      x.hideRows = [...s];
    });
    const el = h('div');
    const rows = GAME_ROWS[g] || [];
    if (rows.length) {
      const box = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '2px 12px' } });
      for (const [k, label] of rows) box.append(check(label, !hide.has(k), (v) => flip(k, v)));
      el.append(h('div', { class: 'note' }, 'Rows shown on it (the name always is):'), box);
    }
    const group = (title, list, pre) => {
      const box = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '2px 12px' } });
      for (const [k, label] of list) box.append(check(label, !hide.has(`${pre}:${k}`), (v) => flip(`${pre}:${k}`, v)));
      el.append(h('div', { class: 'note', style: { marginTop: '6px' } }, title), box);
    };
    if (g === 'basics') {
      group('Origins to choose from:', Object.entries(ORIGINS).map(([k, o]) => [k, o.name]), 'origin');
      group('Starting gear to choose from:', Object.entries(KITS).map(([k, o]) => [k, o.name]), 'kit');
    }
    if (g === 'traits') {
      group('Traits to choose from:', Object.entries(TRAITS).filter(([, o]) => !o.flaw).map(([k, o]) => [k, o.name]), 'trait');
      group('Flaws to choose from:', Object.entries(TRAITS).filter(([, o]) => o.flaw).map(([k, o]) => [k, o.name]), 'trait');
    }
    if (g === 'stats') el.append(h('div', { class: 'note' }, 'The four stats and their points are the game\'s own. Rows of the mod\'s go under them; choices anywhere can add to stats.'));
    return el.children.length ? el : null;
  }

  // The rows of a tab: a line each, to choose, move and take away.
  rowsBody(t, g) {
    const el = h('div');
    const rows = (t && t.rows) || [];
    const list = h('div', { class: 'list' });
    rows.forEach((r, i) => {
      const K = KIND_INFO[r.kind] || KIND_INFO.pick;
      const li = h('div', { class: `li${r.id === this.row ? ' on' : ''}` }, ic(K[1], 11), h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } }, r.label || r.id), h('span', { class: 'note' }, K[0].toLowerCase()));
      const tools = h('span', { class: 'row', style: { gap: '1px' } },
        button(null, { icon: 'up', small: true, kind: 'ghost', title: 'Higher up', disabled: i === 0, onClick: (e) => {
          e.stopPropagation();
          this.set((x) => x.rows.splice(i - 1, 0, x.rows.splice(i, 1)[0]), { side: true });
        } }),
        button(null, { icon: 'trash', small: true, kind: 'ghost', title: 'Take it away', onClick: (e) => {
          e.stopPropagation();
          if (this.row === r.id) this.row = null;
          this.pick = null;
          this.set((x) => x.rows.splice(i, 1), { side: true });
        } }));
      li.append(tools);
      li.addEventListener('click', () => {
        this.row = r.id;
        this.pick = null;
        this.sync(false);
        this.drawSide();
      });
      list.append(li);
    });
    if (!rows.length) list.append(h('div', { class: 'note' }, g ? 'None of the mod\'s yet.' : 'Nothing on it yet: add a row.'));
    const kinds = g ? ['pick', 'text'] : Object.keys(KIND_INFO);
    el.append(list, h('div', { class: 'row', style: { marginTop: '6px' } }, menuButton('Add a row', kinds.map((k) => ({ label: KIND_INFO[k][0], icon: KIND_INFO[k][1], tip: KIND_INFO[k][2], onClick: () => this.addRow(k) })), { small: true, icon: 'plus' })));
    if (g) el.append(h('div', { class: 'note', style: { marginTop: '4px' } }, 'On the game\'s tabs: choices of one, and words.'));
    return el;
  }

  // One row: its label and kind, and its choices (or points).
  rowBody(r) {
    const el = h('div');
    const t = this.t;
    const setR = (fn, side = false) => this.set((x) => {
      const q = (x.rows || []).find((y) => y.id === r.id);
      if (q) fn(q);
    }, { side });
    el.append(field('Label', textInput({ value: r.label || '', max: 15, onChange: (v) => setR((q) => (q.label = v.trim() || q.label), true) }), { tip: 'On the screen, at the left (15 letters show).' }));
    const kinds = t.game ? ['pick', 'text'] : Object.keys(KIND_INFO);
    el.append(field('Kind', seg(kinds.map((k) => [k, KIND_INFO[k][0], KIND_INFO[k][2]]), r.kind || 'pick', (v) => setR((q) => {
      q.kind = v;
      if ((v === 'pick' || v === 'many') && !(q.options || []).length) q.options = [{ id: 'one', name: 'One', about: '' }];
      if (v === 'points' && !(q.entries || []).length) {
        q.entries = [{ id: 'one', name: 'One', about: '', max: 3 }];
        q.points = q.points || 3;
      }
      this.pick = null;
    }, true))));
    el.append(field('About it', textInput({ value: r.about || '', long: true, max: 200, placeholder: 'Shown when the row\'s chosen.', onChange: (v) => setR((q) => (q.about = v.trim())) }), { wide: true }));
    const kind = r.kind || 'pick';
    if (kind === 'pick' || kind === 'many') {
      el.append(h('div', { class: 'note', style: { margin: '6px 0 2px' } }, h('b', null, 'Its choices'), ' (drag things from the explorer here: an item gives it, a creature comes along, a story begins):'));
      el.append(this.subList(r, 'options'));
      if (kind === 'pick') el.append(field('Starts on', select((r.options || []).map((o) => [o.id, o.name || o.id]), r.def || (r.options || [])[0]?.id || '', (v) => setR((q) => (q.def = v)))));
      else el.append(field('How many', numberInput({ value: r.max || 1, min: 1, max: 20, int: true, onChange: (v) => setR((q) => (q.max = v), true) }), { tip: 'At most this many may be ticked.' }));
    } else if (kind === 'points') {
      el.append(field('Points', numberInput({ value: r.points || 3, min: 1, max: 30, int: true, onChange: (v) => setR((q) => (q.points = v)) }), { tip: 'How many there are to spend.' }));
      el.append(h('div', { class: 'note', style: { margin: '6px 0 2px' } }, h('b', null, 'What they go on'), ' (each point gives what it gives):'));
      el.append(this.subList(r, 'entries'));
    } else el.append(h('div', { class: 'note', style: { marginTop: '6px' } }, 'What\'s written is kept with the character.'));
    // (How the mod's graphs read it.)
    const read = kind === 'points' ? `${r.id}.<one of them> (each one's points)` : kind === 'many' ? `${r.id} (those ticked, with commas between)` : r.id;
    el.append(h('div', { class: 'note', style: { marginTop: '8px' } }, h('b', null, 'Graphs read it: '), `Variable "${read}", kept with the Player.`));
    return el;
  }

  // A row's choices (or points' places): to choose, move and take away;
  // things dropped in from the explorer as new ones.
  subList(r, list) {
    const items = r[list] || [];
    const el = h('div', { class: 'list cg-sub' });
    const setL = (fn, side = true) => this.set((x) => {
      const q = (x.rows || []).find((y) => y.id === r.id);
      if (q) fn((q[list] ||= []), q);
    }, { side });
    items.forEach((o, i) => {
      const sel = this.pick && this.pick.list === list && this.pick.id === o.id;
      const gives = effectsText(this.app.mod, o.effects);
      const li = h('div', { class: `li${sel ? ' on' : ''}`, 'data-tip': gives || null }, this.optIcon(o), h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, o.name || o.id), gives ? h('span', { class: 'note' }, ic('star', 9)) : null);
      li.append(h('span', { class: 'row', style: { gap: '1px' } },
        button(null, { icon: 'up', small: true, kind: 'ghost', title: 'Higher up', disabled: i === 0, onClick: (e) => {
          e.stopPropagation();
          setL((L) => L.splice(i - 1, 0, L.splice(i, 1)[0]));
        } }),
        button(null, { icon: 'trash', small: true, kind: 'ghost', title: 'Take it away', disabled: items.length < 2 && list === 'options', onClick: (e) => {
          e.stopPropagation();
          if (sel) this.pick = null;
          setL((L) => L.splice(i, 1));
        } })));
      li.addEventListener('click', () => {
        this.pick = { list, id: o.id };
        this.row = r.id;
        this.sync(false);
        this.drawSide();
      });
      if (list === 'options') dropTarget(li, takes, (p) => setL((L) => {
        const q = L.find((y) => y.id === o.id);
        const f = fromThing(p);
        if (!q || !f) return;
        if (f.art) q.art = f.art;
        else q.effects = merge(q.effects, f.effects);
        toast(`"${p.name}" goes with "${q.name}" now.`, 'good');
      }));
      el.append(li);
    });
    const add = button(list === 'options' ? 'Add a choice' : 'Add one', { icon: 'plus', small: true, onClick: () => setL((L) => {
      const n = list === 'options' ? 'Choice' : 'Skill';
      const o = { id: uid(L, `${n} ${L.length + 1}`), name: `${n} ${L.length + 1}`, about: '' };
      if (list === 'entries') o.max = 3;
      L.push(o);
      this.pick = { list, id: o.id };
    }) });
    el.append(h('div', { class: 'row', style: { marginTop: '4px' } }, add));
    if (list === 'options') dropTarget(el, takes, (p) => setL((L) => {
      const f = fromThing(p);
      const o = { id: uid(L, p.name), name: String(p.name || 'Choice').slice(0, 24), about: '', ...f };
      L.push(o);
      this.pick = { list, id: o.id };
    }));
    return el;
  }

  optIcon(o) {
    if (o.art && this.app.mod.assets[o.art]) {
      const th = this.app.thumb('assets', o.art);
      if (th) return h('span', { class: 'thumb', style: { width: '16px', height: '16px', display: 'grid', placeItems: 'center' } }, th);
    }
    const e = o.effects || {};
    return ic(e.companion ? 'paw' : (e.items || []).length ? 'sword' : e.story ? 'scroll' : e.effect ? 'sparkle' : o.flaw ? 'warn' : 'dot', 10);
  }

  // Origins, gear or traits of the mod's own (on the game's tabs).
  addsBody(t, k) {
    const items = (t && t.add && t.add[k]) || [];
    const el = h('div');
    const list = h('div', { class: 'list cg-sub' });
    const setA = (fn) => this.set((x) => {
      x.add ||= {};
      fn((x.add[k] ||= []));
    }, { side: true });
    items.forEach((o, i) => {
      const sel = this.pick && this.pick.list === k && this.pick.id === o.id;
      const li = h('div', { class: `li${sel ? ' on' : ''}` }, this.optIcon(o), h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, o.name || o.id), k === 'trait' && o.flaw ? h('span', { class: 'note' }, 'flaw') : null);
      li.append(button(null, { icon: 'trash', small: true, kind: 'ghost', title: 'Take it away', onClick: (e) => {
        e.stopPropagation();
        if (sel) this.pick = null;
        setA((L) => L.splice(i, 1));
      } }));
      li.addEventListener('click', () => {
        this.pick = { list: k, id: o.id };
        this.row = null;
        this.sync(false);
        this.drawSide();
      });
      dropTarget(li, takes, (p) => setA((L) => {
        const q = L.find((y) => y.id === o.id);
        const f = fromThing(p);
        if (!q || !f) return;
        if (f.art) q.art = f.art;
        else q.effects = merge(q.effects, f.effects);
      }));
      list.append(li);
    });
    if (!items.length) list.append(h('div', { class: 'note' }, 'None yet.'));
    const add = button(`Add ${ADD_NAMES[k][0].toLowerCase()}`, { icon: 'plus', small: true, onClick: () => setA((L) => {
      const n = { origin: 'Wanderer', kit: 'Pack', trait: 'Gifted' }[k];
      const o = { id: uid(L, n), name: n, about: '' };
      if (k === 'origin') o.as = 'crash';
      L.push(o);
      this.pick = { list: k, id: o.id };
    }) });
    el.append(list, h('div', { class: 'row', style: { marginTop: '4px' } }, add));
    dropTarget(list, takes, (p) => setA((L) => {
      const o = { id: uid(L, p.name), name: String(p.name || ADD_NAMES[k][0]).slice(0, 24), about: '', ...fromThing(p) };
      if (k === 'origin') o.as = 'crash';
      L.push(o);
      this.pick = { list: k, id: o.id };
    }));
    if (k === 'kit') el.append(h('div', { class: 'note', style: { marginTop: '4px' } }, 'Chosen, it\'s instead of the game\'s gear (the bread and torches everyone gets still come).'));
    return el;
  }

  // ------------------------------------------------------------ one choice
  pickKey() {
    return this.pick ? `${this.id}/${this.row || ''}/${this.pick.list}/${this.pick.id}` : '';
  }

  picked(t) {
    const p = this.pick;
    if (!p) return null;
    if (p.list === 'options' || p.list === 'entries') {
      const r = (t.rows || []).find((q) => q.id === this.row);
      return r && (r[p.list] || []).find((o) => o.id === p.id) ? { r, o: (r[p.list] || []).find((o) => o.id === p.id), list: p.list } : null;
    }
    const o = ((t.add || {})[p.list] || []).find((q) => q.id === p.id);
    return o ? { r: null, o, list: p.list } : null;
  }

  pickTitle(x) {
    const what = { options: 'Choice', entries: 'Points on', origin: 'Origin', kit: 'Gear', trait: x.o.flaw ? 'Flaw' : 'Trait' }[x.list];
    return `${what}: ${x.o.name || x.o.id}`;
  }

  // Its own and what it gives. (Found afresh in what's kept, each change.)
  pickBody(x) {
    const app = this.app;
    const p = this.pick;
    const row = this.row;
    const find = (t) => {
      if (p.list === 'options' || p.list === 'entries') {
        const r = (t.rows || []).find((q) => q.id === row);
        return r ? (r[p.list] || []).find((o) => o.id === p.id) : null;
      }
      return ((t.add || {})[p.list] || []).find((o) => o.id === p.id);
    };
    const setO = (fn, side = false) => this.set((t) => {
      const o = find(t);
      if (o) fn(o);
    }, { side });
    const o = x.o;
    const el = h('div');
    el.append(field('Name', textInput({ value: o.name || '', max: 24, onChange: (v) => setO((q) => (q.name = v.trim() || q.name), true) })));
    el.append(field('About it', textInput({ value: o.about || '', long: true, max: 240, placeholder: 'Shown on the screen when it\'s chosen (what it gives is said after).', onChange: (v) => setO((q) => (q.about = v.trim())) }), { wide: true }));
    if (x.list !== 'entries') el.append(field('Picture', refPicker(app, 'asset', o.art || null, (v) => setO((q) => {
      if (v) q.art = v;
      else delete q.art;
    }, true), { tip: 'Shown by the character on the screen while it\'s chosen. Drag art here.' })));
    if (x.list === 'entries') el.append(field('Most points', numberInput({ value: o.max || 0, min: 0, max: 10, int: true, onChange: (v) => setO((q) => (q.max = v)) }), { tip: '0: as many as there are.' }));
    if (x.list === 'origin') el.append(field('They begin', seg([['crash', 'Washed ashore', 'As the game\'s Crash Landing: on a beach (or where the world map says)'], ['native', 'At home', 'As the game\'s Native: born in a town, with a family'], ['star', 'Fallen', 'As the game\'s Fallen Star: a crater, and a wing']], o.as || 'crash', (v) => setO((q) => (q.as = v)))));
    if (x.list === 'trait') el.append(check('A flaw (gives one more good pick)', !!o.flaw, (v) => setO((q) => (q.flaw = v), true)));
    el.append(h('div', { class: 'note', style: { margin: '8px 0 4px' } }, h('b', null, x.list === 'entries' ? 'Each point gives' : 'Choosing it gives'), ' (drag things from the explorer here):'));
    el.append(this.effectsBody(o, (fn, side) => setO((q) => {
      q.effects ||= {};
      fn(q.effects);
    }, side)));
    return el;
  }

  // What choosing something gives: the parts it has, each to change or take
  // away, and the rest to add.
  effectsBody(o, setE) {
    const app = this.app;
    const e = o.effects || {};
    const el = h('div', { class: 'cg-gives' });
    // (Parts just added, still empty: shown till another choice is.)
    const adding = this.adding && this.adding.key === this.pickKey() ? this.adding.kinds : new Set();
    const has = (k) => {
      const v = e[k];
      if (adding.has(k)) return true;
      if (k === 'items' || k === 'traits') return Array.isArray(v) && v.length > 0;
      if (k === 'stats' || k === 'flags' || k === 'look') return v && typeof v === 'object' && Object.keys(v).length > 0;
      return v !== undefined && v !== null && v !== '' && v !== 0;
    };
    const part = (k, label, icon, body) => {
      const x = button(null, { icon: 'close', small: true, kind: 'ghost', title: 'Take it away', onClick: () => {
        adding.delete(k);
        setE((q) => delete q[k], true);
      } });
      el.append(h('div', { class: 'cg-give' }, h('div', { class: 'gh' }, ic(icon, 10), h('span', { class: 'grow' }, label), x), body));
    };
    for (const [k, label, icon] of GIVES) {
      if (!has(k)) continue;
      if (k === 'items') part(k, label, icon, this.itemsBody(e.items || [], setE));
      else if (k === 'coins') part(k, label, icon, numberInput({ value: e.coins || 0, min: 0, max: 9999, int: true, onChange: (v) => setE((q) => (q.coins = v)) }));
      else if (k === 'stats') {
        const row = h('div', { class: 'row', style: { gap: '4px' } });
        for (const [s, nm] of STATS4) row.append(h('span', { class: 'note' }, nm), numberInput({ value: (e.stats || {})[s] || 0, min: -5, max: 5, int: true, onChange: (v) => setE((q) => {
          q.stats ||= {};
          if (v) q.stats[s] = v;
          else delete q.stats[s];
        }) }));
        part(k, label, icon, row);
      } else if (k === 'hp') part(k, `${label} (more or less)`, icon, numberInput({ value: e.hp || 0, min: -20, max: 40, int: true, onChange: (v) => setE((q) => (q.hp = v)) }));
      else if (k === 'traits') part(k, label, icon, chips(Object.entries(TRAITS).map(([tk, T]) => [tk, T.name, T.about]), e.traits || [], (v) => setE((q) => (q.traits = v))));
      else if (k === 'effect') {
        const b = h('div');
        b.append(refPicker(app, 'effect', e.effect || null, (v) => setE((q) => (q.effect = v), true)), field('For (minutes)', numberInput({ value: e.effectMins || 0, min: 0, max: 100000, int: true, onChange: (v) => setE((q) => (q.effectMins = v)) }), { tip: '0: for good (on again whenever it wears off).' }));
        part(k, label, icon, b);
      } else if (k === 'companion') part(k, `${label} (at their heel; back in the morning if it falls)`, icon, refPicker(app, 'creature', e.companion || null, (v) => setE((q) => (q.companion = v), true)));
      else if (k === 'story') part(k, label, icon, refPicker(app, 'story', e.story || null, (v) => setE((q) => (q.story = v), true), { tip: 'Begun in the first moments of the game, in a town near them.' }));
      else if (k === 'flags') part(k, label, icon, this.flagsBody(e.flags || {}, setE));
      else if (k === 'look') part(k, label, icon, this.lookBody(e.look || {}, setE));
      else if (k === 'start') part(k, label, icon, this.startBody(e.start, setE));
    }
    const missing = GIVES.filter(([k]) => !has(k));
    if (!el.children.length) el.append(h('div', { class: 'note' }, 'Nothing yet.'));
    if (missing.length) el.append(h('div', { class: 'row', style: { marginTop: '4px' } }, menuButton('It gives...', missing.map(([k, label, icon]) => ({ label, icon, onClick: (ev) => {
      if (!this.adding || this.adding.key !== this.pickKey()) this.adding = { key: this.pickKey(), kinds: new Set() };
      this.adding.kinds.add(k);
      if (k === 'items') pickRef(app, 'item', (ev && ev.currentTarget) || this.sideBody || this.insp, (v) => v && setE((q) => (q.items = [...(q.items || []), [v, 1]]), true));
      if (k === 'start') setE((q) => (q.start = 'spawn'), true);
      else this.drawSide();
    } })), { small: true, icon: 'plus' })));
    dropTarget(el, (p) => takes(p) && p.kind !== 'assets', (p) => setE((q) => Object.assign(q, merge(q, fromThing(p).effects)), true));
    return el;
  }

  itemsBody(items, setE) {
    const app = this.app;
    const el = h('div', { class: 'wlist' });
    items.forEach(([it, n], i) => {
      const nm = refLabel(app, 'item', it) || it;
      el.append(h('div', { class: 'wrow', style: { gridTemplateColumns: '26px 1fr 64px 24px' } },
        h('span', { class: 'ico' }, refThumb(app, 'item', it) || ic('sword', 10)), h('span', { class: 'nm' }, nm),
        numberInput({ value: n || 1, min: 1, max: 999, int: true, onChange: (v) => setE((q) => (q.items[i][1] = v)) }),
        button(null, { icon: 'close', small: true, kind: 'ghost', title: 'Take it off', onClick: () => setE((q) => q.items.splice(i, 1), true) })));
    });
    el.append(h('div', { class: 'row' }, button('Add a thing', { icon: 'plus', small: true, onClick: (ev) => pickRef(app, 'item', ev.currentTarget, (v) => v && setE((q) => (q.items = [...(q.items || []), [v, 1]]), true)) })));
    dropTarget(el, (p) => p.kind === 'entities' && ITEM_TPL.includes(p.tpl), (p) => setE((q) => (q.items = [...(q.items || []), [`@${p.id}`, 1]]), true));
    return el;
  }

  flagsBody(flags, setE) {
    const el = h('div');
    for (const [k, v] of Object.entries(flags)) {
      el.append(h('div', { class: 'row', style: { marginBottom: '2px' } },
        textInput({ value: k, max: 24, onChange: (nv) => setE((q) => {
          const name = nv.trim().replace(/[^\w.-]/g, '_');
          if (!name || name === k) return;
          q.flags[name] = q.flags[k];
          delete q.flags[k];
        }, true) }),
        h('span', { class: 'note' }, '='),
        textInput({ value: String(v), max: 40, onChange: (nv) => setE((q) => (q.flags[k] = /^-?\d+(\.\d+)?$/.test(nv.trim()) ? Number(nv.trim()) : nv.trim())) }),
        button(null, { icon: 'close', small: true, kind: 'ghost', onClick: () => setE((q) => delete q.flags[k], true) })));
    }
    el.append(h('div', { class: 'row' }, button('Add a value', { icon: 'plus', small: true, onClick: () => setE((q) => {
      q.flags ||= {};
      let i = 1;
      while (q.flags[`value${i}`] !== undefined) i++;
      q.flags[`value${i}`] = 1;
    }, true) })));
    el.append(h('div', { class: 'note' }, 'Kept with the character: a graph\'s Variable (kept with the Player) reads them by name.'));
    return el;
  }

  lookBody(look, setE) {
    const el = h('div');
    for (const [k, v] of Object.entries(look)) {
      el.append(h('div', { class: 'row', style: { marginBottom: '2px' } }, h('span', { class: 'grow' }, LOOK_NAMES[k] || k),
        colorButton(v || '#808080', (c) => setE((q) => (q.look[k] = c))),
        button(null, { icon: 'close', small: true, kind: 'ghost', onClick: () => setE((q) => delete q.look[k], true) })));
    }
    const left = LOOK_KEYS.filter((k) => look[k] === undefined);
    if (left.length) el.append(h('div', { class: 'row' }, menuButton('A colour', left.map((k) => ({ label: LOOK_NAMES[k] || k, onClick: () => setE((q) => {
      q.look ||= {};
      q.look[k] = LOOK_DEF[k] || '#a05030';
    }, true) })), { small: true, icon: 'plus' })));
    return el;
  }

  // Where they begin: where the world map says, or one of its places.
  startBody(v, setE) {
    const app = this.app;
    const opts = [['spawn', 'Where the world map has characters begin']];
    for (const w of Object.values(app.mod.worlds || {})) {
      for (const p of w.places || []) {
        const t = app.mod[p.kind] && app.mod[p.kind][p.ref];
        opts.push([p.id, `By ${t ? t.name : p.ref} (${w.name})`]);
      }
    }
    const el = h('div');
    el.append(select(opts, v || 'spawn', (nv) => setE((q) => (q.start = nv))));
    if (!Object.keys(app.mod.worlds || {}).length) el.append(h('div', { class: 'note' }, 'The mod has no world map yet: make one (the World tool) to set where they begin, and places to begin by.'));
    else if (opts.length === 1) el.append(h('div', { class: 'note' }, 'Set places down on the world map to begin by one.'));
    return el;
  }
}

// Two lots of what something gives, together.
function merge(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    if (k === 'items') out.items = [...(out.items || []), ...v];
    else out[k] = v;
  }
  return out;
}
