// Graphs (round 62): what the Workshop's visual code is made of, and how
// it's run in the game.
//
// A graph is nodes and the wires between them: { nodes: [{ id, type, x, y,
// v: {input: value}, p: {prop: value} }], links: [{ id, from: [node,
// port], to: [node, port] }] }. A node's kind (see nodes.js, which fills
// NODES) says what it has: inputs and outputs, and what it does.
//
// Two kinds of wire:
//   flow   what happens next ("when this happens, do that, then this")
//   data   a value (a number, a creature, a place, a piece of art) handed
//          from one node to another
// An input with nothing wired into it uses the value typed into it.
//
// Every entity (a block, an item, a creature, an effect, an event) is one
// graph with one template node at its root: the root's inputs are what the
// entity is (its name, its picture, how hard it hits), its flow outputs
// when something happens to it (used, struck, killed, stepped on). The
// rest of the graph is what's done then.
export const T = {
  flow: 'flow', num: 'number', bool: 'bool', text: 'text', color: 'color', ent: 'entity', pos: 'pos', item: 'item', block: 'block',
  creature: 'creature', asset: 'asset', vfx: 'vfx', rig: 'rig', loot: 'loot', structure: 'structure', story: 'story', sound: 'sound',
  effect: 'effect', any: 'any', list: 'list', town: 'town', world: 'world', song: 'song', clip: 'clip',
};
// How each kind of wire looks (the editor's colours).
export const TYPE_COLORS = {
  flow: '#f4ecd8', number: '#7ad0ff', bool: '#ff7a7a', text: '#ffd070', color: '#ff9adf', entity: '#8ce07a', pos: '#c8a0ff', item: '#ffb050',
  block: '#c89a68', creature: '#70e0b0', asset: '#ff80c0', vfx: '#f070ff', rig: '#a0f0ff', loot: '#e0c060', structure: '#b0b8c8', story: '#e8a0a0',
  sound: '#90c0ff', effect: '#c0ff80', any: '#c0c0c0', list: '#a0a0ff', town: '#e0b070', world: '#70c8c0', song: '#b0a0ff', clip: '#80d8ff',
};
// What can go into what (besides the same kind, and anything into 'any').
const FITS = {
  number: ['bool'], text: ['number', 'bool', 'color', 'item', 'block', 'creature', 'sound', 'town'], bool: ['number'], entity: [], pos: ['entity', 'town'],
  // (Round 65: a town from its name, or from someone of it.)
  town: ['text', 'entity'],
};
export function fits(from, to) {
  if (from === to || to === 'any' || from === 'any') return from !== 'flow' && to !== 'flow' ? true : from === to;
  if (from === 'flow' || to === 'flow') return false;
  return (FITS[to] || []).includes(from);
}

// ------------------------------------------------------------ the kinds of node
export const NODES = {};
export const CATS = [];
// def(type, { cat, title, help, color, root, kind, in: [ports], out:
// [ports], props: [fields], run(x, n, api), eval(x, n, port, api) }).
// A port: { id, t (a T), label, def (its value unwired), opts (for a
// choice), min, max, step, adv (shown in the inspector only) }.
// (Round 64) A port or prop can have `show`: what the node's settings
// must be for it to be there at all ({ setting: [values] }, or a function
// of `get(setting)`): see shown. A node with any such is `dyn`: its box is
// drawn afresh when a setting changes.
export function def(type, d) {
  const n = { type, in: [], out: [], props: [], color: '#5a5470', ...d };
  n.inMap = Object.fromEntries(n.in.map((p) => [p.id, p]));
  n.outMap = Object.fromEntries(n.out.map((p) => [p.id, p]));
  n.propMap = Object.fromEntries(n.props.map((p) => [p.id, p]));
  n.dyn = [...n.in, ...n.out, ...n.props].some((p) => p.show);
  NODES[type] = n;
  if (!CATS.includes(n.cat)) CATS.push(n.cat);
  return n;
}

// Whether node `n`'s port or prop `p` is there, as its settings are now.
export function shown(n, p) {
  const s = p && p.show;
  if (!s) return true;
  const d = NODES[n.type];
  const get = (k) => {
    if (n.p && n.p[k] !== undefined) return n.p[k];
    if (n.v && n.v[k] !== undefined) return n.v[k];
    const q = d && (d.propMap[k] || d.inMap[k]);
    return q ? q.def : undefined;
  };
  if (typeof s === 'function') return !!s(get);
  return Object.entries(s).every(([k, vals]) => {
    const v = get(k);
    if (vals && typeof vals === 'object' && !Array.isArray(vals) && vals.not) return !vals.not.includes(v);
    return Array.isArray(vals) ? vals.includes(v) : v === vals;
  });
}

// (Round 64) Words typed into a field with {names} in them, the names'
// values put in as the flow runs (set by nodes.js: see fillText).
export const FILL = { fn: null };

