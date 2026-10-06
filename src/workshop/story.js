// The Story tool (round 62): stories of a mod's own, and changes to the
// game's. A story is a graph of beats (see mod/storynodes.js): how it
// begins and who's in it, news, tasks, words with people, waiting, chance
// and checks, things given and raised, events, endings. The game's own
// stories (each a "motif": see sim/saga) are shown as maps of their parts
// and the turns between them, read from the game itself; a change to one
// can turn it off, make it more or less common, send it another way at a
// turn now and then (to another part, to an ending, or into a story of
// yours), or do something of yours when it comes to a part. A story of
// yours can also follow on from one of the game's, by how it ended.
import { h, ic, clear, button, field, numberInput, slider, check, select, panel, toast, textInput, dialog } from './kit.js';
import { NodeCanvas, valueWidget } from './nodecanvas.js';
import { titleBar, refPicker, refInfo, biomeOptions } from './common.js';
import { BIOME_LIST } from '../mod/nodes.js';
import { NODES, CATS, TYPE_COLORS, fits, makeNode, shown } from '../mod/graph.js';
import { MOTIFS } from '../sim/saga/core.js';

const human = (id) => {
  const s = String(id || '').replace(/^m:[^:]+:/, '').replace(/_/g, ' ');
  return s ? s[0].toUpperCase() + s.slice(1) : s;
};
const L = (a, ap, b) => ({ id: `l${Math.random().toString(36).slice(2, 9)}`, from: [a.id, ap], to: [b.id, 'in'] });

