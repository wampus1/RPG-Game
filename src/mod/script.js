// (Round 79) ModScript: a mod's own text scripts, for what's quicker typed
// than wired. A small language of its own, read and run here, word by word
// (never handed to the browser's JavaScript): it can reach the game only
// through the handful of things listed in API below (the same the graph
// nodes use), and nothing else at all; no files, no network, no page. Each
// run is counted (steps, time, depth, sizes) and stopped the moment it
// goes over, so a script can't hang or swamp the game, let alone the
// machine it runs on; one that keeps going over is switched off.
//
// What it looks like:
//
//   # a comment
//   let n = 3
//   fn boom(power) {
//     shake(power)
//     flash("#ffd080", 0.3)
//     say("Boom! x" + str(power), "#ffb070")
//   }
//   on command "boom" (args) {
//     boom(num(args[0]) or 1)
//   }
//   on hour {
//     if hour() == 6 { say("Dawn.") }
//   }
//   on event "lever_pulled" (value) { setvar("pulled", getvar("pulled") + 1) }
//   on migrate "1.1.0" { setvar("gold", getvar("coins")) }
//
// Statements: let, assignment (x = ..., x += ...), if / else if / else,
// while, for x in list, fn name(args) { }, return, break, continue, and
// handlers: on load | tick | hour | day | command "name" (args) |
// event "name" (value) | kill (who) | break (block, pos) | migrate "ver".
// Values: numbers, text ("..."), true, false, none, lists [a, b], maps
// {key: value}; list[i], map.key or map["key"].
// Operators: + - * / % == != < <= > >= and or not.

const LIMITS = { steps: 40000, ms: 12, depth: 48, str: 8000, list: 4000, overruns: 5 };
const KEYWORDS = new Set(['let', 'fn', 'if', 'else', 'while', 'for', 'in', 'return', 'break', 'continue', 'on', 'true', 'false', 'none', 'and', 'or', 'not']);
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export class ScriptError extends Error {
  constructor(msg, line) {
    super(line ? `line ${line}: ${msg}` : msg);
    this.line = line || null;
  }
}

// ------------------------------------------------------------ reading
function tokenize(src) {
  const out = [];
  let i = 0;
  let line = 1;
  const s = String(src || '');
  if (s.length > 60000) throw new ScriptError('the script is too long (60000 characters at most)');
  while (i < s.length) {
    const c = s[i];
    if (c === '\n') {
      out.push({ t: 'nl', line });
      line++;
      i++;
    } else if (c === ' ' || c === '\t' || c === '\r') i++;
    else if (c === '#') {
      while (i < s.length && s[i] !== '\n') i++;
    } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      out.push({ t: 'num', v: Number(s.slice(i, j)), line });
      i = j;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      const w = s.slice(i, j);
      out.push({ t: KEYWORDS.has(w) ? w : 'id', v: w, line });
      i = j;
    } else if (c === '"' || c === '\'') {
      let j = i + 1;
      let v = '';
      while (j < s.length && s[j] !== c) {
        if (s[j] === '\n') throw new ScriptError('text not closed (a " missing?)', line);
        if (s[j] === '\\' && j + 1 < s.length) {
          const e = s[j + 1];
          v += e === 'n' ? '\n' : e === 't' ? '\t' : e;
          j += 2;
        } else v += s[j++];
      }
      if (j >= s.length) throw new ScriptError('text not closed (a " missing?)', line);
      out.push({ t: 'str', v, line });
      i = j + 1;
    } else {
      const two = s.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/='].includes(two)) {
        out.push({ t: two, line });
        i += 2;
      } else if ('+-*/%<>=(){}[],.:'.includes(c)) {
        out.push({ t: c, line });
        i++;
      } else throw new ScriptError(`can't read "${c}"`, line);
    }
  }
  out.push({ t: 'eof', line });
  return out;
}

