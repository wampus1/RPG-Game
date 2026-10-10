// (Round 79) Mods' scripts, commands, other mods and their steps, at work
// in the game:
//   - Each mod's scripts (see script.js) read when its world's mods go in,
//     started with the world (their top lines, then `on load`), and from
//     then on told what happens: each second (`on tick`), each hour and
//     day, a custom event, a creature killed, a block broken.
//   - Commands: a mod's own console commands, from a script's `on command
//     "name"` or a graph's On command node. Typed like the game's own;
//     listed in "help".
//   - Other mods: a script (or a graph: see nodes.js, Mods) can see which
//     mods are on, read what another keeps, and send it an event ("id:name").
//   - Versioned steps: a mod's `on migrate "1.2.0"` handlers run once, in
//     order, when a world last played with an older version of the mod is
//     opened with a newer one (see runMigrations).
//   - Trace: what fired and why, kept for the story debugger (see
//     ui/storydebug.js and MOD_TRACE).
import { MODS } from './state.js';
import { Script, show, ScriptError, toMap } from './script.js';
import { SVC } from './nodes.js';
import { NODES, RUN_HOOK } from './graph.js';
import { countItem } from '../game/inventory.js';
import { cmpVer } from './deps.js';

export { cmpVer };

// What fired, and why (graphs' nodes while the debugger is open; scripts'
// handlers, errors and log lines always).
export const MOD_TRACE = { on: false, log: [], counts: new Map(), n: 0 };
export function modTrace(kind, mod, what, why = '', level = 'info') {
  MOD_TRACE.log.push({ n: ++MOD_TRACE.n, at: Date.now(), kind, mod: mod || null, what, why, level });
  if (MOD_TRACE.log.length > 400) MOD_TRACE.log.splice(0, MOD_TRACE.log.length - 400);
}
// (A graph's node run: counted, and logged while someone's watching.)
RUN_HOOK.node = (x, n) => {
  if (!MOD_TRACE.on) return;
  const mod = x.mod ? x.mod.id : null;
  const ent = x.rec ? x.rec.id : null;
  const k = `${mod}:${ent}:${n.id}`;
  MOD_TRACE.counts.set(k, (MOD_TRACE.counts.get(k) || 0) + 1);
  modTrace('node', mod, `${ent || 'graph'} / ${NODES[n.type]?.title || n.type}`, x.cause || '');
};

