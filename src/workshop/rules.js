// The Workshop's Rules tab (round 66): the game's own rules, as the mod
// changes them for every world it's turned on in (see mod/rules.js): how
// fast blocks break and crops grow, the hearts you start with, how hard
// blows land, how many creatures roam, how long a day is, what things
// cost; and any item, block or creature of the game's (or the mod's) with
// its numbers changed.
import { h, ic, clear, button, toast, slider, textInput } from './kit.js';
import { pickRef, refLabel, refThumb, vanillaIcon } from './common.js';
import { pickBlock, blockLabel } from './pickers.js';
import { WORLD_RULES, ITEM_FIELDS, BLOCK_FIELDS, CREATURE_FIELDS } from '../mod/rules.js';
import { ITEMS } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';
import { SPECIES } from '../entities/creature.js';

// A thing's numbers as the game has them (to show what a change is from).
function gameValue(kind, key, f) {
  if (typeof key !== 'string' || key[0] === '@') return null;
  if (kind === 'items') {
    const it = ITEMS[key];
    if (!it) return null;
    if (f === 'armor' || f === 'block') return typeof it[f] === 'number' ? Math.round(it[f] * 100) : null;
    return it[f] ?? null;
  }
  if (kind === 'blocks') {
    const b = BLOCKS.find((q) => q && q.name === key);
    return b ? b[f] ?? null : null;
  }
  const S = SPECIES[key];
  if (!S) return null;
  if (f === 'speed') return 100;
  return S[f] ?? null;
}

const KINDS = [
  { key: 'items', name: 'Items', one: 'an item', fields: ITEM_FIELDS, icon: 'sword', tip: 'Arms, armour, tools, food: their numbers.' },
  { key: 'blocks', name: 'Blocks', one: 'a block', fields: BLOCK_FIELDS, icon: 'cube', tip: 'How hard a block is to break, how bright it shines, what it\'s called.' },
  { key: 'creatures', name: 'Creatures', one: 'a creature', fields: CREATURE_FIELDS, icon: 'paw', tip: 'Beasts, monsters, bosses: their health, how hard they hit, how fast they go, how far off they see you.' },
];

export default class RulesTool {
  constructor(app) {
    this.app = app;
    // (Things picked to change, `kind:ref`, kept on show while unchanged.)
    this.open = new Set();
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    if (this.openFor !== this.app.mod?.id) this.open.clear();
    this.openFor = this.app.mod?.id;
    this.draw();
  }

  unmount() {}

  current() {
    return null;
  }

  open() {
    this.draw();
  }

  reload() {
    this.draw();
  }

  hintText() {
    return 'Rules change every world the mod is on in. 100% is as the game has it; a change to a thing shows what the game has it at, faded.';
  }

  get rules() {
    return this.app.mod.rules || null;
  }

  // A change to the rules: remembered for Undo, saved. (Rules all as the
  // game has them: none kept at all.)
  set(fn, redraw = false) {
    const app = this.app;
    app.checkpoint('meta', 'meta');
    const m = app.mod;
    if (!m.rules) m.rules = {};
    fn(m.rules);
    for (const k of ['items', 'blocks', 'creatures']) {
      const o = m.rules[k];
      if (o) for (const [ref, ch] of Object.entries(o)) if (!ch || !Object.keys(ch).length) delete o[ref];
      if (o && !Object.keys(o).length) delete m.rules[k];
    }
    if (!Object.keys(m.rules).length) delete m.rules;
    app.touch('meta');
    if (redraw) this.draw();
    else this.drawCount();
  }

  changes() {
    const r = this.rules;
    if (!r) return 0;
    let n = WORLD_RULES.filter((W) => typeof r[W.key] === 'number' && r[W.key] !== W.def).length;
    for (const K of KINDS) n += Object.keys(r[K.key] || {}).length;
    return n;
  }

  drawCount() {
    if (this.countEl) this.countEl.textContent = this.changes() ? `${this.changes()} changed` : 'As the game has them';
  }

  draw() {
    // (Where you'd scrolled to, kept: a card added at the foot is in view.)
    const was = this.stage.querySelector('.rules');
    const top = was ? was.scrollTop : 0;
    clear(this.stage);
    clear(this.insp);
    const r = this.rules || {};
    const wrap = h('div', { class: 'home scroll rules' });
    this.countEl = h('span', { class: 'note' });
    wrap.append(h('div', { class: 'home-head' }, h('div', { class: 'modicon', style: { background: '#2a3878', width: '48px', height: '48px' } }, ic('scales', 24)),
      h('div', { class: 'grow' }, h('h1', { style: { margin: 0 } }, 'Rules'), this.countEl),
      button('All as the game has them', { icon: 'undo', small: true, title: 'Every rule and every change here put back', onClick: () => {
        if (!this.rules) return;
        this.set((x) => {
          for (const k of Object.keys(x)) delete x[k];
        }, true);
        toast('All the rules are the game\'s again.');
      } })),
    h('div', { class: 'sub' }, 'The game\'s own rules, changed for every world the mod is turned on in (single player or multiplayer). Percents are against the game\'s own: 100 is as it is, 200 twice as much, 50 half. With several mods, their percents multiply.'));
    // The world's rules, in their groups.
    const groups = [...new Set(WORLD_RULES.map((W) => W.group))];
    const grid = h('div', { class: 'rules-grid' });
    for (const g of groups) {
      const box = h('div', { class: 'rules-box' }, h('h3', null, g));
      for (const W of WORLD_RULES.filter((q) => q.group === g)) box.append(this.ruleRow(W, r));
      grid.append(box);
    }
    wrap.append(h('h2', null, 'The world'), grid);
    // Things, changed.
    for (const K of KINDS) wrap.append(this.thingSection(K));
    this.stage.append(wrap);
    wrap.scrollTop = top;
    this.drawCount();
  }