class Parser {
  constructor(toks) {
    this.k = toks;
    this.i = 0;
  }
  peek(o = 0) {
    return this.k[this.i + o];
  }
  next() {
    return this.k[this.i++];
  }
  is(t) {
    return this.peek().t === t;
  }
  eat(t, what) {
    const k = this.next();
    if (k.t !== t) throw new ScriptError(`expected ${what || t}, found ${k.t === 'nl' ? 'the end of the line' : k.t === 'eof' ? 'the end' : k.v ?? k.t}`, k.line);
    return k;
  }
  skipNl() {
    while (this.is('nl')) this.i++;
  }
  program() {
    const body = [];
    this.skipNl();
    while (!this.is('eof')) {
      body.push(this.stmt(true));
      this.skipNl();
    }
    return body;
  }
  block() {
    this.eat('{', '{');
    const body = [];
    this.skipNl();
    while (!this.is('}')) {
      if (this.is('eof')) throw new ScriptError('a { was never closed with }', this.peek().line);
      body.push(this.stmt(false));
      this.skipNl();
    }
    this.eat('}');
    return body;
  }
  params() {
    const ps = [];
    if (!this.is('(')) return ps;
    this.eat('(');
    while (!this.is(')')) {
      ps.push(this.eat('id', 'a name').v);
      if (!this.is(')')) this.eat(',', ', or )');
    }
    this.eat(')');
    return ps;
  }
  stmt(top) {
    const k = this.peek();
    const line = k.line;
    switch (k.t) {
      case 'let': {
        this.next();
        const name = this.eat('id', 'a name').v;
        this.eat('=', '=');
        return { s: 'let', name, e: this.expr(), line };
      }
      case 'fn': {
        this.next();
        const name = this.eat('id', 'a name for the function').v;
        return { s: 'fn', name, params: this.params(), body: this.block(), line };
      }
      case 'on': {
        if (!top) throw new ScriptError('"on" handlers go at the top of the script, not inside anything', line);
        this.next();
        const kind = this.eat(this.is('break') ? 'break' : 'id', 'what to answer (load, tick, hour, day, command, event, kill, break, migrate)').v;
        let name = null;
        if (['command', 'event', 'migrate'].includes(kind)) name = this.eat('str', `the ${kind}'s name, in quotes`).v;
        else if (!['load', 'tick', 'hour', 'day', 'kill', 'break'].includes(kind)) throw new ScriptError(`there's no "on ${kind}" (try load, tick, hour, day, command, event, kill, break, migrate)`, line);
        return { s: 'on', kind, name, params: this.params(), body: this.block(), line };
      }
      case 'if': {
        this.next();
        const cond = this.expr();
        const then = this.block();
        let other = null;
        if (this.is('else')) {
          this.next();
          other = this.is('if') ? [this.stmt(false)] : this.block();
        }
        return { s: 'if', cond, then, other, line };
      }
      case 'while': {
        this.next();
        return { s: 'while', cond: this.expr(), body: this.block(), line };
      }
      case 'for': {
        this.next();
        const name = this.eat('id', 'a name').v;
        this.eat('in', 'in');
        return { s: 'for', name, e: this.expr(), body: this.block(), line };
      }
      case 'return': {
        this.next();
        return { s: 'return', e: this.is('nl') || this.is('}') ? null : this.expr(), line };
      }
      case 'break':
        this.next();
        return { s: 'break', line };
      case 'continue':
        this.next();
        return { s: 'continue', line };
      default: {
        const e = this.expr();
        if (['=', '+=', '-=', '*=', '/='].includes(this.peek().t)) {
          const op = this.next().t;
          if (!['var', 'index', 'field'].includes(e.e)) throw new ScriptError('only a name, list[i] or map.key can be set', line);
          return { s: 'set', target: e, op, e: this.expr(), line };
        }
        return { s: 'expr', e, line };
      }
    }
  }
  expr() {
    return this.or();
  }
  or() {
    let a = this.and();
    while (this.is('or')) {
      const line = this.next().line;
      a = { e: 'or', a, b: this.and(), line };
    }
    return a;
  }
  and() {
    let a = this.not();
    while (this.is('and')) {
      const line = this.next().line;
      a = { e: 'and', a, b: this.not(), line };
    }
    return a;
  }
  not() {
    if (this.is('not')) {
      const line = this.next().line;
      return { e: 'not', a: this.not(), line };
    }
    return this.cmp();
  }
  cmp() {
    let a = this.add();
    while (['==', '!=', '<', '<=', '>', '>='].includes(this.peek().t)) {
      const k = this.next();
      a = { e: 'bin', op: k.t, a, b: this.add(), line: k.line };
    }
    return a;
  }
  add() {
    let a = this.mul();
    while (this.is('+') || this.is('-')) {
      const k = this.next();
      a = { e: 'bin', op: k.t, a, b: this.mul(), line: k.line };
    }
    return a;
  }
  mul() {
    let a = this.unary();
    while (this.is('*') || this.is('/') || this.is('%')) {
      const k = this.next();
      a = { e: 'bin', op: k.t, a, b: this.unary(), line: k.line };
    }
    return a;
  }
  unary() {
    if (this.is('-')) {
      const line = this.next().line;
      return { e: 'neg', a: this.unary(), line };
    }
    return this.post();
  }
  post() {
    let a = this.atom();
    for (;;) {
      if (this.is('(')) {
        const line = this.next().line;
        const args = [];
        this.skipNl();
        while (!this.is(')')) {
          args.push(this.expr());
          this.skipNl();
          if (!this.is(')')) this.eat(',', ', or )');
          this.skipNl();
        }
        this.eat(')');
        a = { e: 'call', f: a, args, line };
      } else if (this.is('[')) {
        const line = this.next().line;
        const i = this.expr();
        this.eat(']', ']');
        a = { e: 'index', a, i, line };
      } else if (this.is('.')) {
        const line = this.next().line;
        a = { e: 'field', a, k: this.eat('id', 'a name after .').v, line };
      } else return a;
    }
  }
  atom() {
    const k = this.next();
    switch (k.t) {
      case 'num': return { e: 'lit', v: k.v };
      case 'str': return { e: 'lit', v: k.v };
      case 'true': return { e: 'lit', v: true };
      case 'false': return { e: 'lit', v: false };
      case 'none': return { e: 'lit', v: null };
      case 'id': return { e: 'var', name: k.v, line: k.line };
      case '(': {
        const e = this.expr();
        this.eat(')', ')');
        return e;
      }
      case '[': {
        const items = [];
        this.skipNl();
        while (!this.is(']')) {
          items.push(this.expr());
          this.skipNl();
          if (!this.is(']')) this.eat(',', ', or ]');
          this.skipNl();
        }
        this.eat(']');
        return { e: 'list', items, line: k.line };
      }
      case '{': {
        const pairs = [];
        this.skipNl();
        while (!this.is('}')) {
          const kk = this.next();
          if (kk.t !== 'id' && kk.t !== 'str') throw new ScriptError('a map\'s keys are names or text', kk.line);
          this.eat(':', ':');
          pairs.push([kk.v, this.expr()]);
          this.skipNl();
          if (!this.is('}')) this.eat(',', ', or }');
          this.skipNl();
        }
        this.eat('}');
        return { e: 'map', pairs, line: k.line };
      }
      default:
        throw new ScriptError(`didn't expect ${k.t === 'nl' ? 'the end of the line' : k.t === 'eof' ? 'the end' : `"${k.v ?? k.t}"`} here`, k.line);
    }
  }
}

