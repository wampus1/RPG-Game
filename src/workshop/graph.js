// The Graph tool (round 62): entities as visual code. Every entity (a
// block, an item, a creature, a boss, an effect, a world event, a recipe,
// a projectile) is a graph with a template node at its root: its inputs
// are what the entity is, its outputs the moments something happens to it.
// Wire those into actions (damage, spawn, play an effect, say something),
// flow (if, chance, wait, repeat) and values (numbers, places, the nearest
// foe); give creatures and bosses abilities of their own. Drag art,
// effects, loot tables and other entities in from the explorer to use them.
import { h, ic, clear, button, field, panel, toast, contextMenu } from './kit.js';
import { NodeCanvas, valueWidget } from './nodecanvas.js';
import { titleBar, refPicker, refInfo, biomeOptions } from './common.js';
import { NODES, CATS, TYPE_COLORS, fits, makeNode, lint } from '../mod/graph.js';
import { TEMPLATES, TEMPLATE_INFO, BIOME_LIST } from '../mod/nodes.js';

const REF_KIND = { assets: 'ref.asset', vfx: 'ref.vfx', rigs: 'ref.rig', loot: 'ref.loot', structures: 'ref.structure', stories: 'ref.story' };
const ENT_REF = { 'tpl.block': 'ref.block', 'tpl.animal': 'ref.creature', 'tpl.hostile': 'ref.creature', 'tpl.npc': 'ref.creature', 'tpl.boss': 'ref.creature', 'tpl.effect': 'ref.effect', 'tpl.projectile': 'ref.projectile' };
const ITEM_TPLS = ['tpl.food', 'tpl.weapon', 'tpl.tool', 'tpl.armor', 'tpl.material'];

// What each template starts with besides itself (to show how it's done).
const L = (a, ap, b, bp) => ({ id: `l${Math.random().toString(36).slice(2, 9)}`, from: [a.id, ap], to: [b.id, bp] });
export function starter(root) {
  const t = root.type;
  const x = root.x;
  const y = root.y;
  const nodes = [];
  const links = [];
  const notes = [];
  const add = (type, dx, dy, o = {}) => {
    const n = makeNode(type, x + dx, y + dy, o);
    nodes.push(n);
    return n;
  };
  if (t === 'tpl.weapon') {
    const p = add('act.particles', 380, 40, { v: { color: '#ffd070', color2: '#ffffff', count: 10 }, p: { shape: 'star' } });
    links.push(L(root, 'onHit', p, 'in'), L(root, 'foe', p, 'at'));
    notes.push({ x: x + 380, y: y - 110, w: 300, h: 100, text: 'On hit runs for every foe struck. Add a Damage, a condition (Give a condition) or an effect after the sparks.', color: '#2a4a6a' });
  } else if (t === 'tpl.food') {
    const m = add('act.message', 380, 40, { v: { text: 'You feel refreshed.', color: '#80e070' } });
    links.push(L(root, 'onUse', m, 'in'));
  } else if (t === 'tpl.hostile') {
    const ab = add('ev.ability', 380, 260, { v: { name: 'Pounce', cooldown: 7, windup: 0.6, min: 2, max: 5 } });
    const ch = add('atk.charge', 720, 260, { v: { far: 5, damage: 4 } });
    links.push(L(ab, 'cast', ch, 'in'));
    notes.push({ x: x + 380, y: y + 190, w: 560, h: 56, text: 'An ability: used when its foe is between 2 and 5 paces off, every 7 seconds at most.', color: '#6a2a2a' });
  } else if (t === 'tpl.npc') {
    const s1 = add('dlg.say', 380, 0, { v: { text: 'Well met, {player}. Not many come this way.', a: 'Who are you?', b: 'Goodbye.' } });
    const s2 = add('dlg.say', 740, -80, { v: { text: 'Just {self}. I keep an eye on the road, and the road keeps an eye on me.', a: 'Fair enough.', b: '' } });
    const e = add('dlg.end', 740, 300, { v: { text: 'Safe travels.' } });
    links.push(L(root, 'onTalk', s1, 'in'), L(s1, 'ra', s2, 'in'), L(s1, 'rb', e, 'in'));
  } else if (t === 'tpl.boss') {
    const sh = add('act.shout', 380, 0, { v: { text: 'You will not leave this place!' } });
    const a1 = add('ev.ability', 380, 260, { v: { name: 'Ground Slam', cooldown: 6, windup: 0.9, max: 5 } });
    const h1 = add('atk.hazard', 740, 260, { v: { radius: 3, damage: 8, windup: 0.9, color: '#ff8040' }, p: { shape: 'circle' } });
    const a2 = add('ev.ability', 380, 600, { v: { name: 'Shockwaves', cooldown: 10, windup: 0.6, max: 14, fromPhase: 2 } });
    const h2 = add('atk.rings', 740, 600, { v: { count: 3, damage: 6 } });
    links.push(L(a1, 'cast', h1, 'in'), L(a2, 'cast', h2, 'in'), L(root, 'onPhase2', sh, 'in'));
    notes.push({ x: x + 380, y: y + 190, w: 680, h: 56, text: 'Abilities: Ground Slam from the first phase, Shockwaves from the second. Add more: Summon, Charge, Shoot, Blink...', color: '#6a2a2a' });
  } else if (t === 'tpl.event') {
    const m = add('act.message', 380, 40, { v: { text: 'A strange wind blows across the islands.', color: '#a0c8ff' } });
    links.push(L(root, 'fire', m, 'in'));
  } else if (t === 'tpl.block') {
    notes.push({ x: x + 380, y, w: 300, h: 120, text: 'Wire On stepped on into Damage for a trap, On right-click (set Right-click to "graph") into a Message for a sign, On broken into Drop loot for a treasure block.', color: '#7a5a2a' });
  } else if (t === 'tpl.effect') {
    notes.push({ x: x + 380, y, w: 300, h: 100, text: 'Give it with a Consumable (Gives effect), or with Apply effect from any graph. Each second runs On tick.', color: '#2a5a3a' });
  }
  return { nodes, links, notes };
}