  ruleRow(W, r) {
    const v = typeof r[W.key] === 'number' ? r[W.key] : W.def;
    const changed = v !== W.def;
    const row = h('div', { class: `rule-row${changed ? ' changed' : ''}`, 'data-tip': W.tip });
    const reset = button(null, { icon: 'undo', small: true, kind: 'ghost', title: `As the game has it (${W.def}${W.unit === '%' ? '%' : ''})`, onClick: () => this.set((x) => delete x[W.key], true) });
    reset.style.visibility = changed ? 'visible' : 'hidden';
    const step = W.unit === '%' ? 5 : W.unit === 's' ? 1 : 1;
    const sl = slider({ value: v, min: W.min, max: W.unit === '%' ? Math.min(W.max, 500) : W.max, step, int: true, onChange: (nv) => {
      this.set((x) => {
        if (nv === W.def) delete x[W.key];
        else x[W.key] = nv;
      });
      row.classList.toggle('changed', nv !== W.def);
      reset.style.visibility = nv !== W.def ? 'visible' : 'hidden';
    } });
    row.append(h('span', { class: 'rn' }, W.name), sl, h('span', { class: 'ru note' }, W.unit === '%' ? '%' : W.unit === 's' ? 'sec' : W.unit), reset);
    return row;
  }

  thingSection(K) {
    const app = this.app;
    const r = this.rules || {};
    const list = r[K.key] || {};
    const sec = h('div', { class: 'rules-things' });
    const add = button(`Change ${K.one}...`, { icon: 'plus', small: true, kind: 'primary', onClick: (e) => {
      const anchor = e.currentTarget;
      const pick = (ref) => {
        if (!ref) return;
        if (list[ref] || this.open.has(`${K.key}:${ref}`)) {
          toast('That one\'s already here: change it below.');
          return;
        }
        // (Round 78) Shown to be changed, though nothing's changed on it
        // yet: a change with nothing in it isn't kept in the mod (see set),
        // and the card used to vanish the moment it was picked.
        this.open.add(`${K.key}:${ref}`);
        this.draw();
      };
      if (K.key === 'blocks') pickBlock(app, anchor, null, pick);
      else pickRef(app, K.key === 'items' ? 'item' : 'creature', anchor, pick);
    } });
    sec.append(h('h2', null, K.name, h('span', { class: 'note', style: { marginLeft: '10px', fontFamily: 'var(--mono)', fontSize: '12px' } }, K.tip)), add);
    const refs = [...new Set([...Object.keys(list), ...[...this.open].filter((k) => k.startsWith(`${K.key}:`)).map((k) => k.slice(K.key.length + 1))])];
    if (!refs.length) sec.append(h('div', { class: 'note', style: { marginTop: '6px' } }, `None changed: ${K.key} are as they are.`));
    for (const ref of refs) sec.append(this.thingCard(K, ref, list[ref] || {}));
    return sec;
  }

  thingCard(K, ref, ch) {
    const app = this.app;
    const t = K.key === 'items' ? 'item' : K.key === 'blocks' ? 'block' : 'creature';
    const label = K.key === 'blocks' ? blockLabel(app, ref) : refLabel(app, t, ref);
    let thumb = null;
    try {
      thumb = ref[0] === '@' ? refThumb(app, K.key === 'blocks' ? 'block' : t, ref) : vanillaIcon(K.key === 'creatures' ? 'creature' : 'item', ref);
    } catch {
      thumb = null;
    }
    const card = h('div', { class: 'rule-card' });
    const head = h('div', { class: 'rc-head' }, h('span', { class: 'thumb' }, thumb || ic(K.icon)), h('b', null, label || ref), h('span', { class: 'note' }, ref[0] === '@' ? 'yours' : ref), h('span', { class: 'grow' }),
      button(null, { icon: 'trash', small: true, kind: 'ghost', title: 'As the game has it', onClick: () => {
        this.open.delete(`${K.key}:${ref}`);
        this.set((x) => x[K.key] && delete x[K.key][ref], true);
      } }));
    const body = h('div', { class: 'rc-fields' });
    for (const [f, name, kind] of K.fields) {
      const gv = gameValue(K.key, ref, f);
      // (What a thing can't have, left out: a sword's heals, bread's reach.)
      if (K.key === 'items' && ref[0] !== '@' && gv === null && f !== 'name') continue;
      const v = ch[f];
      const setF = (nv) => this.set((x) => {
        x[K.key] ||= {};
        const c = (x[K.key][ref] ||= {});
        if (nv === null || nv === '' || nv === undefined) delete c[f];
        else c[f] = nv;
      });
      let input;
      if (kind === 'text') {
        input = textInput({ value: v ?? '', max: 32, placeholder: gv ?? (f === 'name' && ref[0] !== '@' ? label : ''), onChange: (nv) => setF(nv.trim() || null) });
      } else {
        input = textInput({ value: v ?? '', max: 12, placeholder: gv === null ? '-' : String(Math.round(gv * 1000) / 1000), onChange: (nv) => {
          const n = parseFloat(nv);
          setF(Number.isFinite(n) ? n : null);
        } });
        input.classList.add('num');
      }
      body.append(h('label', { class: `rc-f${v !== undefined ? ' on' : ''}`, 'data-tip': gv !== null ? `The game has it at ${typeof gv === 'number' ? Math.round(gv * 1000) / 1000 : gv}. Empty: as it is.` : 'Empty: as it is.' }, h('span', null, name), input));
    }
    card.append(head, body);
    return card;
  }
}