// A script read: its functions and handlers, or throws a ScriptError.
export function parseScript(src) {
  const body = new Parser(tokenize(src)).program();
  const fns = {};
  const handlers = [];
  const top = [];
  for (const st of body) {
    if (st.s === 'fn') fns[st.name] = st;
    else if (st.s === 'on') handlers.push(st);
    else top.push(st);
  }
  return { fns, handlers, top };
}

// What's wrong with a script (for the Workshop): [] or [{ line, text }].
export function checkScript(src) {
  try {
    const p = parseScript(src);
    const out = [];
    const known = new Set([...Object.keys(API), ...Object.keys(p.fns)]);
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (n.e === 'call' && n.f.e === 'var' && !known.has(n.f.name)) out.push({ line: n.line, text: `there's no "${n.f.name}" (see the list of what scripts can do)` });
      for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
    };
    walk([...Object.values(p.fns), ...p.handlers, ...p.top]);
    return out;
  } catch (e) {
    return [{ line: e.line || null, text: e.message }];
  }
}

// ------------------------------------------------------------ running
class Stop {
  constructor(kind, v) {
    this.kind = kind;
    this.v = v;
  }
}

const isMap = (v) => !!v && typeof v === 'object' && v.__map === true;
const isList = Array.isArray;
const mkMap = () => {
  const m = Object.create(null);
  Object.defineProperty(m, '__map', { value: true });
  return m;
};
// A map, as scripts have them, of a plain object's own values.
export function toMap(o) {
  const m = mkMap();
  for (const [k, v] of Object.entries(o || {})) if (!BAD_KEYS.has(k)) m[k] = v;
  return m;
}
export function show(v) {
  if (v === null || v === undefined) return 'none';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(+v.toFixed(4));
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (isList(v)) return `[${v.slice(0, 20).map(show).join(', ')}${v.length > 20 ? ', ...' : ''}]`;
  if (isMap(v)) return `{${Object.keys(v).slice(0, 12).map((k) => `${k}: ${show(v[k])}`).join(', ')}}`;
  if (v && v.__ent) return `<${v.kind || 'thing'}${v.name ? ` ${v.name}` : ''}>`;
  return '?';
}
const truthy = (v) => !(v === null || v === undefined || v === false || v === 0 || v === '');

