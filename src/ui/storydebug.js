// (Round 79) The story debugger (F4, or "debugger" in the console): what
// the stories and the world's mods are doing, and why.
//   Stories   every story under way, as a tree: open one for its nodes
//             (where it is now, where it's been), and beside it what it
//             holds (its people, its tasks, its values, its last lines).
//   Mods      each mod on in the world: its graphs (each node, and how
//             often it's run since the debugger was opened), its scripts
//             (their handlers, runs, whether one's been switched off), its
//             commands.
//   Director  how the stories' director sees things (see
//             sim/saga/director.js): the mood, the weight of what's
//             happened, how many new stories may start today, the
//             openings owed, and the stories remembered.
// Under them, the log: which story or entity node fired, and why (what it
// heard, what set it off), newest at the foot; only the one picked's, or
// everything (F).
import { Window } from './window.js';
import { C } from './ascii.js';
import { MOTIFS } from '../sim/saga/core.js';
import { MODS } from '../mod/state.js';
import { MOD_TRACE } from '../mod/scripts.js';
import { NODES } from '../mod/graph.js';
import { DAY } from '../sim/econ.js';

const TABS = ['Stories', 'Mods', 'Director'];
const KIND_COL = { start: '#a0ffa0', node: '#c8d8ff', end: '#ffd080', event: '#a0c8c8', director: '#ffb0e0', peace: '#a0ffd0', branch: '#ffa080', lapse: '#ff9080', script: '#c0e0ff', command: '#ffe070', error: '#ff7060', log: '#e0e0e0', migrate: '#a0e0ff', var: '#d0c0ff' };

export class StoryDebugWindow extends Window {
  constructor(ui, game) {
    super(ui, 83, 34, { kind: 'storydebug' });
    this.game = game;
    this.tab = 'Stories';
    this.sel = 0;
    this.open = null;
    this.top = 0;
    this.logTop = null;
    this.onlySel = false;
    MOD_TRACE.on = true;
    MOD_TRACE.counts.clear();
  }

  onClose() {
    MOD_TRACE.on = false;
  }

  // What's in the tree on the left: [{ label, color, depth, key, pick }].
  tree() {
    const S = this.game.sim && this.game.sim.saga;
    const out = [];
    if (this.tab === 'Stories') {
      if (!S) return out;
      const live = S.live().sort((a, b) => b.nodeAt - a.nodeAt);
      for (const th of live) {
        const opened = this.open === `th${th.id}`;
        out.push({ label: `${opened ? '-' : '+'} ${th.title}`, color: Object.keys(th.touched).length ? C.hi : C.fg, depth: 0, key: `th${th.id}`, th });
        if (!opened) continue;
        const M = MOTIFS[th.m];
        const been = new Set(th.hist.map((h) => h.node));
        for (const k of Object.keys((M && M.nodes) || {})) out.push({ label: `${k === th.node ? '● ' : been.has(k) ? '· ' : '  '}${k}`, color: k === th.node ? '#a0ffa0' : been.has(k) ? C.fg : C.faint, depth: 1, key: `th${th.id}`, th });
      }
      if (!live.length) out.push({ label: '(no stories under way)', color: C.faint, depth: 0 });
    } else if (this.tab === 'Mods') {
      for (const m of MODS.active) {
        const opened = this.open === `m${m.id}`;
        out.push({ label: `${opened ? '-' : '+'} ${m.name} v${m.version}`, color: C.hi, depth: 0, key: `m${m.id}`, mod: m });
        if (!opened) continue;
        for (const r of MODS.ents.values()) if (r.mod === m) out.push({ label: `graph ${r.ent.name || r.id}`, color: C.fg, depth: 1, key: `m${m.id}`, mod: m, ent: r });
        for (const s of MODS.scripts || []) if (s.mod === m) out.push({ label: `script ${s.name}${s.script.off ? ' (OFF)' : ''}`, color: s.script.off ? '#ff8070' : '#c0e0ff', depth: 1, key: `m${m.id}`, mod: m, script: s });
        for (const [k, list] of MODS.commands || []) if (list.some((c) => c.mod === m)) out.push({ label: `command ${k}`, color: '#ffe070', depth: 1, key: `m${m.id}`, mod: m, cmd: k });
      }
      if (!MODS.active.length) out.push({ label: '(no mods in this world)', color: C.faint, depth: 0 });
    } else {
      out.push({ label: 'The director', color: C.hi, depth: 0, key: 'dir' });
      out.push({ label: 'Stories remembered', color: C.hi, depth: 0, key: 'mem' });
    }
    return out;
  }