// A new node of a kind, its inputs and props at their defaults.
let nodeSeq = 0;
export function makeNode(type, x = 0, y = 0, o = {}) {
  const d = NODES[type];
  if (!d) throw new Error(`no node kind ${type}`);
  const v = {};
  for (const p of d.in) if (p.t !== 'flow' && p.def !== undefined) v[p.id] = clone(p.def);
  const p = {};
  for (const q of d.props) if (q.def !== undefined) p[q.id] = clone(q.def);
  return { id: o.id || `n${Date.now().toString(36)}${(nodeSeq++).toString(36)}`, type, x: Math.round(x), y: Math.round(y), v: { ...v, ...(o.v || {}) }, p: { ...p, ...(o.p || {}) } };
}
const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

export function emptyGraph() {
  return { nodes: [], links: [], notes: [] };
}

// ------------------------------------------------------------ checking
// What's wrong with a graph: [{ node, text, level }].
export function lint(g) {
  const out = [];
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const roots = g.nodes.filter((n) => NODES[n.type] && NODES[n.type].root);
  if (roots.length > 1) out.push({ node: roots[1].id, level: 'error', text: 'Only one template node in a graph: this one is ignored.' });
  for (const n of g.nodes) if (!NODES[n.type]) out.push({ node: n.id, level: 'error', text: `Unknown node "${n.type}" (from a newer game?): it does nothing.` });
  for (const l of g.links) {
    const a = byId.get(l.from[0]);
    const b = byId.get(l.to[0]);
    if (!a || !b) continue;
    const pa = NODES[a.type]?.outMap[l.from[1]];
    const pb = NODES[b.type]?.inMap[l.to[1]];
    if (!pa || !pb) out.push({ node: b.id, level: 'warn', text: 'A wire to a socket that\'s gone.' });
    else if (!fits(pa.t, pb.t)) out.push({ node: b.id, level: 'error', text: `A ${pa.t} wire can't go into ${pb.label || pb.id} (${pb.t}).` });
    // (Round 64) Wired where the node, as it's set, doesn't look.
    else if (pb.t !== 'flow' && !shown(b, pb)) out.push({ node: b.id, level: 'warn', text: `${pb.label || pb.id} is wired, but as this node's set it isn't used.` });
    else if (!shown(a, pa)) out.push({ node: a.id, level: 'warn', text: `${pa.label || pa.id} is wired, but as this node's set it never comes.` });
  }
  // Flow loops with no wait in them would never end.
  const flowNext = new Map();
  for (const l of g.links) {
    const a = byId.get(l.from[0]);
    if (!a || NODES[a.type]?.outMap[l.from[1]]?.t !== 'flow') continue;
    if (!flowNext.has(a.id)) flowNext.set(a.id, []);
    flowNext.get(a.id).push(l.to[0]);
  }
  const seen = new Set();
  const stack = new Set();
  const loop = (id) => {
    if (stack.has(id)) return id;
    if (seen.has(id)) return null;
    seen.add(id);
    stack.add(id);
    const n = byId.get(id);
    if (n && !(NODES[n.type] && NODES[n.type].waits)) for (const k of flowNext.get(id) || []) {
      const hit = loop(k);
      if (hit) return hit;
    }
    stack.delete(id);
    return null;
  };
  for (const n of g.nodes) {
    const hit = loop(n.id);
    if (hit) {
      out.push({ node: hit, level: 'error', text: 'This flow runs round in a loop with no Wait in it: it would never end, so it stops after a while.' });
      break;
    }
  }
  return out;
}

// ------------------------------------------------------------ compiling
// A graph made ready to run: nodes by id, what's wired into each input,
// where each flow output goes, and the root.
export function compile(g, meta = {}) {
  const nodes = new Map();
  for (const n of g.nodes || []) if (NODES[n.type]) nodes.set(n.id, n);
  const into = new Map(); // `${node}.${port}` -> [node, port] (data)
  const next = new Map(); // `${node}.${port}` -> [[node, port]] (flow)
  for (const l of g.links || []) {
    const a = nodes.get(l.from[0]);
    const b = nodes.get(l.to[0]);
    if (!a || !b) continue;
    const pa = NODES[a.type].outMap[l.from[1]];
    const pb = NODES[b.type].inMap[l.to[1]];
    if (!pa || !pb || !fits(pa.t, pb.t)) continue;
    if (pa.t === 'flow') {
      const k = `${a.id}.${pa.id}`;
      if (!next.has(k)) next.set(k, []);
      next.get(k).push([b.id, pb.id]);
    } else into.set(`${b.id}.${pb.id}`, [a.id, pa.id]);
  }
  const root = [...nodes.values()].find((n) => NODES[n.type].root) || null;
  // Every node that starts a flow of its own (an ability, an event
  // listened for), besides the root's outputs.
  const starts = [...nodes.values()].filter((n) => NODES[n.type].starts);
  return { nodes, into, next, root, starts, meta };
}