// A script made ready: `src`, for mod `mod` (as shown), handed `host`:
// { game, mod, call(kind, fnName, args) (see API), log(text, level) }.
export class Script {
  constructor(src, info = {}) {
    this.info = info;
    this.prog = parseScript(src);
    this.globals = new Map();
    this.overruns = 0;
    this.off = false;
    this.runs = 0;
    this.started = false;
  }

  // Handlers of a kind (and name).
  handlers(kind, name = null) {
    return this.prog.handlers.filter((h) => h.kind === kind && (name === null || h.name === name));
  }

  // Run the script's top lines once (its lets), then every `on load`.
  start(x) {
    if (this.started) return;
    this.started = true;
    this.run(x, () => {
      const env = { vars: this.globals, up: null };
      this.execBlock(this.prog.top, env, x);
    });
  }

  // Answer something: every handler of `kind` (and `name`), given `args`.
  fire(x, kind, name = null, args = []) {
    let n = 0;
    for (const h of this.handlers(kind, name)) {
      n++;
      this.run(x, () => {
        const env = { vars: new Map(), up: { vars: this.globals, up: null } };
        h.params.forEach((p, i) => env.vars.set(p, args[i] ?? null));
        this.execBlock(h.body, env, x);
      });
    }
    return n;
  }

  // Call one of its functions by name (from `after`).
  callFn(x, name, args = []) {
    const f = this.prog.fns[name];
    if (!f) return;
    this.run(x, () => this.invoke(f, args, x));
  }

  run(x, fn) {
    if (this.off) return;
    this.runs++;
    x.steps = 0;
    x.depth = 0;
    x.t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    x.script = this;
    try {
      fn();
    } catch (e) {
      if (e instanceof Stop) return;
      const msg = e instanceof ScriptError ? e.message : `stopped: ${e && e.message ? e.message : e}`;
      if (e && e.overrun) {
        this.overruns++;
        if (this.overruns >= LIMITS.overruns) {
          this.off = true;
          x.log?.(`${this.info.name || 'A script'} kept running over and has been switched off.`, 'error');
        }
      }
      x.log?.(`${this.info.name || 'script'}: ${msg}`, 'error');
    }
  }

