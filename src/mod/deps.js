// (Round 79) Mods together: what each needs, what it can't be on with,
// and where two of them change the same thing.
//
// A mod can say it needs others (`requires`: [{ id, version }], that one
// at that version or newer) and that it can't go with some (`conflicts`:
// [id]). Put on together, they're put in the needed-first order; and
// whatever's wrong is said (in the mod manager, the world's mod picker, and
// as the world's mods go in):
//   - one needed and not on (or too old),
//   - two that said they can't go together, both on,
//   - two changing the same thing: the same world rule, the same item's,
//     block's or creature's numbers, the same story of the game's, the
//     same biome of the game's, a command of the same name. (The last
//     one's change is what you get; the warning says which.)

// Version strings compared ("1.10.0" after "1.9.2").
export function cmpVer(a, b) {
  const pa = String(a || '0').split(/[.-]/).map((q) => parseInt(q, 10) || 0);
  const pb = String(b || '0').split(/[.-]/).map((q) => parseInt(q, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

const label = (m) => `${m.name} (${m.id})`;

// What's wrong with `mods` being on together: [{ level: 'error'|'warn',
// text, mods: [ids] }]. `known`: every mod there is (to name one that's
// needed but not on).
export function checkMods(mods, known = []) {
  const out = [];
  const on = new Map(mods.map((m) => [m.id, m]));
  const name = (id) => {
    const m = on.get(id) || known.find((q) => q.id === id);
    return m ? m.name : id;
  };
  for (const m of mods) {
    for (const r of m.requires || []) {
      const d = on.get(r.id);
      if (!d) out.push({ level: 'error', text: `${label(m)} needs ${name(r.id)}${r.version ? ` ${r.version}` : ''}, which isn't on.`, mods: [m.id, r.id] });
      else if (r.version && cmpVer(d.version, r.version) < 0) out.push({ level: 'warn', text: `${label(m)} needs ${d.name} ${r.version} or newer (this is ${d.version}).`, mods: [m.id, r.id] });
    }
    for (const c of m.conflicts || []) {
      if (on.has(c) && !out.some((q) => q.kind === 'conflict' && q.mods.includes(m.id) && q.mods.includes(c))) out.push({ level: 'error', kind: 'conflict', text: `${label(m)} can't be on with ${name(c)}: it says so itself.`, mods: [m.id, c] });
    }
  }
  // (A needed mod that needs it back: round and round.)
  const cyc = cycle(mods);
  if (cyc) out.push({ level: 'error', text: `These need each other, round in a circle: ${cyc.map(name).join(' -> ')}.`, mods: cyc });
  // Clashes: two changing the same thing.
  const seen = new Map();
  const touch = (m, what, k) => {
    if (!seen.has(k)) seen.set(k, { what, mods: [] });
    const e = seen.get(k);
    if (!e.mods.includes(m)) e.mods.push(m);
  };
  for (const m of mods) {
    const R = m.rules || {};
    for (const [k, v] of Object.entries(R)) if (typeof v === 'number') touch(m, `the "${k}" rule`, `rule:${k}`);
    for (const kind of ['items', 'blocks', 'creatures']) for (const key of Object.keys(R[kind] || {})) if (key[0] !== '@') touch(m, `the ${kind.slice(0, -1)} "${key}"`, `${kind}:${key}`);
    for (const p of Object.values(m.patches || {})) if (p && p.motif) touch(m, `the story "${p.motif}"`, `story:${p.motif}`);
    for (const b of Object.values(m.biomes || {})) if (b && b.change) touch(m, `the biome "${b.change}"`, `biome:${b.change}`);
    for (const c of commandsOf(m)) touch(m, `the command "${c}"`, `cmd:${c}`);
  }
  for (const e of seen.values()) {
    if (e.mods.length < 2) continue;
    const last = e.mods[e.mods.length - 1];
    out.push({ level: 'warn', kind: 'clash', text: `${e.mods.map((m) => m.name).join(' and ')} both change ${e.what}: ${last.name}'s (on last) is what you'll get.`, mods: e.mods.map((m) => m.id) });
  }
  return out;
}

// The commands a mod's scripts and graphs add (read from their text, not
// run).
function commandsOf(m) {
  const out = new Set();
  for (const s of Object.values(m.scripts || {})) for (const q of String(s.code || '').matchAll(/^\s*on\s+command\s+"([^"]+)"/gm)) out.add(q[1].toLowerCase());
  for (const e of Object.values(m.entities || {})) for (const n of (e.graph && e.graph.nodes) || []) if (n.type === 'ev.command') out.add(String((n.v && n.v.name) || 'mycommand').toLowerCase());
  return [...out];
}

function cycle(mods) {
  const on = new Map(mods.map((m) => [m.id, m]));
  const state = new Map();
  const path = [];
  const visit = (id) => {
    if (state.get(id) === 1) return path.slice(path.indexOf(id)).concat(id);
    if (state.get(id) === 2) return null;
    state.set(id, 1);
    path.push(id);
    for (const r of on.get(id)?.requires || []) {
      if (!on.has(r.id)) continue;
      const c = visit(r.id);
      if (c) return c;
    }
    path.pop();
    state.set(id, 2);
    return null;
  };
  for (const m of mods) {
    const c = visit(m.id);
    if (c) return c;
  }
  return null;
}

// `mods` in the order they go in: each after those it needs (otherwise as
// given).
export function orderMods(mods) {
  const on = new Map(mods.map((m) => [m.id, m]));
  const out = [];
  const done = new Set();
  const doing = new Set();
  const add = (m) => {
    if (done.has(m.id) || doing.has(m.id)) return;
    doing.add(m.id);
    for (const r of m.requires || []) if (on.has(r.id)) add(on.get(r.id));
    doing.delete(m.id);
    done.add(m.id);
    out.push(m);
  };
  for (const m of mods) add(m);
  return out;
}