  // Lines on the right for what's picked.
  details(row) {
    const S = this.game.sim && this.game.sim.saga;
    const L = [];
    const kv = (k, v, col = C.fg) => L.push([`${k}: ${v}`, col]);
    if (!row) return [['Pick something on the left.', C.faint]];
    if (row.th) {
      const th = row.th;
      const M = MOTIFS[th.m];
      kv('Story', `${th.title} (#${th.id})`, C.hi);
      kv('Kind', `${th.m}${M && M.family ? ` / ${M.family}` : ''} · ${th.tier}`);
      kv('Now', `${th.node} for ${Math.round((S.now - th.nodeAt) / 60)}h${th.done ? ` · over: ${th.outcome}` : ''}`);
      const cast = Object.entries(th.names || {}).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ');
      if (cast) kv('Cast', cast);
      const vars = Object.entries(th.vars || {}).filter(([, v]) => v === null || typeof v !== 'object').map(([k, v]) => `${k}=${v}`).join(', ');
      if (vars) kv('Values', vars);
      if (Object.keys(th.touched).length) kv('Touched by', Object.keys(th.touched).join(', '));
      for (const t of th.tasks.slice(-4)) L.push([`task "${t.title}" ${t.status}${t.claims.length ? ` · ${t.claims.map((c) => c.name).join(', ')}` : ''}${t.due ? ` · due in ${Math.max(0, Math.round((t.due - S.now) / 60))}h` : ''}`, t.status === 'open' ? '#c0e0ff' : C.faint]);
      for (const h of th.hist.slice(-5)) L.push([`- ${h.text}`, C.dim]);
    } else if (row.ent) {
      const r = row.ent;
      kv('Graph', `${r.ent.name || r.id} (${r.kind})`, C.hi);
      const nodes = [...r.prog.nodes.values()].map((n) => ({ n, c: MOD_TRACE.counts.get(`${r.mod.id}:${r.id}:${n.id}`) || 0 })).sort((a, b) => b.c - a.c);
      L.push(['Each node, and how often it\'s run since the debugger opened:', C.dim]);
      for (const { n, c } of nodes.slice(0, 14)) L.push([`${String(c).padStart(5)}  ${NODES[n.type]?.title || n.type}`, c ? C.fg : C.faint]);
    } else if (row.script) {
      const s = row.script;
      kv('Script', s.name, C.hi);
      kv('Runs', `${s.script.runs}${s.script.off ? ' · switched off (it kept running over)' : ''} · over ${s.script.overruns}`);
      kv('Functions', Object.keys(s.script.prog.fns).join(', ') || 'none');
      L.push(['Answers:', C.dim]);
      for (const h of s.script.prog.handlers) L.push([`  on ${h.kind}${h.name ? ` "${h.name}"` : ''}`, '#c0e0ff']);
    } else if (row.cmd) {
      kv('Command', row.cmd, C.hi);
      for (const c of MODS.commands.get(row.cmd) || []) L.push([`  from ${c.mod.name} (${c.kind})${c.help ? `: ${c.help}` : ''}`, C.fg]);
    } else if (row.mod) {
      const m = row.mod;
      kv('Mod', `${m.name} v${m.version} by ${m.author}`, C.hi);
      if ((m.requires || []).length) kv('Needs', m.requires.map((q) => `${q.id}${q.version ? ` ${q.version}` : ''}`).join(', '));
      if ((m.conflicts || []).length) kv('Can\'t go with', m.conflicts.join(', '));
      const vars = Object.entries((this.game.modState && this.game.modState.vars) || {}).filter(([k]) => k.startsWith(`${m.id}:`)).map(([k, v]) => `${k.slice(m.id.length + 1)}=${typeof v === 'object' ? '...' : v}`);
      if (vars.length) kv('Kept', vars.slice(0, 10).join(', '));
    } else if (row.key === 'dir' && S) {
      const D = S.director;
      kv('Mood', `${D.mood}${D.mood === 'quiet' ? ` till day ${D.moodUntil}` : ''}${D.wild ? ' · a wild day' : ''}`, C.hi);
      kv('Weight of late', D.heat.toFixed(2));
      kv('Quiet days', D.quiet);
      kv('New today', `${D.made} of up to ${D.budget}`);
      if (D.biggest) kv('Hardest lately', `${D.biggest.what} (day ${D.biggest.day})`);
      for (const o of D.owed) L.push([`opening owed: ${o.pid} after ${o.why} (day ${o.at})`, '#a0ffc0']);
      L.push([`Stories under way: ${S.live().length}`, C.fg]);
    } else if (row.key === 'mem' && S) {
      for (const m of (S.memories || []).slice(-14).reverse()) L.push([`day ${Math.floor(m.at / DAY)}: ${m.title} (${m.outcome}) · ${m.helped.length ? `helped by ${m.helped.join(', ')}` : 'not helped'}`, m.bad ? '#ffb080' : '#a0ffc0']);
      if (!(S.memories || []).length) L.push(['None yet: a story someone had a hand in, once over, is kept by its town.', C.faint]);
    }
    return L;
  }