  tick(x, line) {
    if (++x.steps > LIMITS.steps) throw Object.assign(new ScriptError('it ran too long (a loop that never ends?)', line), { overrun: true });
    if ((x.steps & 255) === 0) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - x.t0 > LIMITS.ms) throw Object.assign(new ScriptError('it took too long', line), { overrun: true });
    }
  }

  execBlock(list, env, x) {
    for (const st of list) this.exec(st, env, x);
  }

  lookup(env, name) {
    for (let e = env; e; e = e.up) if (e.vars.has(name)) return e;
    return null;
  }

  exec(st, env, x) {
    this.tick(x, st.line);
    switch (st.s) {
      case 'let':
        env.vars.set(st.name, this.eval(st.e, env, x));
        return;
      case 'fn':
        return;
      case 'set': {
        let v = this.eval(st.e, env, x);
        const t = st.target;
        const old = () => this.eval(t, env, x);
        if (st.op !== '=') v = this.bin(st.op[0], old(), v, st.line);
        if (t.e === 'var') {
          const e = this.lookup(env, t.name) || env;
          e.vars.set(t.name, v);
        } else {
          const o = this.eval(t.a, env, x);
          const k = t.e === 'field' ? t.k : this.eval(t.i, env, x);
          this.store(o, k, v, st.line);
        }
        return;
      }
      case 'expr':
        this.eval(st.e, env, x);
        return;
      case 'if':
        if (truthy(this.eval(st.cond, env, x))) this.execBlock(st.then, { vars: new Map(), up: env }, x);
        else if (st.other) this.execBlock(st.other, { vars: new Map(), up: env }, x);
        return;
      case 'while':
        while (truthy(this.eval(st.cond, env, x))) {
          this.tick(x, st.line);
          try {
            this.execBlock(st.body, { vars: new Map(), up: env }, x);
          } catch (e) {
            if (e instanceof Stop && e.kind === 'break') break;
            if (e instanceof Stop && e.kind === 'continue') continue;
            throw e;
          }
        }
        return;
      case 'for': {
        const it = this.eval(st.e, env, x);
        const list = isList(it) ? it.slice() : isMap(it) ? Object.keys(it) : typeof it === 'string' ? [...it] : typeof it === 'number' ? Array.from({ length: Math.max(0, Math.min(LIMITS.list, Math.floor(it))) }, (_, i) => i) : [];
        for (const v of list) {
          this.tick(x, st.line);
          const inner = { vars: new Map([[st.name, v]]), up: env };
          try {
            this.execBlock(st.body, inner, x);
          } catch (e) {
            if (e instanceof Stop && e.kind === 'break') break;
            if (e instanceof Stop && e.kind === 'continue') continue;
            throw e;
          }
        }
        return;
      }
      case 'return':
        throw new Stop('return', st.e ? this.eval(st.e, env, x) : null);
      case 'break':
        throw new Stop('break');
      case 'continue':
        throw new Stop('continue');
      default:
        throw new ScriptError(`can't do "${st.s}" here`, st.line);
    }
  }

  store(o, k, v, line) {
    if (isList(o)) {
      const i = Math.floor(Number(k));
      if (!(i >= 0) || i > LIMITS.list) throw new ScriptError(`no place ${show(k)} in that list`, line);
      o[i] = v;
    } else if (isMap(o)) {
      const kk = String(k);
      if (BAD_KEYS.has(kk)) throw new ScriptError(`"${kk}" can't be a key`, line);
      if (!(kk in o) && Object.keys(o).length >= LIMITS.list) throw new ScriptError('that map is too big', line);
      o[kk] = v;
    } else throw new ScriptError('only lists and maps hold things', line);
  }

  invoke(f, args, x) {
    if (++x.depth > LIMITS.depth) throw Object.assign(new ScriptError('functions calling themselves too deep', f.line), { overrun: true });
    const env = { vars: new Map(), up: { vars: this.globals, up: null } };
    f.params.forEach((p, i) => env.vars.set(p, args[i] ?? null));
    try {
      this.execBlock(f.body, env, x);
      return null;
    } catch (e) {
      if (e instanceof Stop && e.kind === 'return') return e.v;
      throw e;
    } finally {
      x.depth--;
    }
  }

  bin(op, a, b, line) {
    switch (op) {
      case '+':
        if (typeof a === 'string' || typeof b === 'string') {
          const s = show(a) + show(b);
          if (s.length > LIMITS.str) throw new ScriptError('that text is too long', line);
          return s;
        }
        if (isList(a) && isList(b)) {
          if (a.length + b.length > LIMITS.list) throw new ScriptError('that list is too long', line);
          return [...a, ...b];
        }
        return num(a) + num(b);
      case '-': return num(a) - num(b);
      case '*': return num(a) * num(b);
      case '/': return num(b) === 0 ? 0 : num(a) / num(b);
      case '%': return num(b) === 0 ? 0 : num(a) % num(b);
      case '==': return same(a, b);
      case '!=': return !same(a, b);
      case '<': return cmpv(a, b) < 0;
      case '<=': return cmpv(a, b) <= 0;
      case '>': return cmpv(a, b) > 0;
      case '>=': return cmpv(a, b) >= 0;
      default: throw new ScriptError(`no "${op}"`, line);
    }
  }

  eval(n, env, x) {
    this.tick(x, n.line);
    switch (n.e) {
      case 'lit': return n.v;
      case 'var': {
        const e = this.lookup(env, n.name);
        if (e) return e.vars.get(n.name);
        if (this.prog.fns[n.name] || API[n.name]) return { __fn: n.name };
        throw new ScriptError(`"${n.name}" hasn't been set (a let missing?)`, n.line);
      }
      case 'list': {
        if (n.items.length > LIMITS.list) throw new ScriptError('that list is too long', n.line);
        return n.items.map((q) => this.eval(q, env, x));
      }
      case 'map': {
        const m = mkMap();
        for (const [k, v] of n.pairs) {
          if (BAD_KEYS.has(k)) throw new ScriptError(`"${k}" can't be a key`, n.line);
          m[k] = this.eval(v, env, x);
        }
        return m;
      }
      case 'and': return truthy(this.eval(n.a, env, x)) ? this.eval(n.b, env, x) : false;
      case 'or': {
        const a = this.eval(n.a, env, x);
        return truthy(a) ? a : this.eval(n.b, env, x);
      }
      case 'not': return !truthy(this.eval(n.a, env, x));
      case 'neg': return -num(this.eval(n.a, env, x));
      case 'bin': return this.bin(n.op, this.eval(n.a, env, x), this.eval(n.b, env, x), n.line);
      case 'index': {
        const o = this.eval(n.a, env, x);
        const i = this.eval(n.i, env, x);
        if (isList(o) || typeof o === 'string') {
          let k = Math.floor(num(i));
          if (k < 0) k += o.length;
          return o[k] ?? null;
        }
        if (isMap(o)) return BAD_KEYS.has(String(i)) ? null : o[String(i)] ?? null;
        return null;
      }
      case 'field': {
        const o = this.eval(n.a, env, x);
        if (isMap(o)) return BAD_KEYS.has(n.k) ? null : o[n.k] ?? null;
        if (isList(o) && n.k === 'length') return o.length;
        if (typeof o === 'string' && n.k === 'length') return o.length;
        if (o && o.__ent) return entField(o, n.k);
        return null;
      }
      case 'call': {
        const name = n.f.e === 'var' ? n.f.name : null;
        const args = n.args.map((q) => this.eval(q, env, x));
        const local = name ? this.lookup(env, name) : null;
        const target = local ? local.vars.get(name) : name ? { __fn: name } : this.eval(n.f, env, x);
        const fname = target && target.__fn;
        if (fname && this.prog.fns[fname]) return this.invoke(this.prog.fns[fname], args, x);
        if (fname && API[fname]) {
          try {
            const r = API[fname](x, ...args);
            return r === undefined ? null : r;
          } catch (e) {
            if (e instanceof ScriptError || e instanceof Stop) throw e;
            throw new ScriptError(`${fname}: ${e && e.message ? e.message : e}`, n.line);
          }
        }
        throw new ScriptError(`there's no "${name || show(target)}" to call`, n.line);
      }
      default:
        throw new ScriptError(`can't work out "${n.e}"`, n.line);
    }
  }
}