export default class GraphTool {
  constructor(app) {
    this.app = app;
    this.id = null;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    if (this.id && this.app.mod.entities[this.id]) this.open('entities', this.id);
    else this.gallery();
  }

  unmount() {
    this.nc?.destroy();
    this.nc = null;
  }

  current() {
    return this.id && this.app.mod.entities[this.id] ? { kind: 'entities', id: this.id } : null;
  }

  hintText() {
    if (!this.id) return 'Pick an entity in the explorer, or start one from a template.';
    return 'Drag from a socket to another to wire them; drop a wire on empty space to add a node there. Space adds a node. Drag things in from the explorer.';
  }

  keyHelp() {
    return [['Space / A', 'Add a node where the pointer is'], ['Drag a socket', 'Wire it (drop on nothing: pick what goes there)'], ['Shift+drag', 'Select several'], ['Delete', 'Delete what\'s selected'], ['Ctrl+C / V / D', 'Copy, paste, duplicate'], ['F', 'See everything'], ['Double-click a wire', 'Remove it']];
  }

  get ent() {
    return this.app.mod.entities[this.id];
  }

  // ------------------------------------------------------------ no entity: the templates
  gallery() {
    this.nc?.destroy();
    this.nc = null;
    this.id = null;
    clear(this.stage);
    clear(this.insp);
    const wrap = h('div', { class: 'home scroll' });
    wrap.append(h('h1', null, 'Entities'), h('div', { class: 'sub' }, 'Everything in the game a mod can add: blocks, items, creatures, people, bosses, lasting effects, world events, recipes and projectiles. Each starts from a template; then wire up what it does.'));
    const groups = {};
    for (const t of TEMPLATES) (groups[TEMPLATE_INFO[t].group] ||= []).push(t);
    for (const [g, list] of Object.entries(groups)) {
      wrap.append(h('h2', null, g));
      const cards = h('div', { class: 'cards' });
      for (const t of list) {
        const c = h('div', { class: 'card tpl-card' }, h('div', { class: 't' }, h('span', { class: 'ico' }, ic(TEMPLATE_INFO[t].icon, 18)), NODES[t].title), h('div', { class: 'd' }, TEMPLATE_INFO[t].blurb));
        c.addEventListener('click', () => this.newFrom(t));
        cards.append(c);
      }
      wrap.append(cards);
    }
    const list = Object.values(this.app.mod.entities);
    if (list.length) {
      wrap.append(h('h2', null, 'In this mod'));
      const cards = h('div', { class: 'cards' });
      for (const e of list) {
        const r = (e.graph.nodes || []).find((n) => NODES[n.type] && NODES[n.type].root);
        const c = h('div', { class: 'card' }, h('div', { class: 't' }, h('span', { class: 'thumb', style: { width: '22px', display: 'inline-grid', placeItems: 'center' } }, this.app.thumb('entities', e.id)), e.name), h('div', { class: 'd' }, r ? NODES[r.type].title : 'No template'));
        c.addEventListener('click', () => this.app.open('entities', e.id));
        cards.append(c);
      }
      wrap.append(cards);
    }
    this.stage.append(wrap);
    this.insp.append(h('div', { class: 'insp-head' }, ic('node'), 'Graph'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open. Pick a template to begin, or an entity in the explorer.')));
  }

  async newFrom(t) {
    const id = await this.app.newEntity(t);
    if (!id) return;
    setTimeout(() => this.nc?.frameAll(), 60);
  }

  // ------------------------------------------------------------ an entity open
  open(kind, id) {
    if (!id || !this.app.mod.entities[id]) return this.gallery();
    const fresh = this.id !== id;
    this.id = id;
    const e = this.ent;
    e.graph ||= { nodes: [], links: [], notes: [] };
    e.graph.notes ||= [];
    this.nc?.destroy();
    clear(this.stage);
    const root = this.root();
    const tpl = root ? NODES[root.type] : null;
    this.zoomEl = h('span', { class: 'note', style: { minWidth: '40px' } }, '100%');
    const bar = titleBar(this.app, 'entities', id,
      tpl ? h('span', { class: 'chip on' }, tpl.title) : h('span', { class: 'chip' }, 'no template'),
      h('span', { class: 'sep' }),
      button('Node', { icon: 'plus', small: true, title: 'Add a node (Space)', onClick: () => {
        const r = this.nc.el.getBoundingClientRect();
        this.nc.addMenu(r.left + r.width / 2 - 150, r.top + 60, this.nc.toWorld(r.left + r.width / 2, r.top + r.height / 2));
      } }),
      button('Note', { icon: 'pencil', small: true, title: 'A note on the canvas, to explain a part', onClick: () => {
        const r = this.nc.el.getBoundingClientRect();
        const at = this.nc.toWorld(r.left + 60, r.top + 60);
        this.nc.addNote(at.x, at.y);
      } }),
      button(null, { icon: 'zoom', small: true, title: 'See everything (F)', onClick: () => this.nc.frameAll() }),
      this.zoomEl,
      h('span', { class: 'spacer' }),
      tpl ? button('How it works', { icon: 'info', small: true, onClick: () => this.helpCard(root) }) : null);
    const wrap = h('div', { class: 'canvas-wrap' });
    this.stage.append(bar, wrap);
    this.nc = new NodeCanvas({
      defs: NODES, fits, colors: TYPE_COLORS, cats: CATS,
      graph: () => this.ent.graph,
      makeNode: (type, x, y) => (NODES[type].root ? null : makeNode(type, x, y)),
      canAdd: (d) => !d.root && !d.story,
      checkpoint: () => this.app.checkpoint('entities', this.id),
      onChange: () => {
        this.app.touch('entities', this.id);
        window.clearTimeout(this.inspT);
        this.inspT = setTimeout(() => this.drawInspector(), 120);
      },
      onSelect: () => this.drawInspector(),
      onView: (z) => this.zoomEl && (this.zoomEl.textContent = `${Math.round(z * 100)}%`),
      widget: (n, p, done) => this.widget(n, p, done, false),
      propWidget: (n, p, done) => this.propWidget(n, p, done, false),
      nodeExtra: (n, body) => this.nodeExtra(n, body),
      nodeMenu: (n) => this.nodeMenu(n),
      onDrop: (p, at) => this.dropped(p, at),
    });
    wrap.append(this.nc.el);
    // The colours of the wires, as a key.
    const legend = h('div', { class: 'nc-legend' });
    for (const [t, label] of [['flow', 'what happens next'], ['entity', 'someone'], ['pos', 'a place'], ['number', 'number'], ['bool', 'yes/no'], ['text', 'text'], ['item', 'item'], ['asset', 'art']]) legend.append(h('span', null, h('i', { style: { background: TYPE_COLORS[t] } }), label));
    wrap.append(legend);
    this.nc.render();
    if (fresh) requestAnimationFrame(() => requestAnimationFrame(() => this.nc && this.nc.frameAll()));
    this.drawInspector();
    this.app.hint(this.hintText());
  }

  root() {
    return (this.ent.graph.nodes || []).find((n) => NODES[n.type] && NODES[n.type].root) || null;
  }

  reload(kind, id) {
    if (kind === 'entities' && id === this.id) {
      const pz = this.nc ? { z: this.nc.zoom, x: this.nc.panX, y: this.nc.panY } : null;
      this.open(kind, id);
      if (pz && this.nc) {
        this.nc.zoom = pz.z;
        this.nc.panX = pz.x;
        this.nc.panY = pz.y;
        this.nc.applyView();
      }
    }
  }

  removed(kind, id) {
    if (kind === 'entities' && id === this.id) this.gallery();
  }

  renamed() {
    if (this.id) this.drawInspector();
  }

  // ------------------------------------------------------------ fields
  set(n, k, v, prop = false) {
    this.app.checkpoint('entities', this.id);
    if (prop) (n.p ||= {})[k] = v;
    else (n.v ||= {})[k] = v;
    this.app.touch('entities', this.id);
  }

  widget(n, p, done, big) {
    const v = n.v ? n.v[p.id] : undefined;
    const t = p.t;
    if (refInfo(t).coll || ['item', 'block', 'creature', 'effect'].includes(t)) {
      return refPicker(this.app, t, v ?? null, (nv) => {
        this.set(n, p.id, nv);
        done();
        if (NODES[n.type].root) this.app.refreshThumb('entities', this.id);
      }, { create: t === 'asset' ? async () => {
        const id = await this.app.newAsset({ name: `${this.ent.name} ${p.label.toLowerCase()}`, w: 16, h: 16 });
        if (id) {
          this.set(n, p.id, id);
          this.app.open('entities', this.id);
        }
      } : null });
    }
    const w = valueWidget(t, v ?? p.def, (nv) => {
      this.set(n, p.id, nv);
      done();
      if (big) this.nc?.refreshNode(n);
      else if (this.nc && this.nc.sel.has(n.id)) this.drawInspector();
    }, { min: p.min, max: p.max, step: p.step, long: p.long, big, opts: this.optsOf(p) });
    return w;
  }

  // (A list of biomes: the game's, and this mod's own.)
  optsOf(p) {
    return p.opts === BIOME_LIST ? biomeOptions(this.app) : p.opts;
  }

  propWidget(n, p, done, big) {
    const v = n.p && n.p[p.id] !== undefined ? n.p[p.id] : p.def;
    if (p.t === 'enum' || p.t === 'multi' || p.t === 'bool' || p.t === 'number') {
      return valueWidget(p.t, v, (nv) => {
        this.set(n, p.id, nv, true);
        done();
        if (big) this.nc?.refreshNode(n);
      }, { opts: this.optsOf(p), min: p.min, max: p.max });
    }
    // (A reference node's own pick.)
    return refPicker(this.app, p.t, v ?? null, (nv) => {
      this.set(n, p.id, nv, true);
      done();
      this.nc?.refreshNode(n);
    });
  }

  // A picture on nodes that hold art.
  nodeExtra(n, body) {
    if (n.type === 'ref.asset' && n.p && n.p.ref && this.app.mod.assets[n.p.ref]) {
      const c = this.app.thumb('assets', n.p.ref);
      body.append(h('div', { class: 'nc-thumb' }, c));
    }
    const d = NODES[n.type];
    if (d && d.root) {
      const v = n.v || {};
      const art = v.icon || v.texture || v.look;
      if (art && this.app.mod.assets[art]) body.prepend(h('div', { class: 'nc-thumb' }, this.app.thumb('assets', art)));
    }
  }

  nodeMenu(n) {
    const d = NODES[n.type];
    const out = [];
    if (d && d.cat === 'Things' && n.p && n.p.ref) {
      const coll = refInfo(d.props[0].t).coll;
      const id = String(n.p.ref).replace(/^@/, '');
      if (coll && this.app.mod[coll] && this.app.mod[coll][id]) out.push({ label: 'Open it', icon: 'folder', onClick: () => this.app.open(coll, id) });
    }
    if (d && d.help) out.push({ label: 'What does it do?', icon: 'info', onClick: () => toast(d.help, '', 7000) });
    return out;
  }

  // Something dragged in from the explorer: a node that holds it.
  dropped(p, at) {
    let type = REF_KIND[p.kind];
    let ref = p.id;
    if (p.kind === 'entities') {
      if (ITEM_TPLS.includes(p.tpl)) type = 'ref.item';
      else type = ENT_REF[p.tpl] || null;
      if (type === 'ref.item' || type === 'ref.block' || type === 'ref.creature') ref = `@${p.id}`;
      if (p.id === this.id && type !== 'ref.creature') {
        toast('That\'s this entity itself.');
      }
    }
    if (!type) return toast('That can\'t be used in a graph.', 'bad');
    this.nc.addNode(type, at.x, at.y);
    const n = this.ent.graph.nodes[this.ent.graph.nodes.length - 1];
    (n.p ||= {}).ref = ref;
    this.nc.refreshNode(n);
    this.app.touch('entities', this.id);
  }

  // ------------------------------------------------------------ the inspector
  drawInspector() {
    clear(this.insp);
    if (!this.id || !this.ent) return;
    const sel = this.nc ? [...this.nc.sel].map((id) => this.ent.graph.nodes.find((n) => n.id === id)).filter(Boolean) : [];
    const n = sel.length === 1 ? sel[0] : this.root();
    const body = h('div', { class: 'insp-body scroll' });
    if (sel.length > 1) {
      this.insp.append(h('div', { class: 'insp-head' }, ic('node'), `${sel.length} nodes`));
      body.append(h('div', { class: 'panel-b' }, h('div', { class: 'note' }, 'Drag any of them to move them all.'), h('div', { class: 'row' }, button('Duplicate', { small: true, icon: 'copy', onClick: () => this.nc.duplicate() }), button('Delete', { small: true, icon: 'trash', kind: 'danger', onClick: () => this.nc.deleteSel() }))));
      this.insp.append(body);
      return;
    }
    if (!n) {
      this.insp.append(h('div', { class: 'insp-head' }, ic('node'), this.ent.name));
      body.append(h('div', { class: 'panel-b note' }, 'This entity has no template node, so the game makes nothing of it. Start a new entity from a template instead.'));
      this.insp.append(body);
      return;
    }
    const d = NODES[n.type];
    if (!d) {
      this.insp.append(h('div', { class: 'insp-head' }, ic('warn'), 'Unknown node'));
      this.insp.append(body);
      return;
    }
    this.insp.append(h('div', { class: 'insp-head' }, h('span', { style: { width: '10px', height: '10px', borderRadius: '2px', background: d.color, display: 'inline-block' } }), d.root ? `${this.ent.name}` : d.title));
    if (d.help) body.append(h('div', { class: 'panel-b note', style: { paddingTop: '10px' } }, d.help));
    const fields = h('div');
    for (const p of d.props) {
      fields.append(field(p.label, this.propWidget(n, p, () => {}, true), { wide: p.t === 'multi' }));
    }
    for (const p of d.in) {
      if (p.t === 'flow') continue;
      const wire = this.ent.graph.links.find((l) => l.to[0] === n.id && l.to[1] === p.id);
      if (wire) {
        const src = this.ent.graph.nodes.find((q) => q.id === wire.from[0]);
        const unwire = button(null, { icon: 'close', small: true, kind: 'ghost', title: 'Unwire it', onClick: () => this.nc.removeLinks([wire]) });
        fields.append(field(p.label, h('div', { class: 'row' }, h('span', { class: 'note grow' }, `from ${src ? NODES[src.type]?.title : '?'}`), unwire)));
        continue;
      }
      const w = this.widget(n, p, () => {}, true);
      if (w) fields.append(field(p.label, w, { wide: p.long, tip: `${p.label} (${p.t})` }));
    }
    body.append(panel(d.root ? 'What it is' : 'Settings', fields, { key: 'g-fields' }));
    if (d.out.some((p) => p.t === 'flow')) {
      const list = h('div', { class: 'list' });
      for (const p of d.out.filter((q) => q.t === 'flow')) {
        const to = this.ent.graph.links.filter((l) => l.from[0] === n.id && l.from[1] === p.id).map((l) => this.ent.graph.nodes.find((q) => q.id === l.to[0])).filter(Boolean);
        const li = h('div', { class: 'li' }, ic(to.length ? 'check' : 'next', 10), h('span', { style: { flex: 1 } }, p.label), h('span', { class: 'note' }, to.length ? to.map((q) => NODES[q.type]?.title).join(', ') : 'nothing yet'));
        li.addEventListener('click', () => {
          if (to[0]) {
            this.nc.select([to[0].id]);
            return;
          }
          // (Nothing there: pick something to go there, wired.)
          const pe = this.nc.els.get(n.id)?.querySelector(`.nc-port[data-p="${p.id}"][data-dir="out"]`);
          const r = pe ? pe.getBoundingClientRect() : this.nc.el.getBoundingClientRect();
          const at = this.nc.toWorld(r.right + 60, r.top);
          this.nc.addMenu(r.right + 10, r.top, at, { from: { n, p, out: true, type: 'flow' } });
        });
        list.append(li);
      }
      body.append(panel(d.root ? 'When...' : 'Then', list, { key: 'g-when' }));
    }
    if (d.root) {
      const probs = lint(this.ent.graph);
      if (probs.length) {
        const pl = h('div', { class: 'problems' });
        for (const q of probs) {
          const el = h('div', { class: `problem ${q.level}` }, ic(q.level === 'error' ? 'warn' : 'info'), h('div', null, q.text));
          el.addEventListener('click', () => q.node && this.nc.select([q.node]));
          pl.append(el);
        }
        body.append(panel('Problems', pl, { key: 'g-probs' }));
      }
      const users = this.app.usersOf('entities', this.id);
      body.append(panel('Used by', users.length ? h('div', { class: 'note' }, users.join(', ')) : h('div', { class: 'note' }, 'Nothing else in the mod uses it yet.'), { key: 'g-users', open: false }));
      body.append(h('div', { class: 'panel-b' }, button('Try it out (Playtest)', { icon: 'play', kind: 'go', onClick: () => this.app.playtest() })));
    } else {
      body.append(h('div', { class: 'panel-b' }, h('div', { class: 'row' }, button('Duplicate', { small: true, icon: 'copy', onClick: () => this.nc.duplicate() }), button('Delete', { small: true, icon: 'trash', kind: 'danger', onClick: () => this.nc.deleteSel() }))));
    }
    this.insp.append(body);
  }

  helpCard(root) {
    const d = NODES[root.type];
    const steps = {
      'tpl.block': ['Give it a Texture (drag art onto it). For a cube, a Side picture too (or it\'s made from the texture).', 'Shape: cube, prop (a sprite standing on its square), plant, flat (a rug) or tall.', 'Right-click: a chest, a seat, or "graph" for On right-click.', 'Its item is made too: place it and break it in Playtest.'],
      'tpl.weapon': ['Give it an Icon. Set its damage, reach, swing time and Style (how it\'s swung).', 'Ranged: it shoots its Ammo (an item, or nothing).', 'On hit runs for each foe struck: add damage, conditions, effects.', 'Make it craftable with a Recipe entity.'],
      'tpl.boss': ['Give it a Look (art, 32×32 for a great one) and its health and damage.', 'Abilities are Ability nodes: wire Cast into attacks (Telegraphed blast, Shockwaves, Charge, Shoot, Summon, Blink...).', 'Phases: as it\'s worn down it goes to phase 2, 3, 4: abilities can start (From phase) in later phases, and On phase N runs.', 'Put it at the bottom of a dungeon (Builder: Dungeons, its boss).'],
      'tpl.npc': ['Dress them (colours, hair), or give them art of their own.', 'On talked to: wire into Say nodes. Each answer is an output: wire it on to another Say, or End talk.', 'Shops: Has item? and Take item, then Give item.', 'Place them in a structure with the Builder\'s person spawner.'],
      'tpl.hostile': ['Give it a Look (art; with a "walk" tag for walking frames).', 'When it wanders out: day, night, which biomes, how common.', 'Its plain attack: melee (with a Blow), arrows, or fire or frost orbs. Abilities add more.'],
      'tpl.event': ['When: the world\'s start, dawn, dusk, every so often, a custom event, someone near one of your structures, or something killed.', 'Wire Happens into what happens.'],
    }[root.type] || ['Fill in its fields; wire its outputs into what it does.'];
    import('./kit.js').then(({ dialog }) => dialog({ title: `${d.title}: how it works`, icon: 'info', body: [h('div', { class: 'note' }, d.help), h('div', { class: 'steps note' }, steps.map((s, i) => h('div', null, `${i + 1}. ${s}`)))], buttons: [{ label: 'OK', kind: 'primary' }] }));
  }

  onKey() {
    return false;
  }
}
void contextMenu;