// ------------------------------------------------------------ in and out
function install(M, report) {
  MODS.scripts = [];
  MODS.commands = new Map();
  for (const m of M.active) {
    for (const [id, s] of Object.entries(m.scripts || {})) {
      let script;
      try {
        script = new Script(s.code || '', { name: `${m.name} / ${s.name || id}`, mod: m.id, id });
      } catch (e) {
        report.push({ level: 'error', text: `Script "${s.name || id}" (${m.name}): ${e.message}` });
        continue;
      }
      const rec = { mod: m, id, name: s.name || id, script };
      MODS.scripts.push(rec);
      for (const h of script.handlers('command')) addCommand(h.name, { mod: m, kind: 'script', rec, help: s.help || null });
    }
    // (A graph's On command node.)
    for (const [key, r] of MODS.ents) {
      if (r.mod !== m) continue;
      for (const n of r.prog.starts) if (n.type === 'ev.command') addCommand(String((n.p && n.p.name) || (n.v && n.v.name) || 'mycommand'), { mod: m, kind: 'graph', rec: r, node: n, help: (n.p && n.p.help) || null, key });
    }
  }
}
function addCommand(name, c) {
  const k = String(name || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  if (!k) return;
  if (!MODS.commands.has(k)) MODS.commands.set(k, []);
  MODS.commands.get(k).push(c);
}
function uninstall() {
  MODS.scripts = [];
  MODS.commands = new Map();
}
MODS.hooks.install.push(install);
MODS.hooks.uninstall.push(uninstall);
MODS.scripts = [];
MODS.commands = new Map();

// ------------------------------------------------------------ running
// What a script runs in: the game through SVC, and a little more.
function hostX(game, rec, o = {}) {
  const player = o.player || game.player;
  const x = {
    game, mod: rec.mod, rec: null, self: null, target: null, player, pos: player ? { x: player.x, y: player.y, z: player.z } : null, vars: {}, locals: {}, steps: 0,
    svc: SVC, cause: o.cause || null,
    log: (text, level = 'info') => modTrace(level === 'error' ? 'error' : 'log', rec.mod.id, text, rec.name, level),
    later: (sec, fn) => (game.modTimers ||= []).push({ t: sec, fn }),
    sendEvent: (name, value) => MODS.sendEvent?.(game, name, value, { from: o.from || null, target: player, pos: player }),
    mods: () => MODS.active,
    modVar: (id, name) => (MODS.state ? MODS.state(game).vars[`${id}:${name}`] ?? null : null),
    countItem: (e, item) => {
      const k = item && item[0] === '@' ? `m:${rec.mod.id}:${item.slice(1)}` : item;
      return e && e.inv ? countItem(e.inv, k) : 0;
    },
  };
  return x;
}

function fireScripts(game, kind, name = null, args = [], o = {}) {
  let n = 0;
  for (const rec of MODS.scripts || []) {
    if (o.only && rec.mod.id !== o.only) continue;
    const s = rec.script;
    if (!s.handlers(kind, name).length) continue;
    if (!s.started) s.start(hostX(game, rec, o));
    modTrace('script', rec.mod.id, `${rec.name}: on ${kind}${name ? ` "${name}"` : ''}`, o.cause || '');
    n += s.fire(hostX(game, rec, o), kind, name, args);
  }
  return n;
}

// Each frame (from hooks.modTick): scripts started, then told the time.
export function scriptsTick(game, dt) {
  // (A world opened with newer mods than it was last played with: their
  // steps since, first of all.)
  if (game.modStepsFrom) {
    const from = game.modStepsFrom;
    game.modStepsFrom = null;
    const ran = runMigrations(game, from);
    if (ran.length) game.ui?.msg?.(`Mods brought up to date in this world: ${ran.join(', ')}.`, '#a0e0ff');
  }
  const list = MODS.scripts;
  if (!list || !list.length) return;
  for (const rec of list) {
    if (!rec.script.started) {
      rec.script.start(hostX(game, rec, { cause: 'the world began' }));
      if (rec.script.handlers('load').length) {
        modTrace('script', rec.mod.id, `${rec.name}: on load`, 'the world began');
        rec.script.fire(hostX(game, rec, { cause: 'load' }), 'load');
      }
    }
  }
  game.modScriptT = (game.modScriptT || 0) - dt;
  if (game.modScriptT <= 0) {
    game.modScriptT += 1;
    if (game.modScriptT < 0) game.modScriptT = 1;
    for (const rec of list) if (rec.script.handlers('tick').length) rec.script.fire(hostX(game, rec, { cause: 'tick' }), 'tick');
  }
  const hour = Math.floor(((game.day || 0) * 1440 + (game.minute || 0)) / 60);
  if (game.modScriptHour === undefined) game.modScriptHour = hour;
  if (hour !== game.modScriptHour) {
    const newDay = Math.floor(hour / 24) !== Math.floor(game.modScriptHour / 24);
    game.modScriptHour = hour;
    fireScripts(game, 'hour', null, [hour % 24], { cause: `hour ${hour % 24}` });
    if (newDay) fireScripts(game, 'day', null, [game.day], { cause: `day ${game.day}` });
  }
}

// A custom event heard (see hooks.sendEvent): each script's `on event`.
// ("id:name" is for that mod only, its `on event "name"`.)
export function scriptsEvent(game, name, value, o = {}) {
  const m = /^([a-z][a-z0-9]{3,31}):(.+)$/.exec(String(name));
  if (m && MODS.byId.has(m[1])) return fireScripts(game, 'event', m[2], [value ?? null], { only: m[1], cause: `event ${name}` });
  return fireScripts(game, 'event', String(name), [value ?? null], { cause: `event ${name}`, player: o.player || null });
}

export function scriptsKill(game, victim) {
  if (!MODS.scripts || !MODS.scripts.length) return;
  fireScripts(game, 'kill', null, [victim && victim.species ? victim.species : victim ? victim.kind : null], { cause: 'a kill' });
}

export function scriptsBreak(game, x, y, z, blockName) {
  if (!MODS.scripts || !MODS.scripts.length) return;
  fireScripts(game, 'break', null, [blockName, toMap({ x, y, z })], { cause: `a ${blockName} broken` });
}

// ------------------------------------------------------------ commands
// A mod's command typed (`words` after it): lines to show, or null if no
// mod has one by that name.
export function runModCommand(game, name, words = []) {
  const list = MODS.commands && MODS.commands.get(String(name).toLowerCase());
  if (!list || !list.length) return null;
  const out = [];
  for (const c of list) {
    if (c.kind === 'script') {
      const before = MOD_TRACE.log.length;
      c.rec.script.started || c.rec.script.start(hostX(game, c.rec, { cause: 'command' }));
      modTrace('command', c.mod.id, `/${name}`, words.join(' '));
      c.rec.script.fire(hostX(game, c.rec, { cause: `command ${name}` }), 'command', name, [words.slice()]);
      const errs = MOD_TRACE.log.slice(before).filter((l) => l.level === 'error');
      for (const e of errs) out.push(`(${c.mod.name}) ${e.what}`);
    } else {
      const r = c.rec;
      const x = r.runner.ctx({ game, mod: r.mod, rec: r, self: null, target: game.player, player: game.player, pos: { x: game.player.x, y: game.player.y, z: game.player.z }, payload: words.join(' '), cause: `command ${name}` });
      modTrace('command', c.mod.id, `/${name}`, words.join(' '));
      r.runner.fire(x, c.node.id, 'fire');
    }
  }
  return out.length ? out : [];
}

// The mods' commands, for "help": [name, about].
export function modCommandList() {
  const out = [];
  for (const [k, list] of MODS.commands || []) out.push([k, list.map((c) => c.help || `from ${c.mod.name}`).join('; ')]);
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

// ------------------------------------------------------------ what graphs reach other mods by
Object.assign(SVC, {
  modList: () => MODS.active.map((m) => m.id),
  modInfo: (x, id) => {
    const m = MODS.byId.get(id);
    return m ? { name: m.name, version: m.version, author: m.author } : null;
  },
  modVar: (x, id, name) => (MODS.state ? MODS.state(x.game).vars[`${id}:${name}`] ?? null : null),
  setModVar: (x, id, name, v) => {
    if (!MODS.byId.has(id) || !MODS.state) return;
    MODS.state(x.game).vars[`${id}:${name}`] = v;
    modTrace('var', x.mod ? x.mod.id : null, `set ${id}:${name}`, `from ${x.mod ? x.mod.name : 'a mod'}`);
  },
  command: (x, name, args) => runModCommand(x.game, name, String(args || '').split(/\s+/).filter(Boolean)),
});

// ------------------------------------------------------------ versioned steps
// A world opened: each mod that was older when the world was last played
// has its steps from then to now run, in order, once. `saved`: the world's
// own list of its mods ({ id, version }, from the save). Returns the steps
// run, as ["mod 1.2.0", ...].
export function runMigrations(game, saved = []) {
  const ran = [];
  const st = MODS.state ? MODS.state(game) : null;
  if (!st) return ran;
  st.migrated ||= {};
  for (const m of MODS.active) {
    const was = (saved.find((q) => q.id === m.id) || {}).version;
    const from = st.migrated[m.id] || was;
    if (!from || cmpVer(from, m.version) >= 0) {
      st.migrated[m.id] = m.version;
      continue;
    }
    const steps = [];
    for (const rec of (MODS.scripts || []).filter((r) => r.mod === m)) {
      for (const h of rec.script.handlers('migrate')) if (cmpVer(h.name, from) > 0 && cmpVer(h.name, m.version) <= 0) steps.push({ rec, v: h.name });
    }
    steps.sort((a, b) => cmpVer(a.v, b.v));
    for (const s of steps) {
      const x = hostX(game, s.rec, { cause: `migrate ${from} -> ${s.v}` });
      s.rec.script.start(x);
      s.rec.script.fire(x, 'migrate', s.v, [from]);
      modTrace('migrate', m.id, `${m.name}: step ${s.v}`, `the world was last played with ${from}`);
      ran.push(`${m.name} ${s.v}`);
    }
    st.migrated[m.id] = m.version;
  }
  return ran;
}

// A script tried out from the Workshop (or a test): its lines run as if
// at the start of a world; returns what it said and what went wrong.
export function tryScript(game, mod, code) {
  const said = [];
  let script;
  try {
    script = new Script(code, { name: 'try' });
  } catch (e) {
    return { ok: false, lines: [e.message] };
  }
  const rec = { mod, id: 'try', name: 'try', script };
  const x = hostX(game, rec, { cause: 'tried' });
  x.log = (t, level) => said.push(level === 'error' ? `! ${t}` : t);
  script.start(x);
  script.fire(x, 'load');
  return { ok: !said.some((l) => l.startsWith('!')), lines: said };
}

export { show, ScriptError };

// (The console reaches these through MODS: see game/commands.js.)
MODS.runCommand = runModCommand;
MODS.commandList = modCommandList;