function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(+v)) return +v;
  return 0;
}
function same(a, b) {
  if (a && a.__ent && b && b.__ent) return a.ref === b.ref;
  return a === b || (a == null && b == null);
}
function cmpv(a, b) {
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return num(a) - num(b);
}

// ------------------------------------------------------------ the game, as scripts see it
// Someone or something in the game, handed to a script: a sealed box
// with a few things to read (see entField), never the thing itself.
const WRAPS = new WeakMap();
export function wrapEnt(e) {
  if (!e || typeof e !== 'object') return null;
  let w = WRAPS.get(e);
  if (!w) {
    w = Object.freeze({ __ent: true, ref: e, kind: e.kind || null, name: e.name || (e.account && e.account.name) || null });
    WRAPS.set(e, w);
  }
  return w;
}
const ent = (w) => (w && w.__ent ? w.ref : null);
function entField(w, k) {
  const e = w.ref;
  switch (k) {
    case 'kind': return e.kind || null;
    case 'name': return w.name;
    case 'hp': return typeof e.hp === 'number' ? e.hp : null;
    case 'x': return e.x;
    case 'y': return e.y;
    case 'z': return e.z;
    case 'dead': return !!e.dead;
    case 'species': return e.species || null;
    default: return null;
  }
}
const posMap = (p) => {
  const m = mkMap();
  m.x = Math.round(p.x);
  m.y = Math.round(p.y);
  m.z = Math.round(p.z);
  return m;
};
const posIn = (x, v) => {
  if (isMap(v) && 'x' in v) return { x: num(v.x), y: num(v.y), z: num(v.z) };
  const e = ent(v);
  if (e) return { x: e.x, y: e.y, z: e.z };
  const p = x.player || (x.game && x.game.player);
  return p ? { x: p.x, y: p.y, z: p.z } : { x: 0, y: 0, z: 0 };
};
const who = (x, v) => ent(v) || x.player || (x.game && x.game.player);
const txt = (v, max = 400) => show(v).slice(0, max);