// ------------------------------------------------------------ the game's stories, read
// The parts of one of the game's stories and the turns between them, read
// from its own code: { start, nodes: [{ id, tasks: [roles], to: [ids],
// maybe: [ids], ends: [outcomes] }], ends: [outcomes], any: { to, ends } }.
const mapCache = new Map();
function callArg(src, at, k) {
  // The k-th argument of the call whose '(' is at `at`.
  let depth = 0;
  let arg = 0;
  let start = at + 1;
  for (let i = at; i < Math.min(src.length, at + 600); i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) return arg === k ? src.slice(start, i) : null;
    } else if (c === ',' && depth === 1) {
      if (arg === k) return src.slice(start, i);
      arg++;
      start = i + 1;
    }
  }
  return null;
}
const quoted = (s) => [...String(s || '').matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
function srcOf(o, d = 0) {
  let s = '';
  if (!o) return s;
  for (const v of Object.values(o)) {
    if (typeof v === 'function') s += `\n${v.toString()}`;
    else if (v && typeof v === 'object' && !Array.isArray(v) && d < 2) s += srcOf(v, d + 1);
  }
  return s;
}
function turnsIn(src, names) {
  const to = new Set();
  const ends = new Set();
  const maybe = new Set();
  for (const m of src.matchAll(/\.go\(/g)) for (const q of quoted(callArg(src, m.index + 3, 1))) if (names.has(q)) to.add(q);
  for (const m of src.matchAll(/\.end\(/g)) for (const q of quoted(callArg(src, m.index + 4, 1))) ends.add(q);
  for (const m of src.matchAll(/\bto:\s*'([a-z0-9_]+)'/g)) if (names.has(m[1]) && !to.has(m[1])) maybe.add(m[1]);
  return { to: [...to], ends: [...ends], maybe: [...maybe] };
}
export function motifMap(mid) {
  if (mapCache.has(mid)) return mapCache.get(mid);
  const M = MOTIFS[mid];
  if (!M) return null;
  const names = new Set(Object.keys(M.nodes || {}));
  const nodes = [];
  const allEnds = new Set(['faded']);
  const roleAt = new Map();
  const SR = SRC.get(mid);
  for (const [id, n] of Object.entries(M.nodes || {})) {
    const src = SR && SR.nodes[id] ? withHelpers(SR.nodes[id], SR.helpers) : srcOf(n);
    for (const r of src.matchAll(/role:\s*'([a-z0-9_]+)'/g)) if (!roleAt.has(r[1])) roleAt.set(r[1], id);
    const t = turnsIn(src, names);
    if (n.final) t.ends.push(id);
    nodes.push({ id, ...t, tasks: [] });
  }
  // A task's handlers turn the story from the part that posted it.
  for (const [role, hs] of Object.entries(M.tasks || {})) {
    const at = roleAt.get(role);
    const t = turnsIn(SR && SR.tasks[role] ? withHelpers(SR.tasks[role], SR.helpers) : srcOf(hs), names);
    const n = nodes.find((q) => q.id === at);
    if (n) {
      n.tasks.push(role);
      for (const k of t.to) if (!n.to.includes(k)) n.to.push(k);
      for (const k of t.ends) if (!n.ends.includes(k)) n.ends.push(k);
    }
  }
  // What can turn it from anywhere (its own talk, what it hears).
  let anySrc = srcOf({ on: M.on, respond: M.respond, talk: M.talk, townTalk: M.townTalk, ended: M.ended, seeds: M.seeds });
  if (SR) {
    // (Its block without its parts and tasks: what's left turns it from anywhere.)
    let rest = SR.block;
    for (const t of [...Object.values(SR.nodes), ...Object.values(SR.tasks)]) rest = rest.replace(t, '');
    anySrc = withHelpers(rest, SR.helpers);
  }
  const any = turnsIn(anySrc, names);
  for (const n of nodes) for (const e of n.ends) allEnds.add(e);
  for (const e of any.ends) allEnds.add(e);
  const out = { id: mid, start: M.start || Object.keys(M.nodes || {})[0], nodes, ends: [...allEnds], any, family: M.family || mid };
  mapCache.set(mid, out);
  return out;
}

// The game's stories, by family: [[family, [ids]]].
function gameStories() {
  const fam = new Map();
  for (const [id, M] of Object.entries(MOTIFS)) {
    if (id.startsWith('m:') || !M.nodes) continue;
    const f = M.family || id;
    if (!fam.has(f)) fam.set(f, []);
    fam.get(f).push(id);
  }
  return [...fam].sort((a, b) => a[0].localeCompare(b[0]));
}

// What the game says of its stories (the notes over them in its source),
// and the shape of each as its source has it (helpers and all), read once,
// when it can be.
const ABOUT = new Map();
const SRC = new Map();
let aboutP = null;
const FILES = ['beasts', 'threats', 'captive', 'bandits', 'players', 'people', 'crime', 'realm', 'faith', 'world', 'academy', 'hearts', 'intrigue', 'festive', 'ventures', 'wonders', 'kin', 'troubles', 'roads'];
// The index of the bracket closing the one at `i` (strings, template
// strings and comments skipped).
function closer(src, i) {
  const open = src[i];
  const close = { '{': '}', '(': ')', '[': ']' }[open];
  let depth = 0;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '/' && src[k + 1] === '/') {
      k = src.indexOf('\n', k);
      if (k < 0) return -1;
      continue;
    }
    if (c === '/' && src[k + 1] === '*') {
      k = src.indexOf('*/', k + 2) + 1;
      if (k <= 0) return -1;
      continue;
    }
    if (c === '\'' || c === '"') {
      for (k++; k < src.length && src[k] !== c; k++) if (src[k] === '\\') k++;
      continue;
    }
    if (c === '`') {
      for (k++; k < src.length && src[k] !== '`'; k++) {
        if (src[k] === '\\') k++;
        else if (src[k] === '$' && src[k + 1] === '{') {
          k = closer(src, k + 1);
          if (k < 0) return -1;
        }
      }
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return k;
  }
  return -1;
}
// The keys of an object literal (at its top level) and their values' text.
function members(src, i) {
  const end = closer(src, i);
  const out = {};
  if (end < 0) return out;
  const re = /([a-z0-9_]+)\s*:\s*\{/gi;
  let k = i + 1;
  while (k < end) {
    re.lastIndex = k;
    const m = re.exec(src);
    if (!m || m.index >= end) break;
    const ob = m.index + m[0].length - 1;
    const ce = closer(src, ob);
    if (ce < 0) break;
    out[m[1]] = src.slice(ob, ce + 1);
    k = ce + 1;
  }
  return out;
}
function readFile(src) {
  const head = (src.match(/^(\/\/.*\n)+/) || [''])[0].replace(/^\/\/ ?/gm, '').trim();
  // Its helpers (functions at the top level), for what they turn.
  const helpers = {};
  for (const m of src.matchAll(/^(?:export )?function ([A-Za-z0-9_]+)\s*\(/gm)) {
    const ob = src.indexOf('{', m.index + m[0].length);
    const ce = ob >= 0 ? closer(src, ob) : -1;
    if (ce > 0) helpers[m[1]] = src.slice(ob, ce + 1);
  }
  for (const m of src.matchAll(/motif\(\{/g)) {
    const ob = m.index + 6;
    const ce = closer(src, ob);
    if (ce < 0) continue;
    const block = src.slice(ob, ce + 1);
    const idm = block.match(/id:\s*'([a-z0-9_]+)'/);
    if (!idm) continue;
    const nIdx = block.search(/\n\s*nodes:\s*\{/);
    const tIdx = block.search(/\n\s*tasks:\s*\{/);
    const nodes = nIdx >= 0 ? members(block, block.indexOf('{', nIdx)) : {};
    const tasks = tIdx >= 0 ? members(block, block.indexOf('{', tIdx)) : {};
    // (The comment just over it, else the file's own.)
    const lines = src.slice(Math.max(0, m.index - 900), m.index).split('\n');
    const own = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].trim();
      if (!l) {
        if (own.length) break;
        continue;
      }
      if (!l.startsWith('//')) break;
      own.unshift(l.replace(/^\/\/ ?/, '').replace(/^-+\s*/, ''));
    }
    ABOUT.set(idm[1], { own: own.join(' ').trim(), head });
    SRC.set(idm[1], { nodes, tasks, block, helpers });
  }
}
function loadAbout() {
  if (aboutP) return aboutP;
  aboutP = Promise.all(FILES.map((f) => window.fetch(new URL(`../sim/saga/motifs/${f}.js`, import.meta.url)).then((r) => (r.ok ? r.text() : '')).catch(() => ''))).then((texts) => {
    for (const src of texts) if (src) readFile(src);
    mapCache.clear();
  });
  return aboutP;
}
// A part's text with the helpers it calls (and theirs, once) added on.
function withHelpers(text, helpers) {
  let out = text;
  const seen = new Set();
  for (let pass = 0; pass < 2; pass++) for (const m of out.matchAll(/\b([A-Za-z0-9_]+)\(/g)) {
    if (seen.has(m[1]) || !helpers[m[1]]) continue;
    seen.add(m[1]);
    out += `\n${helpers[m[1]]}`;
  }
  return out;
}

// ------------------------------------------------------------ stories to start from
const STARTS = [
  { id: 'plea', name: 'A plea for help', icon: 'person', blurb: 'Someone in a town needs things brought: a task on the board, thanks and a reward.', make: (x) => {
    const s = x.n('st.start', 0, 0, { title: 'A favour for {giver}', chance: 10 });
    const nw = x.n('st.news', 360, 0, { text: '{giver} of {town} is asking for help.' });
    const t = x.n('st.task', 700, 0, { kind: 'bring things', title: 'Bring {giver} {count} {item}', item: 'bread', count: 4, coins: 15 });
    const e = x.n('st.end', 1060, -60, { outcome: 'helped', text: '{player} helped {giver}, and {town} won\'t forget it.' });
    const f = x.n('st.end', 1060, 160, { outcome: 'failed', text: 'Nobody came. {giver} made do.' });
    x.l(s, 'begin', nw);
    x.l(nw, 'next', t);
    x.l(t, 'done', e);
    x.l(t, 'failed', f);
  } },
  { id: 'beast', name: 'A beast at the door', icon: 'skull', blurb: 'Something prowls out by the town: slay it, and a structure of yours might be its lair.', make: (x) => {
    const s = x.n('st.start', 0, 0, { title: 'The beast of {town}', chance: 6 });
    const nw = x.n('st.news', 360, 0, { text: 'Something has been taking sheep out past {town}. {giver} has seen its tracks.' });
    const t = x.n('st.task', 700, 0, { kind: 'slay creatures', title: 'Slay the beast out past {town}', pitch: 'It comes at night. I\'ve seen the size of its prints. Please.', creature: 'wolf', count: 3, coins: 40, spot: 'out near the town' });
    const e = x.n('st.end', 1060, 0, { outcome: 'slain', text: 'The beast of {town} is dead, and the sheep sleep easy.' });
    x.l(s, 'begin', nw);
    x.l(nw, 'next', t);
    x.l(t, 'done', e);
  } },
  { id: 'letter', name: 'A letter to carry', icon: 'scroll', blurb: 'One person sends something to another: carry it there, and hear what they make of it.', make: (x) => {
    const s = x.n('st.start', 0, 0, { title: 'A letter for {other}', other: 'someone grown', chance: 8 });
    const t = x.n('st.task', 360, 0, { kind: 'carry something', title: 'Carry {giver}\'s letter to {other}', pitch: 'Would you take this to {other} for me? I can\'t face them myself.', item: 'paper', count: 1, to: 'other', coins: 10 });
    const k = x.n('st.talk', 720, 0, { who: 'other', ask: 'About the letter...', text: 'From {giver}? After all this time... Tell them I\'ll come.', a: 'I\'ll tell them.', b: '' });
    const e = x.n('st.end', 1080, 0, { outcome: 'mended', text: '{giver} and {other} are speaking again.' });
    x.l(s, 'begin', t);
    x.l(t, 'done', k);
    x.l(k, 'a', e);
    x.l(k, 'next', e);
  } },
  { id: 'quarrel', name: 'A quarrel', icon: 'bolt', blurb: 'Two people at odds, and a word with each: side with one, or calm them both. Values kept, an If.', make: (x) => {
    const s = x.n('st.start', 0, 0, { title: 'The quarrel of {giver} and {other}', other: 'someone grown', chance: 8 });
    const a = x.n('st.talk', 360, -80, { who: 'giver', ask: 'You look angry.', text: '{other} moved the fence onto my land! Will you stand with me?', a: 'I\'m with you.', b: 'Let\'s hear their side.' });
    const st = x.n('st.set', 720, -200, { name: 'side', op: 'set', value: 1 });
    const b = x.n('st.talk', 720, 80, { who: 'other', ask: 'About the fence...', text: 'That fence was always mine. Ask anyone.', a: 'Then show me the deed.', b: 'Split the difference?' });
    const e1 = x.n('st.end', 1080, -200, { outcome: 'sided', text: '{player} took {giver}\'s side. {other} won\'t forget it.' });
    const e2 = x.n('st.end', 1080, 160, { outcome: 'settled', text: 'The fence was moved half way, and both of them grumbled, and that was that.' });
    x.l(s, 'begin', a);
    x.l(a, 'a', st);
    x.l(st, 'next', e1);
    x.l(a, 'b', b);
    x.l(b, 'a', e2);
    x.l(b, 'b', e2);
  } },
  { id: 'follow', name: 'After one of the game\'s stories', icon: 'link', blurb: 'Picks up when one of the game\'s own stories ends (as you choose), with its people.', make: (x) => {
    const s = x.n('st.start', 0, 0, { title: 'What came after', when: 'after a game story ends', after: 'festival', outcome: '', chance: 100 });
    const nw = x.n('st.news', 360, 0, { text: 'In {town}, they\'re still talking about it.' });
    const e = x.n('st.end', 720, 0, { outcome: 'over', text: 'And then it was quiet again.' });
    x.l(s, 'begin', nw);
    x.l(nw, 'next', e);
  } },
  { id: 'blank', name: 'Just a beginning', icon: 'plus', blurb: 'The start and an end: wire your own between.', make: (x) => {
    const s = x.n('st.start', 0, 0, {});
    const e = x.n('st.end', 600, 0, {});
    x.l(s, 'begin', e);
  } },
];

export function storyGraph(kind) {
  const S = STARTS.find((q) => q.id === kind) || STARTS[STARTS.length - 1];
  const g = { nodes: [], links: [], notes: [] };
  S.make({
    n: (type, x, y, p) => {
      const n = makeNode(type, 80 + x, 120 + y, { p });
      g.nodes.push(n);
      return n;
    },
    l: (a, ap, b) => g.links.push(L(a, ap, b)),
  });
  return g;
}

export default class StoryTool {
  constructor(app) {
    this.app = app;
    this.kind = null;
    this.id = null;
    this.sel = null;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    if (this.kind && this.id && this.app.mod[this.kind] && this.app.mod[this.kind][this.id]) this.open(this.kind, this.id);
    else this.empty();
  }

  unmount() {
    this.nc?.destroy();
    this.nc = null;
  }

  current() {
    return this.kind && this.id && this.app.mod[this.kind] && this.app.mod[this.kind][this.id] ? { kind: this.kind, id: this.id } : null;
  }

  hintText() {
    if (this.kind === 'stories') return 'Wire each beat to the next. Drop a wire on empty space to pick what comes next. Click a beat to set it up on the right.';
    if (this.kind === 'patches') return 'Click a part of the story, or a turn between parts, to change what happens there.';
    return 'Make a story of your own, or change one of the game\'s.';
  }

  keyHelp() {
    return this.kind === 'stories' ? [['Space / A', 'Add a beat where the pointer is'], ['Drag a socket', 'Wire it on'], ['Delete', 'Delete what\'s chosen'], ['F', 'See everything']] : [];
  }

  onKey() {
    return false;
  }

  open(kind, id) {
    this.nc?.destroy();
    this.nc = null;
    if (!kind || !id || !this.app.mod[kind] || !this.app.mod[kind][id]) {
      this.kind = null;
      this.id = null;
      return this.empty();
    }
    const fresh = this.kind !== kind || this.id !== id;
    this.kind = kind;
    this.id = id;
    if (fresh) this.sel = null;
    if (kind === 'stories') this.openStory(fresh);
    else this.openPatch();
    this.app.hint(this.hintText());
  }

  reload(kind, id) {
    if (kind === this.kind && id === this.id) this.open(kind, id);
  }

  removed(kind, id) {
    if (kind === this.kind && id === this.id) this.open(null, null);
  }

  renamed() {
    if (this.kind === 'stories' && this.id) this.drawInspector();
  }

  // ------------------------------------------------------------ nothing open
  empty() {
    clear(this.stage);
    clear(this.insp);
    const card = (icon, t, d, fn) => {
      const c = h('div', { class: 'card' }, h('div', { class: 't' }, ic(icon), t), h('div', { class: 'd' }, d));
      c.addEventListener('click', fn);
      return c;
    };
    const cards = h('div', { class: 'cards' });
    for (const S of STARTS) cards.append(card(S.icon, S.name, S.blurb, () => this.newStory(S.id)));
    this.stage.append(h('div', { class: 'home scroll', style: { overflow: 'auto' } },
      h('h1', null, 'Stories'),
      h('div', { class: 'sub' }, 'Stories of your own, told as the game tells its own: begun in a town now and then, their tasks on the notice boards, their people with something to say, their place in the journal. Or change the game\'s own stories.'),
      h('h2', null, 'A new story'), cards,
      h('h2', null, 'Change one of the game\'s stories'),
      h('div', { class: 'row' }, button('Choose a story to change...', { icon: 'book', kind: 'primary', onClick: () => this.pickPatch() }))));
    this.insp.append(h('div', { class: 'insp-head' }, ic('scroll'), 'Story'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open.')));
  }

  async newStory(kind) {
    const S = STARTS.find((q) => q.id === kind);
    const id = await this.app.create('stories', { name: S && S.id !== 'blank' ? S.name : 'Story', graph: storyGraph(kind) });
    setTimeout(() => this.nc?.frameAll(), 80);
    return id;
  }

  // One of the game's stories to change (a dialog, searchable).
  async pickPatch() {
    loadAbout();
    let chosen = null;
    const q = textInput({ placeholder: 'Find a story...' });
    const list = h('div', { class: 'scroll', style: { maxHeight: '420px', overflow: 'auto' } });
    const draw = () => {
      clear(list);
      const f = q.value.toLowerCase();
      for (const [fam, ids] of gameStories()) {
        const hits = ids.filter((id) => !f || id.includes(f) || fam.includes(f) || (ABOUT.get(id)?.own || '').toLowerCase().includes(f));
        if (!hits.length) continue;
        list.append(h('div', { class: 'mh', style: { padding: '8px 4px 2px', color: 'var(--gold2)' } }, human(fam)));
        for (const id of hits) {
          const a = ABOUT.get(id);
          const li = h('div', { class: `li${chosen === id ? ' on' : ''}`, style: { flexDirection: 'column', alignItems: 'flex-start' } }, h('b', null, human(id)), a && a.own && a.own.length > 24 ? h('span', { class: 'note' }, a.own.slice(0, 160)) : null);
          li.addEventListener('click', () => {
            chosen = id;
            draw();
          });
          list.append(li);
        }
      }
    };
    q.addEventListener('input', draw);
    loadAbout().then(draw);
    draw();
    const v = await dialog({ title: 'Change one of the game\'s stories', icon: 'book', wide: true, body: [q, h('div', { class: 'list', style: { marginTop: '8px' } }, list)], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Change it', kind: 'primary', value: 'ok' }] });
    if (v !== 'ok' || !chosen) return;
    const ex = Object.values(this.app.mod.patches || {}).find((p) => p.motif === chosen);
    if (ex) return this.app.open('patches', ex.id);
    this.app.create('patches', { name: `${human(chosen)} (changed)`, motif: chosen, off: false, often: 1, turns: [], arrive: [] });
  }

  // ------------------------------------------------------------ a story of the mod's
  get story() {
    return this.app.mod.stories[this.id];
  }

  openStory(fresh) {
    const app = this.app;
    const st = this.story;
    st.graph ||= { nodes: [], links: [], notes: [] };
    st.graph.notes ||= [];
    // (Round 64) An If made before "famous" had its own At least: the
    // number it had, there.
    for (const n of st.graph.nodes) if (n.type === 'st.check' && n.p && n.p.least === undefined && n.p.what === 'a player in it is famous') n.p.least = n.p.count ?? 1;
    clear(this.stage);
    this.zoomEl = h('span', { class: 'note', style: { minWidth: '40px' } }, '100%');
    const bar = titleBar(app, 'stories', this.id,
      button('Beat', { icon: 'plus', small: true, title: 'Add a beat (Space)', onClick: () => {
        const r = this.nc.el.getBoundingClientRect();
        this.nc.addMenu(r.left + r.width / 2 - 150, r.top + 60, this.nc.toWorld(r.left + r.width / 2, r.top + r.height / 2));
      } }),
      button('Note', { icon: 'pencil', small: true, onClick: () => {
        const r = this.nc.el.getBoundingClientRect();
        const at = this.nc.toWorld(r.left + 60, r.top + 60);
        this.nc.addNote(at.x, at.y);
      } }),
      button(null, { icon: 'zoom', small: true, title: 'See everything (F)', onClick: () => this.nc.frameAll() }),
      this.zoomEl,
      h('span', { class: 'spacer' }),
      button('Try it', { icon: 'play', small: true, kind: 'go', title: 'Playtest: it begins at once, in the town nearest you', onClick: () => app.playtest() }));
    const wrap = h('div', { class: 'canvas-wrap' });
    this.stage.append(bar, wrap);
    const hasStart = () => this.story.graph.nodes.some((n) => n.type === 'st.start');
    // (Round 68) A story's own beats first, then everything the entity
    // graphs have (actions, flow, values, maths...): run in the story, with
    // its people and places.
    const cats = [...CATS.filter((c) => String(c).startsWith('Story')), ...CATS.filter((c) => !String(c).startsWith('Story'))];
    this.nc = new NodeCanvas({
      defs: NODES, fits, colors: TYPE_COLORS, cats,
      graph: () => this.story.graph,
      makeNode: (type, x, y) => makeNode(type, x, y),
      canAdd: (d) => (d.story ? !d.storyRoot || !hasStart() : !d.root && !d.starts),
      checkpoint: () => app.checkpoint('stories', this.id),
      onChange: () => {
        app.touch('stories', this.id);
        window.clearTimeout(this.inspT);
        this.inspT = setTimeout(() => this.drawInspector(), 120);
      },
      onSelect: () => this.drawInspector(),
      onView: (z) => this.zoomEl && (this.zoomEl.textContent = `${Math.round(z * 100)}%`),
      widget: (n, p, done) => this.widget(n, p, done, false),
      propWidget: (n, p, done) => this.propWidget(n, p, done),
      nodeExtra: () => {},
      nodeMenu: (n) => (NODES[n.type]?.help ? [{ label: 'What does it do?', icon: 'info', onClick: () => toast(NODES[n.type].help, '', 7000) }] : []),
      onDrop: (p, at) => this.dropped(p, at),
    });
    wrap.append(this.nc.el);
    this.nc.render();
    if (fresh) requestAnimationFrame(() => requestAnimationFrame(() => this.nc && this.nc.frameAll()));
    this.drawInspector();
  }

  setP(n, k, v) {
    this.app.checkpoint('stories', this.id);
    (n.p ||= {})[k] = v;
    this.app.touch('stories', this.id);
  }

  // (Round 68) An input's own field (the entity graph's nodes, and the
  // story's own that take a wire): as the Graph tool has them.
  widget(n, p, done, big) {
    const v = n.v ? n.v[p.id] : undefined;
    const set = (nv) => {
      this.app.checkpoint('stories', this.id);
      (n.v ||= {})[p.id] = nv;
      this.app.touch('stories', this.id);
      done();
      if (big) {
        this.nc?.refreshNode(n);
        if (NODES[n.type].dyn) this.drawInspector();
      } else if (this.nc && this.nc.sel.has(n.id)) this.drawInspector();
    };
    if (refInfo(p.t).coll || ['item', 'block', 'creature', 'effect'].includes(p.t)) return refPicker(this.app, p.t, v ?? null, set);
    return valueWidget(p.t, v ?? p.def, set, { min: p.min, max: p.max, step: p.step, long: p.long, big, opts: p.opts === BIOME_LIST ? biomeOptions(this.app) : p.opts });
  }

  propWidget(n, p, done, big = false) {
    const v = n.p && n.p[p.id] !== undefined ? n.p[p.id] : p.def;
    const set = (nv) => {
      this.setP(n, p.id, nv);
      done();
      if (big) this.nc?.refreshNode(n);
      // (What else it has follows the setting: the inspector too.)
      if (big && NODES[n.type].dyn) this.drawInspector();
    };
    // (After which of the game's stories, and which of its endings.)
    if (n.type === 'st.start' && p.id === 'after') {
      const opts = gameStories().flatMap(([, ids]) => ids).sort().map((id) => [id, human(id)]);
      return select([['', '(choose)'], ...opts], v || '', (nv) => {
        set(nv);
        this.drawInspector();
      });
    }
    if (n.type === 'st.start' && p.id === 'outcome') {
      const mp = n.p && n.p.after ? motifMap(n.p.after) : null;
      if (mp) return select([['', 'any ending'], ...mp.ends.map((e) => [e, human(e)])], v || '', set);
    }
    if (['item', 'creature', 'structure', 'story', 'asset', 'vfx', 'loot', 'song', 'clip', 'block', 'effect'].includes(p.t) || (p.t !== 'text' && refInfo(p.t).coll)) return refPicker(this.app, p.t, v ?? null, (nv) => {
      set(nv);
      this.nc?.refreshNode(n);
    }, { create: p.t === 'structure' ? () => this.app.builder((b) => b.newDialog({ open: false })) : p.t === 'story' ? () => this.newStory('blank') : null });
    if (p.t === 'enum') return select(p.opts.map((x) => (Array.isArray(x) ? x : [x, x])), v, set);
    if (p.t === 'bool') return check('', !!v, set);
    if (p.t === 'number') return numberInput({ value: v ?? 0, min: p.min, max: p.max, step: p.step, onChange: set, vars: true });
    if (p.t === 'color' || p.t === 'multi' || p.t === 'sound') return valueWidget(p.t, v, set, { opts: p.opts === BIOME_LIST ? biomeOptions(this.app) : p.opts, min: p.min, max: p.max });
    return textInput({ value: v ?? '', long: !!(p.long && big), onChange: set });
  }

  dropped(p, at) {
    const map = { structures: ['st.place', 'structure'], stories: ['st.story', 'story'] };
    let m = map[p.kind];
    let val = p.id;
    if (p.kind === 'entities') {
      if (['tpl.animal', 'tpl.hostile', 'tpl.boss', 'tpl.npc'].includes(p.tpl)) m = ['st.task', 'creature'];
      else m = ['st.give', 'item'];
      val = `@${p.id}`;
    }
    if (!m) return toast('That can\'t be used in a story.', 'bad');
    this.nc.addNode(m[0], at.x, at.y);
    const n = this.story.graph.nodes[this.story.graph.nodes.length - 1];
    (n.p ||= {})[m[1]] = val;
    if (m[0] === 'st.task' && m[1] === 'creature') n.p.kind = 'slay creatures';
    this.nc.refreshNode(n);
    this.app.touch('stories', this.id);
  }

  problems() {
    const g = this.story.graph;
    const out = [];
    const start = g.nodes.find((n) => n.type === 'st.start');
    if (!start) return [{ level: 'error', text: 'It has no beginning (add "The story begins").' }];
    // What can be reached from the start.
    const seen = new Set();
    const go = (id) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const l of g.links) if (l.from[0] === id) go(l.to[0]);
    };
    go(start.id);
    // (Round 68: a node of values only is led to by its wires out, not in.)
    const flowIn = (n) => !NODES[n.type] || NODES[n.type].in.some((p) => p.t === 'flow');
    for (const n of g.nodes) if (!seen.has(n.id) && flowIn(n)) out.push({ level: 'warn', node: n.id, text: `${NODES[n.type]?.title || n.type}: nothing leads to it.` });
    for (const n of g.nodes) if (!NODES[n.type]) out.push({ level: 'error', node: n.id, text: `Unknown node "${n.type}" (from a newer game?): it does nothing.` });
    // (Round 68) The newer beats' own needs.
    const sv0 = start.p || {};
    for (const n of g.nodes) {
      const v = n.p || {};
      const nobody = (r) => (r === 'giver' || r === 'other') && (r === 'other' ? sv0.other : sv0.giver) === 'nobody';
      const cast = new Set(g.nodes.filter((q) => (q.type === 'st.cast' || q.type === 'st.newcomer') && q.p).map((q) => q.p.role || 'third'));
      if (['st.walk', 'st.escort', 'st.turn', 'st.fate', 'st.person', 'st.ask'].includes(n.type)) {
        const r = v.who || (n.type === 'st.escort' || n.type === 'st.fate' ? 'other' : 'giver');
        if (nobody(r)) out.push({ level: 'error', node: n.id, text: `${NODES[n.type].title}: but the story has nobody as its ${r}.` });
        if ((r === 'third' || r === 'fourth') && !cast.has(r)) out.push({ level: 'warn', node: n.id, text: `${NODES[n.type].title}: the ${r}, but nothing brings a ${r} into it (Someone else comes into it).` });
      }
      if (n.type === 'st.jump' && !g.nodes.some((q) => q.type === 'st.mark' && String((q.p || {}).name || '').trim().toLowerCase() === String(v.name || '').trim().toLowerCase())) out.push({ level: 'error', node: n.id, text: `Go to a mark: there's no mark called "${v.name}".` });
      if (n.type === 'st.endstory' && !v.story) out.push({ level: 'error', node: n.id, text: 'End another story: choose which.' });
      if (n.type === 'st.shipdo' && !g.nodes.some((q) => q.type === 'st.ship')) out.push({ level: 'warn', node: n.id, text: 'The story\'s ship: but nothing in it brings a ship (A ship comes).' });
      if (n.type === 'st.meanwhile' && !g.links.some((l) => l.from[0] === n.id && l.from[1] === 'aside')) out.push({ level: 'warn', node: n.id, text: 'Meanwhile: nothing wired to Meanwhile.' });
    }
    if (!g.nodes.some((n) => n.type === 'st.end' && seen.has(n.id))) out.push({ level: 'warn', text: 'It never comes to "The end" (it\'ll end where it runs out).' });
    const sv = start.p || {};
    for (const n of g.nodes) {
      const v = n.p || {};
      if (n.type === 'st.talk' && (v.who === 'other' ? sv.other : sv.giver) === 'nobody') out.push({ level: 'error', node: n.id, text: `A word with the ${v.who}: but the story has nobody as its ${v.who}.` });
      if (n.type === 'st.task' && (v.kind === 'carry something' || v.kind === 'talk to someone') && sv.other === 'nobody' && (v.to || 'other') === 'other') out.push({ level: 'error', node: n.id, text: 'A task to someone else: but the story has nobody else in it.' });
      if (n.type === 'st.task' && sv.giver === 'nobody') out.push({ level: 'warn', node: n.id, text: 'A task with nobody asking: it goes on the board only.' });
      // (Round 64) The newer nodes, and the If's newer questions.
      const role = (r) => (r === 'other' ? sv.other : sv.giver) === 'nobody';
      if ((n.type === 'st.say' && role(v.who)) || (n.type === 'st.rep' && v.by && v.by !== 'the town' && role(v.by === 'the other' ? 'other' : 'giver'))) out.push({ level: 'error', node: n.id, text: `The ${n.type === 'st.say' ? v.who || 'giver' : v.by.slice(4)}: but the story has nobody as that.` });
      if (n.type === 'st.spawn' && !v.creature) out.push({ level: 'error', node: n.id, text: 'Creatures come: choose which.' });
      if (n.type === 'st.until' && v.what === 'a kill' && !v.creature) out.push({ level: 'error', node: n.id, text: 'Wait for a kill: of which creature?' });
      if (n.type === 'st.check') {
        const w = v.what || 'a player in it has';
        if (w === 'another story of yours is going' && !v.story) out.push({ level: 'error', node: n.id, text: 'If another story is going: choose which.' });
        if ((w === 'the giver thinks well of a player in it' || w === 'the giver is alive') && role('giver')) out.push({ level: 'warn', node: n.id, text: 'An If about the giver: but the story has nobody asking (always No).' });
        if (w === 'the other is alive' && role('other')) out.push({ level: 'warn', node: n.id, text: 'An If about the other: but the story has nobody else in it (always No).' });
        if ((w === 'a player in it came as' && v.origin === 'mod' && !v.originId) || (w === 'a player in it has the trait' && v.trait === 'mod' && !v.traitId)) out.push({ level: 'error', node: n.id, text: 'Type the id of yours (as the Character tool has it).' });
      }
    }
    // Values in its words that nothing in it sets (the story's own: those
    // of your graphs, {world:...} and {player:...}, are theirs to set).
    const own = new Set(['town', 'giver', 'other', 'third', 'fourth', 'player', 'item', 'count', 'creature', 'self', 'target', 'value']);
    for (const n of g.nodes) if (['st.set', 'st.calc', 'st.learn'].includes(n.type) && n.p && n.p.name) own.add(String(n.p.name).replace(/[^\w-]/g, ''));
    // (Set variable, kept for this flow: the story's own value.)
    for (const n of g.nodes) if (n.type === 'act.setvar' || n.type === 'act.addvar') own.add(String((n.v || {}).name || 'count').replace(/[^\w-]/g, ''));
    const missing = new Set();
    for (const n of g.nodes) for (const [k, t] of Object.entries(n.p || {})) {
      const pd = NODES[n.type]?.propMap[k];
      if (typeof t !== 'string' || k === 'after' || !pd || !shown(n, pd)) continue;
      for (const m of t.matchAll(/\{([\w-]+)\}/g)) if (!own.has(m[1])) missing.add(m[1]);
    }
    for (const k of missing) out.push({ level: 'warn', text: `{${k}} is in its words, but nothing in it sets it (Set a value). Your graphs' values are {world:${k}} or {player:${k}}.` });
    if (sv.when === 'after a game story ends' && !sv.after) out.push({ level: 'error', node: start.id, text: 'Choose which of the game\'s stories it follows.' });
    return out;
  }

  drawInspector() {
    clear(this.insp);
    if (this.kind !== 'stories' || !this.story) return;
    const g = this.story.graph;
    const sel = this.nc ? [...this.nc.sel].map((id) => g.nodes.find((n) => n.id === id)).filter(Boolean) : [];
    const n = sel.length === 1 ? sel[0] : g.nodes.find((q) => q.type === 'st.start');
    const body = h('div', { class: 'insp-body scroll' });
    if (n) {
      const d = NODES[n.type];
      this.insp.append(h('div', { class: 'insp-head' }, h('span', { style: { width: '10px', height: '10px', borderRadius: '2px', background: d.color, display: 'inline-block' } }), d.title));
      if (d.help) body.append(h('div', { class: 'panel-b note', style: { paddingTop: '10px' } }, d.help));
      const fields = h('div');
      const sv = n.p || {};
      for (const p of d.props) {
        // (Only what matters for how it's set: see storynodes' `show`.)
        if (!shown(n, p)) continue;
        fields.append(field(p.label, this.propWidget(n, p, () => this.nc?.refreshNode(n), true), { wide: p.long || p.t === 'multi' }));
      }
      // (Round 68) Its inputs: typed, or wired from another node.
      for (const p of d.in) {
        if (p.t === 'flow') continue;
        const wire = g.links.find((l) => l.to[0] === n.id && l.to[1] === p.id);
        if (!wire && !shown(n, p)) continue;
        if (wire) {
          const src = g.nodes.find((q) => q.id === wire.from[0]);
          const unwire = button(null, { icon: 'close', small: true, kind: 'ghost', title: 'Unwire it', onClick: () => this.nc.removeLinks([wire]) });
          fields.append(field(p.label, h('div', { class: 'row' }, h('span', { class: 'note grow' }, `from ${src ? NODES[src.type]?.title : '?'}`), unwire)));
          continue;
        }
        const wd = this.widget(n, p, () => {}, true);
        if (wd) fields.append(field(p.label, wd, { wide: p.long, tip: `${p.label} (${p.t})` }));
      }
      body.append(panel('Settings', fields, { key: 'st-fields' }));
      if (!d.story) body.append(h('div', { class: 'panel-b note' }, 'One of the entity graph\'s nodes, in a story: Self is the giver, Target the other, Player a player in it, Here the town (or wire in Who\'s in it). Values set "local" are the story\'s own ({name}). The story goes on at the first of its beats the flow comes to.'));
      if (d.props.some((p) => p.t === 'text')) body.append(h('div', { class: 'panel-b note' }, 'In any words: {town}, {giver}, {other}, {player}, {item}, {count}, {creature}, values the story has set ({name}), and your graphs\' values: {world:name}, {player:name} (a player\'s, and their character screen\'s choices).'));
      if (n.type === 'st.start' && sv.when === 'after a game story ends' && sv.after) {
        loadAbout().then(() => {
          const a = ABOUT.get(sv.after);
          if (a && a.own && this.aboutEl) this.aboutEl.textContent = a.own;
        });
        this.aboutEl = h('div', { class: 'note' });
        body.append(panel(`About "${human(sv.after)}"`, this.aboutEl, { key: 'st-about' }));
      }
    }
    const probs = this.problems();
    const pl = h('div', { class: 'problems' });
    for (const q of probs) {
      const el = h('div', { class: `problem ${q.level}` }, ic(q.level === 'error' ? 'warn' : 'info'), h('div', null, q.text));
      el.addEventListener('click', () => q.node && this.nc.select([q.node]));
      pl.append(el);
    }
    if (!probs.length) pl.append(h('div', { class: 'note' }, ic('check'), ' Ready to tell.'));
    body.append(panel('To look at', pl, { key: 'st-probs' }));
    body.append(h('div', { class: 'panel-b' }, button('Try it (Playtest)', { icon: 'play', kind: 'go', onClick: () => this.app.playtest() }), h('div', { class: 'note', style: { marginTop: '6px' } }, 'In a playtest it begins at once, in the town nearest you; the console\'s "mod story" starts it again.')));
    if (!this.insp.firstChild) this.insp.append(h('div', { class: 'insp-head' }, ic('scroll'), this.story.name));
    this.insp.append(body);
  }

  // ------------------------------------------------------------ a change to one of the game's
  get patch() {
    return this.app.mod.patches[this.id];
  }

  setPatch(fn, redraw = true) {
    this.app.checkpoint('patches', this.id);
    fn(this.patch);
    this.app.touch('patches', this.id);
    if (redraw) this.openPatch();
  }

  openPatch() {
    const app = this.app;
    const P = this.patch;
    P.turns ||= [];
    P.arrive ||= [];
    clear(this.stage);
    clear(this.insp);
    if (!SRC.size && !this.waitingSrc) {
      this.waitingSrc = true;
      loadAbout().then(() => this.kind === 'patches' && this.patch && this.openPatch());
    }
    const mp = motifMap(P.motif);
    const bar = titleBar(app, 'patches', this.id, h('span', { class: 'chip on' }, human(P.motif)), h('span', { class: 'spacer' }), button('Another story...', { small: true, icon: 'book', onClick: () => this.pickPatch() }));
    const body = h('div', { class: 'scroll', style: { flex: 1, overflow: 'auto', padding: '16px 20px' } });
    this.stage.append(bar, body);
    if (!mp) {
      body.append(h('div', { class: 'note' }, `The game has no story called "${P.motif}" (from an older or newer game?).`));
      return;
    }
    // About it.
    const about = h('div', { class: 'note', style: { maxWidth: '900px', marginBottom: '12px' } });
    loadAbout().then(() => {
      const a = ABOUT.get(P.motif);
      about.textContent = a ? a.own || a.head : '';
    });
    body.append(h('h2', { style: { margin: '0 0 6px' } }, human(P.motif), h('span', { class: 'note', style: { marginLeft: '10px' } }, `one of the game's ${human(mp.family).toLowerCase()} stories`)), about);
    // The map: its parts in columns by how far from the start, the turns
    // between them, its endings on the right.
    body.append(this.mapEl(mp, P));
    // The inspector.
    this.insp.append(h('div', { class: 'insp-head' }, ic('book'), P.name));
    const ib = h('div', { class: 'insp-body scroll' });
    const gen = h('div');
    gen.append(check('Turned off: it never starts', !!P.off, (v) => this.setPatch((x) => (x.off = v))));
    if (!P.off) gen.append(field('How common', slider({ value: P.often ?? 1, min: 0.25, max: 4, step: 0.25, onChange: (v) => this.setPatch((x) => (x.often = v), false) }), { tip: '1: as the game has it. 2: twice as often (and twice as many at once).' }));
    gen.append(h('div', { class: 'row', style: { marginTop: '8px', flexWrap: 'wrap', gap: '4px' } }, button('A story of mine to follow it...', { small: true, icon: 'link', onClick: (e) => this.followMenu(e, mp) })));
    ib.append(panel('This story', gen, { key: 'pt-gen' }));
    const selBody = h('div');
    this.drawSel(selBody, mp);
    ib.append(panel(this.sel ? (this.sel.edge ? 'A turn' : 'A part') : 'Changes', selBody, { key: 'pt-sel' }));
    // Every change, listed.
    const all = h('div', { class: 'list' });
    for (const t of P.turns) {
      const li = h('div', { class: 'li' }, ic('next', 10), h('span', { style: { flex: 1 } }, `${human(t.from || 'anywhere')} → ${human(t.to)}: ${t.chance ?? 50}% ${this.insteadLabel(t.instead)}`));
      li.addEventListener('click', () => {
        this.sel = { edge: true, from: t.from, to: t.to };
        this.openPatch();
      });
      all.append(li);
    }
    for (const a of P.arrive) {
      const li = h('div', { class: 'li' }, ic('star', 10), h('span', { style: { flex: 1 } }, `At ${human(a.node)}: ${[a.message && 'words', a.event && `event "${a.event}"`, a.story && 'a story of yours'].filter(Boolean).join(', ') || 'nothing yet'}`));
      li.addEventListener('click', () => {
        this.sel = { node: a.node };
        this.openPatch();
      });
      all.append(li);
    }
    if (!P.turns.length && !P.arrive.length) all.append(h('div', { class: 'note' }, 'No changes to its turns yet: click a turn (an arrow) or a part on the map.'));
    ib.append(panel('All its changes', all, { key: 'pt-all' }));
    this.insp.append(ib);
  }

  insteadLabel(ins) {
    const s = String(ins || '');
    if (!s) return 'instead: (choose)';
    if (s.startsWith('=')) return `ends as "${human(s.slice(1))}"`;
    if (s.startsWith('@')) return `goes into "${this.app.mod.stories[s.slice(1)]?.name || '(deleted)'}"`;
    return `goes to ${human(s)}`;
  }

  followMenu(e, mp) {
    const r = e.currentTarget.getBoundingClientRect();
    import('./kit.js').then(({ menu }) => menu([{ head: 'When it ends as...' }, { label: 'Any ending', onClick: () => this.follow(mp, '') }, ...mp.ends.map((o) => ({ label: human(o), onClick: () => this.follow(mp, o) }))], r.left, r.bottom + 4));
  }

  async follow(mp, outcome) {
    const g = storyGraph('follow');
    const s = g.nodes.find((n) => n.type === 'st.start');
    s.p.after = mp.id;
    s.p.outcome = outcome;
    s.p.title = `After ${human(mp.id).toLowerCase()}`;
    await this.app.create('stories', { name: `After ${human(mp.id).toLowerCase()}${outcome ? ` (${human(outcome).toLowerCase()})` : ''}`, graph: g });
  }

  mapEl(mp, P) {
    // Columns by distance from the start.
    const depth = new Map([[mp.start, 0]]);
    const q = [mp.start];
    const byId = new Map(mp.nodes.map((n) => [n.id, n]));
    while (q.length) {
      const id = q.shift();
      const n = byId.get(id);
      for (const t of [...(n?.to || []), ...(n?.maybe || [])]) if (!depth.has(t)) {
        depth.set(t, depth.get(id) + 1);
        q.push(t);
      }
    }
    let maxD = 0;
    for (const n of mp.nodes) {
      if (!depth.has(n.id)) depth.set(n.id, 1);
      maxD = Math.max(maxD, depth.get(n.id));
    }
    const cols = [];
    for (const n of mp.nodes) (cols[depth.get(n.id)] ||= []).push(n);
    const W = 170;
    const H = 46;
    const GX = 70;
    const GY = 22;
    const pos = new Map();
    cols.forEach((col, ci) => (col || []).forEach((n, ri) => pos.set(n.id, { x: 20 + ci * (W + GX), y: 20 + ri * (H + GY) })));
    const endsX = 20 + (maxD + 1) * (W + GX);
    mp.ends.forEach((e, i) => pos.set(`=${e}`, { x: endsX, y: 20 + i * (H + GY) }));
    const totalW = endsX + W + 40;
    const totalH = Math.max(...[...pos.values()].map((p) => p.y)) + H + 40;
    const wrap = h('div', { class: 'pt-map', style: { width: `${totalW}px`, height: `${totalH}px` } });
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', totalW);
    svg.setAttribute('height', totalH);
    svg.innerHTML = '<defs><marker id="ptarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#9a8a70"/></marker><marker id="ptarr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ffe070"/></marker></defs>';
    wrap.append(svg);
    const edge = (a, b, kind) => {
      const A = pos.get(a);
      const B = pos.get(b);
      if (!A || !B) return;
      const x1 = A.x + W;
      const y1 = A.y + H / 2;
      const x2 = B.x;
      const y2 = B.y + H / 2;
      const back = x2 <= x1;
      const d = back ? `M${A.x + W / 2},${A.y + H} C${A.x + W / 2},${A.y + H + 60} ${B.x + W / 2},${B.y + H + 60} ${B.x + W / 2},${B.y + H}` : `M${x1},${y1} C${x1 + 50},${y1} ${x2 - 50},${y2} ${x2},${y2}`;
      const changed = !b.startsWith('=') && P.turns.some((t) => (t.from || null) === (a === '*' ? null : a) && t.to === b);
      const on = this.sel && this.sel.edge && this.sel.from === a && this.sel.to === b;
      for (const [w, cls] of [[12, 'hit'], [on || changed ? 2.4 : 1.4, kind]]) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', `pt-e ${cls}${changed ? ' changed' : ''}${on ? ' on' : ''}`);
        p.setAttribute('stroke-width', w);
        if (cls !== 'hit') p.setAttribute('marker-end', on || changed ? 'url(#ptarr2)' : 'url(#ptarr)');
        if (cls === 'hit' && !b.startsWith('=')) {
          p.addEventListener('click', () => {
            this.sel = { edge: true, from: a, to: b };
            this.openPatch();
          });
          const t = document.createElementNS(NS, 'title');
          t.textContent = `From ${human(a)} to ${human(b)}: click to change`;
          p.append(t);
        }
        svg.append(p);
      }
    };
    for (const n of mp.nodes) {
      for (const t of n.to) edge(n.id, t, 'go');
      for (const t of n.maybe) edge(n.id, t, 'maybe');
      for (const e of n.ends) edge(n.id, `=${e}`, 'end');
    }
    for (const n of mp.nodes) {
      const p = pos.get(n.id);
      const has = P.arrive.some((a) => a.node === n.id);
      const on = this.sel && !this.sel.edge && this.sel.node === n.id;
      const el = h('div', { class: `pt-node${n.id === mp.start ? ' start' : ''}${has ? ' changed' : ''}${on ? ' on' : ''}`, style: { left: `${p.x}px`, top: `${p.y}px`, width: `${W}px`, height: `${H}px` } }, h('b', null, human(n.id)), n.tasks.length ? h('span', { class: 'note' }, `tasks: ${n.tasks.map(human).join(', ')}`) : n.id === mp.start ? h('span', { class: 'note' }, 'where it begins') : null);
      el.addEventListener('click', () => {
        this.sel = { node: n.id };
        this.openPatch();
      });
      wrap.append(el);
    }
    for (const e of mp.ends) {
      const p = pos.get(`=${e}`);
      wrap.append(h('div', { class: 'pt-end', style: { left: `${p.x}px`, top: `${p.y}px`, width: `${W}px`, height: `${H}px` } }, h('b', null, human(e)), h('span', { class: 'note' }, 'an ending')));
    }
    if (mp.any.to.length || mp.any.ends.length) wrap.append(h('div', { class: 'pt-any note', style: { left: '20px', top: `${totalH - 30}px` } }, `From anywhere (by what's said or heard): ${[...mp.any.to.map(human), ...mp.any.ends.map((e) => `ends ${human(e).toLowerCase()}`)].join(', ')}`));
    return wrap;
  }

  drawSel(el, mp) {
    const P = this.patch;
    const app = this.app;
    const s = this.sel;
    if (!s) {
      el.append(h('div', { class: 'note' }, 'Click a turn (an arrow) to send the story another way there now and then; click a part to do something of yours when it gets there.'));
      return;
    }
    if (s.edge) {
      const i = P.turns.findIndex((t) => (t.from || null) === s.from && t.to === s.to);
      const t = i >= 0 ? P.turns[i] : null;
      el.append(h('div', { class: 'note', style: { marginBottom: '6px' } }, `When it goes from ${human(s.from)} to ${human(s.to)}:`));
      if (!t) {
        el.append(button('Sometimes go another way...', { small: true, kind: 'primary', icon: 'plus', onClick: () => this.setPatch((x) => x.turns.push({ from: s.from, to: s.to, chance: 50, instead: '' })) }));
        return;
      }
      const opts = [['', '(choose)'], ...mp.nodes.filter((n) => n.id !== s.to).map((n) => [n.id, `go to ${human(n.id)}`]), ...mp.ends.map((e) => [`=${e}`, `end it: ${human(e)}`]), ...Object.values(app.mod.stories || {}).map((q) => [`@${q.id}`, `into my story "${q.name}"`])];
      el.append(field('How often (%)', slider({ value: t.chance ?? 50, min: 1, max: 100, int: true, onChange: (v) => this.setPatch((x) => (x.turns[i].chance = v), false) })));
      el.append(field('Instead', select(opts, t.instead || '', (v) => this.setPatch((x) => (x.turns[i].instead = v)))));
      el.append(h('div', { class: 'row', style: { marginTop: '6px' } }, button('Undo this change', { small: true, kind: 'ghost', icon: 'trash', onClick: () => this.setPatch((x) => x.turns.splice(i, 1)) })));
      return;
    }
    const i = P.arrive.findIndex((a) => a.node === s.node);
    const a = i >= 0 ? P.arrive[i] : null;
    el.append(h('div', { class: 'note', style: { marginBottom: '6px' } }, `When it gets to ${human(s.node)}:`));
    if (!a) {
      el.append(button('Do something of mine there...', { small: true, kind: 'primary', icon: 'plus', onClick: () => this.setPatch((x) => x.arrive.push({ node: s.node, message: '', event: '', story: null })) }));
      return;
    }
    const set = (k, v) => this.setPatch((x) => (x.arrive[i][k] = v), false);
    el.append(field('Tell those in it', textInput({ long: true, value: a.message || '', placeholder: 'Words on screen (optional)', onChange: (v) => set('message', v.slice(0, 200)) }), { wide: true }));
    el.append(field('Send event', textInput({ value: a.event || '', placeholder: 'an event name (optional)', onChange: (v) => set('event', v.trim().slice(0, 40)) }), { tip: 'Heard by On event nodes in your graphs, and Wait for in your stories.' }));
    el.append(field('Start my story', refPicker(app, 'story', a.story || null, (v) => set('story', v), { create: () => this.newStory('blank') })));
    el.append(h('div', { class: 'row', style: { marginTop: '6px' } }, button('Undo this change', { small: true, kind: 'ghost', icon: 'trash', onClick: () => this.setPatch((x) => x.arrive.splice(i, 1)) })));
  }
}