// ------------------------------------------------------------ running
// Something done, from a node's flow output on. `x` is what it's done in:
// { game, mod, prog, self, target, pos, item, block, payload, vars,
// steps }. Everything that runs a graph comes through here.
const MAX_STEPS = 4000;
// (Round 79) Told of each node run (the story debugger's trace: see
// mod/scripts.js), when set.
export const RUN_HOOK = { node: null };
export class Runner {
  constructor(prog, host) {
    this.prog = prog;
    // `host`: what the nodes reach the game through (see hooks.js):
    // { later(sec, fn), ask(x, text, choices, cb), fault(e) }.
    this.host = host;
  }

  ctx(base = {}) {
    return { steps: 0, vars: {}, locals: {}, ...base, prog: this.prog };
  }

  // Fire output `port` of node `id` (the flow from there on).
  fire(x, id, port) {
    const list = this.prog.next.get(`${id}.${port}`);
    if (!list) return;
    for (const [nid] of list) this.exec(x, nid);
  }

  // Run one node (a flow node: it does what it does, then fires on).
  exec(x, id) {
    if (++x.steps > MAX_STEPS) {
      if (!x.overrun) {
        x.overrun = true;
        this.host.fault?.(new Error('A flow ran too long (a loop?) and was stopped.'), id);
      }
      return;
    }
    const n = this.prog.nodes.get(id);
    if (!n) return;
    const d = NODES[n.type];
    if (!d.run) return;
    if (RUN_HOOK.node) RUN_HOOK.node(x, n);
    let r;
    try {
      r = d.run(x, n, this.api(x, n));
    } catch (e) {
      this.host.fault?.(e, id);
      return;
    }
    if (typeof r === 'string') this.fire(x, id, r);
    else if (Array.isArray(r)) for (const p of r) this.fire(x, id, p);
  }

  // What a node's own code is handed.
  api(x, n) {
    const self = this;
    return {
      in: (port) => self.input(x, n, port),
      prop: (k) => (n.p && n.p[k] !== undefined ? n.p[k] : NODES[n.type].propMap[k]?.def),
      wired: (port) => self.prog.into.has(`${n.id}.${port}`),
      fire: (port, extra = null) => {
        if (extra) Object.assign(x.locals, extra);
        self.fire(x, n.id, port);
      },
      // The rest of the flow from `port`, in `sec` seconds (in a copy of
      // where it was, so what comes after doesn't change it).
      later: (sec, port, extra = null) => {
        const y = { ...x, locals: { ...x.locals, ...(extra || {}) }, steps: 0 };
        self.host.later(sec, () => self.fire(y, n.id, port), x);
      },
      // (Round 64) The rest of the flow from `port`, whenever the function
      // handed back is called (a creature got where it was sent, say).
      afterwards: (port) => {
        const y = { ...x, locals: { ...x.locals }, steps: 0 };
        return (extra = null) => {
          if (extra) Object.assign(y.locals, extra);
          y.steps = 0;
          self.fire(y, n.id, port);
        };
      },
      ask: (text, choices, cb) => self.host.ask(x, text, choices, cb, n),
      host: self.host,
      x,
    };
  }

  // The value at input `port` of node `n`: what's wired into it, or what's
  // typed into it.
  input(x, n, port) {
    const src = this.prog.into.get(`${n.id}.${port}`);
    if (src) {
      const m = this.prog.nodes.get(src[0]);
      const d = m && NODES[m.type];
      if (d && d.eval) {
        try {
          return d.eval(x, m, src[1], this.api(x, m));
        } catch (e) {
          this.host.fault?.(e, m.id);
          return undefined;
        }
      }
      // (A flow node's data output: what it set as it ran, e.g. "each".)
      return x.locals[`${src[0]}.${src[1]}`];
    }
    const v = n.v ? n.v[port] : undefined;
    const out = v !== undefined ? v : NODES[n.type].inMap[port]?.def;
    // (A value typed with {a name} in it: the name's value put in; a number
    // wanted, a number made of it.)
    if (typeof out === 'string' && out.includes('{') && FILL.fn) {
      const t = FILL.fn(x, out);
      const pt = NODES[n.type].inMap[port]?.t;
      if (pt === 'number') return t.trim() !== '' && !Number.isNaN(+t) ? +t : 0;
      if (pt === 'bool') return t === 'true' || (t.trim() !== '' && !Number.isNaN(+t) && +t !== 0);
      return t;
    }
    return out;
  }

  // An entity's root output fired: `port` of the root (if it's wired).
  emit(port, base = {}) {
    const r = this.prog.root;
    if (!r || !this.prog.next.has(`${r.id}.${port}`)) return false;
    const x = this.ctx(base);
    x.cause ||= port;
    this.fire(x, r.id, port);
    return true;
  }

  // The fields of the entity (the root's inputs and props), worked out
  // once: what it is.
  fields(base = {}) {
    const r = this.prog.root;
    if (!r) return {};
    const d = NODES[r.type];
    const x = this.ctx(base);
    const out = {};
    for (const p of d.in) if (p.t !== 'flow') out[p.id] = this.input(x, r, p.id);
    for (const p of d.props) out[p.id] = r.p && r.p[p.id] !== undefined ? r.p[p.id] : p.def;
    return out;
  }
}