// What scripts can do: each (x, ...args), x being { game, mod, svc,
// player, log, script }. All through `svc` (the graph nodes' own: see
// mod/hooks.js) or plain reading.
export const API = {
  // Words and sights.
  say: (x, text, color) => x.svc.message(x, txt(text), typeof color === 'string' ? color : null),
  float: (x, text, color, at) => x.svc.float(x, posIn(x, at), txt(text, 60), typeof color === 'string' ? color : null),
  log: (x, text) => x.log?.(txt(text), 'info'),
  sound: (x, name, at) => x.svc.sound(x, String(name), at ? posIn(x, at) : null),
  music: (x, key, secs) => x.svc.music(x, null, key ? String(key) : null, num(secs) || 0),
  shake: (x, power) => x.svc.shake(x, Math.max(0, Math.min(1.4, num(power) || 0.5)), null),
  flash: (x, color, secs) => x.svc.flash(x, typeof color === 'string' ? color : '#ffffff', Math.max(0.05, Math.min(3, num(secs) || 0.3))),
  vfx: (x, id, at) => x.svc.vfx(x, String(id), posIn(x, at), {}),
  particles: (x, color, n, at) => x.svc.particles(x, posIn(x, at), { n: Math.max(1, Math.min(80, num(n) || 12)), color: typeof color === 'string' ? color : '#ffe070' }),
  // The one playing, and everyone.
  player: (x) => wrapEnt(x.player || x.game.player),
  players: (x) => x.game.everyone().map(wrapEnt),
  pos: (x, e) => posMap(posIn(x, e)),
  hp: (x, e) => who(x, e)?.hp ?? null,
  name: (x, e) => (ent(e) ? wrapEnt(ent(e)).name : x.svc.playerName(x)),
  heal: (x, a, b) => x.svc.heal(x, b === undefined ? who(x, null) : who(x, a), Math.max(0, Math.min(40, num(b === undefined ? a : b)))),
  damage: (x, a, b, element) => {
    const t = b === undefined ? who(x, null) : who(x, a);
    if (t) x.svc.damage(x, t, Math.max(0, Math.min(200, num(b === undefined ? a : b))), element ? String(element) : null);
  },
  teleport: (x, a, b, c) => {
    const t = c === undefined && !ent(a) ? who(x, null) : who(x, a);
    const at = c === undefined && !ent(a) ? { x: num(a), z: num(b) } : { x: num(b), z: num(c) };
    if (t) x.svc.teleport(x, t, { x: at.x, y: t.y, z: at.z });
  },
  // Things.
  give: (x, item, n) => x.svc.give(x, who(x, null), String(item), Math.max(1, Math.min(999, num(n) || 1))),
  take: (x, item, n) => !!x.svc.take(x, who(x, null), String(item), Math.max(1, Math.min(999, num(n) || 1))),
  has: (x, item) => (x.countItem ? x.countItem(who(x, null), String(item)) : 0),
  drop: (x, item, n, at) => x.svc.drop(x, String(item), Math.max(1, Math.min(999, num(n) || 1)), posIn(x, at)),
  spawn: (x, creature, n, at) => (x.svc.spawn(x, String(creature), posIn(x, at), Math.max(1, Math.min(8, num(n) || 1))) || []).map(wrapEnt),
  // The land.
  setblock: (x, X, Y, Z, block) => x.svc.setBlock(x, { x: num(X), y: num(Y), z: num(Z) }, String(block)),
  getblock: (x, X, Y, Z) => x.svc.blockAt(x, { x: num(X), y: num(Y), z: num(Z) }),
  lightning: (x, at, dmg) => x.svc.lightning(x, posIn(x, at), Math.max(0, Math.min(40, num(dmg) || 6))),
  // Time and weather.
  hour: (x) => Math.floor((x.game.minute || 0) / 60),
  minute: (x) => Math.floor(x.game.minute || 0) % 60,
  day: (x) => x.game.day || 0,
  weather: (x) => (x.svc.weatherNow ? x.svc.weatherNow(x) : null),
  setweather: (x, kind, mins) => x.svc.weather(x, String(kind), Math.max(1, Math.min(1440, num(mins) || 120))),
  settime: (x, h) => x.svc.setTime(x, 'set', Math.max(0, Math.min(23.99, num(h)))),
  // The mod's own lasting values (kept with the world).
  setvar: (x, name, v) => x.svc.setVar(x, 'world', String(name), isList(v) || isMap(v) ? show(v) : v),
  getvar: (x, name) => x.svc.getVar(x, 'world', String(name)) ?? 0,
  event: (x, name, value) => x.sendEvent?.(String(name), value ?? null),
  // Later: one of the script's functions, in `secs` seconds.
  after: (x, secs, fnName, arg) => {
    const s = x.script;
    const g = x.game;
    if (!s || !s.prog.fns[String(fnName)]) throw new ScriptError(`there's no function "${fnName}" to call later`);
    x.later?.(Math.max(0, Math.min(3600, num(secs))), () => s.callFn({ ...x, steps: 0 }, String(fnName), [arg ?? null]), g);
  },
  // Other mods (round 79): who's on, what they keep, and a word to them.
  mods: (x) => (x.mods ? x.mods().map((m) => m.id) : []),
  modname: (x, id) => (x.mods ? x.mods().find((m) => m.id === String(id))?.name ?? null : null),
  modvar: (x, id, name) => (x.modVar ? x.modVar(String(id), String(name)) : null),
  tellmod: (x, id, name, value) => x.sendEvent?.(`${String(id)}:${String(name)}`, value ?? null),
  // Plain helpers.
  random: () => Math.random(),
  rand: (x, a, b) => {
    const lo = Math.floor(num(a));
    const hi = Math.floor(num(b));
    return lo + Math.floor(Math.random() * (Math.max(lo, hi) - lo + 1));
  },
  pick: (x, list) => (isList(list) && list.length ? list[Math.floor(Math.random() * list.length)] : null),
  floor: (x, v) => Math.floor(num(v)),
  ceil: (x, v) => Math.ceil(num(v)),
  round: (x, v) => Math.round(num(v)),
  abs: (x, v) => Math.abs(num(v)),
  min: (x, a, b) => Math.min(num(a), num(b)),
  max: (x, a, b) => Math.max(num(a), num(b)),
  sqrt: (x, v) => Math.sqrt(Math.max(0, num(v))),
  len: (x, v) => (isList(v) || typeof v === 'string' ? v.length : isMap(v) ? Object.keys(v).length : 0),
  str: (x, v) => show(v),
  num: (x, v) => num(v),
  range: (x, a, b) => {
    const lo = b === undefined ? 0 : Math.floor(num(a));
    const hi = Math.floor(num(b === undefined ? a : b));
    if (hi - lo > LIMITS.list) throw new ScriptError('that range is too long');
    return Array.from({ length: Math.max(0, hi - lo) }, (_, i) => lo + i);
  },
  push: (x, list, v) => {
    if (!isList(list)) throw new ScriptError('push wants a list');
    if (list.length >= LIMITS.list) throw new ScriptError('that list is too long');
    list.push(v);
    return list;
  },
  keys: (x, m) => (isMap(m) ? Object.keys(m) : []),
  contains: (x, a, b) => (isList(a) ? a.some((q) => same(q, b)) : typeof a === 'string' ? a.includes(show(b)) : isMap(a) ? String(b) in a : false),
  join: (x, list, sep) => (isList(list) ? list.map(show).join(sep === undefined ? ', ' : show(sep)).slice(0, LIMITS.str) : ''),
  split: (x, s, sep) => show(s).split(sep === undefined ? ' ' : show(sep)).slice(0, LIMITS.list),
  upper: (x, s) => show(s).toUpperCase(),
  lower: (x, s) => show(s).toLowerCase(),
};