  // The log lines: [{ text, color }], oldest first.
  logLines(row) {
    const S = this.game.sim && this.game.sim.saga;
    if (this.tab === 'Mods') {
      return MOD_TRACE.log.filter((l) => !this.onlySel || !row || !row.mod || l.mod === row.mod.id).map((l) => ({ text: `${l.kind.padEnd(7)} ${l.mod ? `[${l.mod}] ` : ''}${l.what}${l.why ? ` <- ${l.why}` : ''}`, color: KIND_COL[l.level === 'error' ? 'error' : l.kind] || C.fg }));
    }
    if (!S) return [];
    const kinds = this.tab === 'Director' ? new Set(['director', 'peace', 'branch', 'lapse', 'start']) : null;
    return S.traceLog.filter((l) => (!kinds || kinds.has(l.kind)) && (!this.onlySel || !row || !row.th || l.th === row.th.id)).map((l) => {
      const hh = Math.floor((l.at % DAY) / 60);
      const mm = Math.floor(l.at % 60);
      return { text: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${l.kind.padEnd(8)} ${l.text}`, color: KIND_COL[l.kind] || C.fg };
    });
  }

  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#0c0a14');
    g.box(0, 0, this.w, this.h, { bg: '#0c0a14', double: true, title: 'STORY & MOD DEBUGGER' });
    let x = 2;
    for (const t of TABS) {
      const on = t === this.tab;
      const w = t.length + 2;
      const hov = this.hovering(x, 1, w, 1);
      g.text(x, 1, ` ${t} `, on ? C.white : hov ? C.hi : C.dim, on ? '#3a2e4a' : hov ? '#221a2e' : undefined);
      this.hit(x, 1, w, 1, () => this.setTab(t));
      x += w + 1;
    }
    const ft = this.onlySel ? ' Log: picked only (F) ' : ' Log: everything (F) ';
    const fh = this.hovering(this.w - ft.length - 2, 1, ft.length, 1);
    g.text(this.w - ft.length - 2, 1, ft, fh ? C.white : C.dim, fh ? '#221a2e' : undefined);
    this.hit(this.w - ft.length - 2, 1, ft.length, 1, () => {
      this.onlySel = !this.onlySel;
      this.logTop = null;
    });
    // The tree.
    const rows = this.tree();
    const TH = 17;
    this.sel = Math.max(0, Math.min(rows.length - 1, this.sel));
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + TH) this.top = this.sel - TH + 1;
    for (let i = 0; i < TH; i++) {
      const r = rows[this.top + i];
      if (!r) break;
      const y = 3 + i;
      const cur = this.top + i === this.sel;
      const hov = this.hovering(1, y, 30, 1);
      g.text(1, y, `${'  '.repeat(r.depth)}${r.label}`.slice(0, 30).padEnd(30), cur ? C.white : r.color, cur ? '#3a2e4a' : hov ? '#1a1424' : undefined);
      this.hit(1, y, 30, 1, () => this.pick(this.top + i, r));
    }
    for (let y = 3; y < 3 + TH; y++) g.text(31, y, '│', '#3a3448');
    // The details.
    const row = rows[this.sel];
    const det = this.details(row);
    for (let i = 0; i < Math.min(TH, det.length); i++) g.text(33, 3 + i, det[i][0].slice(0, this.w - 35), det[i][1]);
    // The log.
    const ly = 4 + TH;
    g.text(1, ly - 1, '─'.repeat(this.w - 2), '#3a3448');
    g.text(3, ly - 1, ` LOG ${this.tab === 'Mods' ? '(mods: nodes, scripts, commands)' : this.tab === 'Director' ? '(the director, ways out, branches)' : '(stories: what fired, and why)'} `, C.dim);
    const lines = this.logLines(row);
    const LH = this.h - ly - 2;
    const maxTop = Math.max(0, lines.length - LH);
    const top = this.logTop === null ? maxTop : Math.max(0, Math.min(maxTop, this.logTop));
    for (let i = 0; i < LH; i++) {
      const l = lines[top + i];
      if (!l) break;
      g.text(2, ly + i, l.text.slice(0, this.w - 4), l.color);
    }
    if (!lines.length) g.text(2, ly, this.tab === 'Mods' ? '(nothing yet: mods\' nodes and scripts show here as they run)' : '(nothing yet)', C.faint);
    g.text(2, this.h - 1, ' [TAB] tab  [UP/DOWN] pick  [ENTER] open  [F] filter  [C] clear  [ESC] close ', C.faint);
    this.logMaxTop = maxTop;
    this.logTopNow = top;
    this.logY = ly;
  }

  setTab(t) {
    this.tab = t;
    this.sel = 0;
    this.top = 0;
    this.open = null;
    this.logTop = null;
  }

  pick(i, r) {
    if (this.sel === i && r && r.depth === 0 && r.key) this.open = this.open === r.key ? null : r.key;
    this.sel = i;
    this.logTop = null;
  }

  onKey(k) {
    const rows = this.tree();
    if (k.code === 'Escape' || k.code === 'F4') this.close();
    else if (k.code === 'Tab') this.setTab(TABS[(TABS.indexOf(this.tab) + 1) % TABS.length]);
    else if (k.code === 'ArrowDown') this.sel = Math.min(rows.length - 1, this.sel + 1);
    else if (k.code === 'ArrowUp') this.sel = Math.max(0, this.sel - 1);
    else if (k.code === 'Enter' || k.code === 'Space') {
      const r = rows[this.sel];
      if (r && r.key && r.depth === 0) this.open = this.open === r.key ? null : r.key;
    } else if (k.code === 'KeyF') {
      this.onlySel = !this.onlySel;
      this.logTop = null;
    } else if (k.code === 'KeyC') {
      if (this.tab === 'Mods') MOD_TRACE.log.length = 0;
      else if (this.game.sim && this.game.sim.saga) this.game.sim.saga.traceLog.length = 0;
    } else return false;
    return true;
  }

  onWheel(d) {
    const m = this.ui.mouseCell;
    if (m && m.y - this.y >= (this.logY || 21)) {
      const t = (this.logTop === null ? this.logTopNow : this.logTop) + (d > 0 ? 3 : -3);
      this.logTop = t >= this.logMaxTop ? null : Math.max(0, t);
      return;
    }
    this.sel = Math.max(0, this.sel + (d > 0 ? 1 : -1));
  }
}