// What scripts can call, for the Workshop's list: [name, what it does].
export const API_HELP = [
  ['say(text, colour)', 'a line in the messages'], ['float(text, colour, at)', 'words over a spot'], ['log(text)', 'a line in the story debugger\'s log'],
  ['sound(name, at)', 'a sound (the game\'s or the mod\'s @id)'], ['music(song, secs)', 'music put on'], ['shake(power)', 'shake the screen'],
  ['flash(colour, secs)', 'flash the screen'], ['vfx(id, at)', 'one of the mod\'s effects'], ['particles(colour, n, at)', 'a burst of sparks'],
  ['player()', 'the one playing'], ['players()', 'everyone playing'], ['pos(who)', '{x, y, z}'], ['hp(who)', 'their health'], ['name(who)', 'their name'],
  ['heal(who, n)', 'hearts back'], ['damage(who, n, element)', 'a blow'], ['teleport(who, x, z)', 'somewhere else'],
  ['give(item, n)', 'into the pack'], ['take(item, n)', 'out of it (true if they had it)'], ['has(item)', 'how many'], ['drop(item, n, at)', 'on the ground'],
  ['spawn(creature, n, at)', 'creatures'], ['setblock(x, y, z, block)', 'a block set'], ['getblock(x, y, z)', 'what\'s there'], ['lightning(at)', 'a bolt'],
  ['hour()', 'the hour'], ['day()', 'the day'], ['weather()', 'the weather'], ['setweather(kind)', 'change it'], ['settime(hour)', 'turn the clock'],
  ['setvar(name, v)', 'kept with the world'], ['getvar(name)', 'read back'], ['event(name, value)', 'a custom event (graphs and scripts hear it)'],
  ['after(secs, fn, arg)', 'call one of your functions later'], ['mods()', 'the mods on in this world'], ['modname(id)', 'a mod\'s name'],
  ['modvar(id, name)', 'another mod\'s kept value'], ['tellmod(id, name, value)', 'an event to another mod ("id:name")'],
  ['random()', '0 to 1'], ['rand(a, b)', 'a whole number a to b'], ['pick(list)', 'one of them'], ['floor/ceil/round/abs/min/max/sqrt', 'numbers'],
  ['len(x)', 'how long'], ['str(x) / num(x)', 'as text / a number'], ['range(a, b)', '[a ... b-1]'], ['push(list, v)', 'add to a list'],
  ['keys(map)', 'its keys'], ['contains(a, b)', 'is b in a'], ['join(list, sep) / split(text, sep)', 'text and lists'], ['upper / lower', 'text'],
];
export { LIMITS as SCRIPT_LIMITS };
