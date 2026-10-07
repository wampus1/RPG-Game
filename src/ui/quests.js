// The quest log (round 52; key O): what you've taken on, what you've heard
// of, the stories you've had a hand in (each with what came of it, and what
// it came of), and your name in the world: how famous, how feared among the
// outlaws, the grudges held against you, the bands you're at peace with.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS } from '../world/items.js';
import { MOTIFS, pidOf, nameOf, lcFirst, directions, townMid } from '../sim/saga/core.js';
import { DAY } from '../sim/econ.js';

const TABS = [['tasks', ' TASKS '], ['heard', ' HEARD OF '], ['stories', ' STORIES '], ['name', ' YOUR NAME ']];
const BG = 'rgba(24,20,16,0.96)';

const OUTCOME = {
  saved: 'seen to', cleared: 'cleared', slain: 'slain', fallen: 'fallen', freed: 'freed', escaped: 'escaped', ransomed: 'ransomed', joined: 'joined the outlaws',
  cast_out: 'cast out', recovered: 'recovered', lost: 'lost', faded: 'faded away', over: 'over', fled: 'fled', cooled: 'cooled', avenged: 'avenged',
  honoured: 'settled with honour', cowed: 'backed down', humbled: 'humbled', taken: 'taken', collected: 'collected', lapsed: 'lapsed', jailed: 'jailed',
  justice: 'justice done', won: 'won', drawn: 'drawn', lit: 'lit', home: 'home again', moved: 'moved on', void: 'void', scattered: 'scattered', betrayed: 'betrayed', left: 'left', recovered_: 'recovered',
  merged: 'became part of another story', wed: 'wed', parted: 'parted', eloped: 'eloped', graduated: 'graduated', expelled: 'sent down', unmasked: 'unmasked', undone: 'undone', celebrated: 'celebrated', spoiled: 'spoiled',
  cut_short: 'cut short by a death', blood: 'ended in blood', reunited: 'reunited', found: 'found', kept: 'kept', born: 'born', adopted: 'adopted', opened: 'opened', closed: 'closed', crowned: 'crowned', raised: 'raised', sung: 'sung', freed_: 'set free',
};

export class QuestWindow extends Window {
  constructor(ui) {
    super(ui, 80, 33, { kind: 'quests' });
    this.closeOnOutside = true;
    this.tab = 'tasks';
    this.sel = 0;
    this.scroll = 0;
    this.dscroll = 0;
  }

  get S() {
    return this.ui.game && this.ui.game.sim.saga;
  }

  pid(game) {
    return pidOf(game.player);
  }

  // The entries on the current tab.
  entries(game) {
    const S = game.sim.saga;
    if (!S) return [];
    const pid = this.pid(game);
    const k = S.person(pid);
    if (this.tab === 'tasks') {
      const out = [];
      for (const th of S.threads) for (const t of th.tasks) {
        if (t.status === 'won' && t.ready === pid) out.push({ t, th, ready: true });
        else if (t.status === 'open' && S.claimedBy(t, pid)) out.push({ t, th });
      }
      return out.sort((a, b) => (b.ready ? 1 : 0) - (a.ready ? 1 : 0) || b.t.posted - a.t.posted);
    }
    if (this.tab === 'heard') {
      const out = [];
      for (const th of S.live()) for (const t of th.tasks) if (t.status === 'open' && k.known[t.id] && !S.claimedBy(t, pid) && S.visibleTo(t, pid)) out.push({ t, th });
      return out.sort((a, b) => b.t.posted - a.t.posted);
    }
    if (this.tab === 'stories') return S.storiesFor(pid).map((th) => ({ th }));
    return [];
  }

  draw(g, game) {
    const S = game.sim.saga;
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, title: 'QUESTS AND STORIES' });
    if (!S) return;
    // The tabs.
    let tx = 2;
    for (const [id, label] of TABS) {
      const n = id === 'name' ? '' : `${this.entriesCount(game, id)}`;
      const text = n ? `${label.trimEnd()} ${n} ` : label;
      const on = this.tab === id;
      const hov = this.hovering(tx, 1, text.length, 1);
      g.fill(tx, 1, text.length, 1, ' ', C.fg, on ? '#6a5030' : hov ? '#4a3a26' : '#2e2418');
      g.text(tx, 1, text, on ? C.hi : hov ? C.white : C.dim);
      this.hit(tx, 1, text.length, 1, () => this.setTab(id));
      tx += text.length + 1;
    }
    if (this.tab === 'name') this.drawName(g, game);
    else this.drawList(g, game);
    g.text(2, this.h - 2, this.tab === 'name' ? 'wheel scroll · 1-4 / TAB tabs · ESC close' : '↑↓ choose · wheel or ▲▼ scroll · M mark on map · G give up · 1-4/TAB tabs · ESC', C.faint, undefined, this.w - 4);
  }

  entriesCount(game, tab) {
    const was = this.tab;
    this.tab = tab;
    const n = this.entries(game).length;
    this.tab = was;
    return n;
  }

  setTab(t) {
    if (this.tab === t) return;
    this.tab = t;
    this.sel = 0;
    this.scroll = 0;
    this.dscroll = 0;
    this.ui.audio?.play('select');
  }

  drawList(g, game) {
    const list = this.entries(game);
    const LW = 30;
    const top = 3;
    const rows = this.h - top - 3;
    if (this.sel >= list.length) this.sel = Math.max(0, list.length - 1);
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + Math.floor(rows / 2)) this.scroll = this.sel - Math.floor(rows / 2) + 1;
    for (let y = top; y < this.h - 3; y++) g.put(LW + 1, y, '│', C.faint);
    if (!list.length) {
      const msg = { tasks: 'You haven\'t taken anything on. Folk with something to ask have a ! over their heads; ask around: "Heard of any trouble round here?"', heard: 'Nothing you\'ve heard of that needs doing. Ask in town, or read a notice board.', stories: 'No stories yet: the world has its own going on, and you\'ll find yourself in one soon enough.' }[this.tab];
      wrap(msg, LW - 2).forEach((l, i) => g.text(2, top + i, l, C.dim));
      return;
    }
    list.slice(this.scroll, this.scroll + Math.floor(rows / 2)).forEach((e, i) => {
      const k = this.scroll + i;
      const y = top + i * 2;
      const cur = k === this.sel;
      const hov = this.hovering(1, y, LW, 2);
      g.fill(1, y, LW, 2, ' ', C.fg, cur ? C.bgSel : hov ? 'rgba(60,50,30,0.8)' : undefined);
      const title = e.t ? e.t.title : e.th.title;
      const col = e.ready ? C.green : e.th && e.th.done ? C.dim : C.fg;
      const lines = wrap(title, LW - 3);
      g.text(2, y, `${e.ready ? '?' : e.t ? '•' : e.th.done ? '·' : '◆'} ${lines[0]}`, cur ? C.white : col, undefined, LW - 1);
      const sub = e.ready ? `Done: go back to ${e.t.giverName || 'them'}` : e.t ? (lines[1] || this.subOf(e, game)) : `${e.th.done ? OUTCOME[e.th.outcome] || e.th.outcome : 'going on'} · ${MOTIFS[e.th.m]?.family || ''}`;
      g.text(4, y + 1, sub, cur ? C.hi : C.faint, undefined, LW - 4);
      this.hit(1, y, LW, 2, () => {
        this.sel = k;
        this.dscroll = 0;
      });
    });
    const e = list[this.sel];
    this.listW = LW;
    if (!e) return;
    // (Its words, with a bar to scroll them by; under them, what can be
    // done about it: round 56.)
    this.drawDetail(g, game, e, LW + 3, top, this.w - LW - 7, rows - 2);
    this.drawActions(g, game, e, LW + 3, this.h - 4);
  }

  // [M] Mark on map · [G] Give up, under what's chosen (greyed when they
  // can't be done).
  drawActions(g, game, e, x, y) {
    const btn = (bx, label, on, fn, col) => {
      const w = label.length + 2;
      const hov = on && this.hovering(bx, y, w, 1);
      g.fill(bx, y, w, 1, ' ', C.fg, hov ? '#6a5030' : on ? '#3a2e1e' : '#221a12');
      g.text(bx + 1, y, label, !on ? C.faint : hov ? C.white : col);
      if (on) this.hit(bx, y, w, 1, fn);
      return bx + w + 2;
    };
    let bx = btn(x, '[M] Mark on map', !!this.markAt(e, game), () => this.mark(e, game), C.cyan);
    const sure = this.confirmDrop === this.dropKey(e);
    bx = btn(bx, sure ? '[G] Give it up? Again to be sure' : '[G] Give up', this.droppable(e, game).length > 0, () => this.giveUp(e, game), sure ? C.orange : C.fg);
    void bx;
  }

  // Where on the map a task (or a story you're in) is.
  markAt(e, game) {
    if (e.t) return e.t.at || null;
    const S = game.sim.saga;
    const pid = this.pid(game);
    const tasks = e.th.tasks.filter((t) => t.status === 'open' && t.at);
    const t = tasks.find((q) => S.claimedBy(q, pid)) || tasks[0];
    if (t) return t.at;
    if (e.th.done) return null;
    return S.anchors(e.th)[0] || null;
  }

  mark(e, game) {
    const at = this.markAt(e, game);
    if (!at) {
      game.ui.msg('Nowhere in particular to mark for that.', C.dim);
      return;
    }
    const label = e.t ? e.t.pinLabel || e.t.title : e.th.title;
    game.world.ow.pin(at.x, at.z, label, (e.t && e.t.glyph) || '!');
    game.ui.msg('Marked on your map.', C.cyan);
    this.ui.audio?.play('select');
  }

  // The tasks of yours giving up would let go of.
  droppable(e, game) {
    const S = game.sim.saga;
    const pid = this.pid(game);
    const tasks = e.t ? [e.t] : e.th.tasks;
    return tasks.filter((t) => t.status === 'open' && S.claimedBy(t, pid));
  }

  dropKey(e) {
    return e.t ? `t${e.t.id}` : `th${e.th.id}`;
  }

  // Asked once more first (a stray click shouldn't cost you a quest).
  giveUp(e, game) {
    const tasks = this.droppable(e, game);
    if (!tasks.length) return;
    const key = this.dropKey(e);
    if (this.confirmDrop !== key) {
      this.confirmDrop = key;
      return;
    }
    this.confirmDrop = null;
    const S = game.sim.saga;
    for (const t of tasks) S.drop(t, { t: 'pl', pid: this.pid(game) });
    game.ui.msg(`You gave up on it: ${lcFirst(e.t ? e.t.title : e.th.title)}.`, C.dim);
  }

  subOf(e, game) {
    const t = e.t;
    if (t.kind === 'slay') return `${Math.min(t.count, t.need)}/${t.need}`;
    if (t.due) {
      const d = Math.ceil((t.due - game.sim.abs) / 60);
      return d > 48 ? `${Math.ceil(d / 24)} days left` : `${Math.max(0, d)} hours left`;
    }
    return t.giverName ? `for ${t.giverName}` : '';
  }

  drawDetail(g, game, e, x, y0, w, rows) {
    const S = game.sim.saga;
    const pid = this.pid(game);
    const out = [];
    const put = (text, col = C.fg) => {
      for (const l of wrap(text, w)) out.push([l, col]);
    };
    const gap = () => out.push(['', C.fg]);
    if (e.t) {
      const t = e.t;
      put(t.title, C.hi);
      put(e.ready ? `Done. Go back to ${t.giverName || 'whoever asked'} for your reward.` : S.claimedBy(t, pid) ? 'You\'ve taken this on.' : 'You\'ve heard of this.', e.ready ? C.green : C.cyan);
      // (Round 70: whose it is; not "asked by", which they mightn't have.)
      if (t.giverName && !e.ready) put(`For ${t.giverName}${t.giver && t.giver.t === 'rec' ? ` of ${game.world.ow.settlements[t.giver.sid]?.name || 'a town'}` : ''}.`, C.dim);
      if (t.at) {
        const near = game.world.ow.settlementsNear(t.at.x, t.at.z)[0];
        put(`Where: ${near ? directions(near, t.at.x, t.at.z) : 'out in the wilds'}.`, C.dim);
      }
      if (t.kind === 'slay') put(`Progress: ${Math.min(t.count, t.need)} of ${t.need}.`, C.dim);
      if (t.item) put(`Bring: ${ITEMS[t.item] ? ITEMS[t.item].name : t.item}.`, C.dim);
      if (t.due) put(`Time left: ${this.subOf(e, game)}.`, C.dim);
      const rw = t.reward || {};
      const bits = [rw.coins ? `¤${rw.coins}` : null, ...(rw.items || []).map(([k, n]) => `${n > 1 ? `${n} ` : ''}${ITEMS[k] ? ITEMS[k].name : k}`), rw.renown !== undefined && rw.renown !== null ? 'renown' : null, rw.fame ? 'fame' : null].filter(Boolean);
      if (bits.length) put(`Reward: ${bits.join(', ')}.`, C.green);
      const others = t.claims.filter((c) => !(c.who.t === 'pl' && c.who.pid === pid)).map((c) => c.name);
      if (others.length) put(`Also on it: ${others.slice(0, 4).join(', ')}${others.length > 4 ? '...' : ''}.`, C.purple);
      if (t.pitch) {
        gap();
        put(`"${t.pitch}"`, '#d8c8a0');
      }
      gap();
      put(`Part of: ${e.th.title}`, C.dim);
      for (const h of e.th.hist.filter((q) => !q.hidden || e.th.done).slice(-4)) put(`· ${h.text}`, '#b8a888');
    } else {
      const th = e.th;
      put(th.title, C.hi);
      put(th.done ? `Over: ${OUTCOME[th.outcome] || th.outcome}.` : 'Still going on.', th.done ? C.dim : C.cyan);
      // (Round 54: what it once was, what it's become part of, what's run
      // into it, and what went its own way from it.)
      if (th.was && th.was.length) put(`Once: ${th.was.join('; ')}.`, C.dim);
      const into = th.mergedInto !== undefined && th.mergedInto !== null ? S.thread(th.mergedInto) : null;
      if (into) put(`Became part of: ${into.title}.`, C.purple);
      const joined = [...(th.joined || []), ...(th.also || [])].map((i) => S.thread(i)).filter(Boolean);
      if (joined.length) put(`Ran into it, and became one with it: ${joined.map((q) => q.title).join('; ')}.`, C.purple);
      if (th.split !== undefined && th.split !== null && S.thread(th.split)) put(`Went its own way from: ${S.thread(th.split).title}.`, C.purple);
      // (What the story itself has to tell you: what you've found out.)
      const M = MOTIFS[th.m];
      if (M && M.journal) {
        let extra = [];
        try {
          extra = M.journal(th, pid, S) || [];
        } catch {
          extra = [];
        }
        if (extra.length) {
          gap();
          for (const [text, col] of extra) put(text, col || C.fg);
        }
      }
      // The chain it's part of.
      const root = S.rootOf(th);
      if (root !== th || th.kids.length) {
        gap();
        put('How it came about, and what came of it:', C.dim);
        const walk = (n, depth) => {
          if (!n || depth > 5 || out.length > 60) return;
          const me = n === th;
          put(`${'  '.repeat(depth)}${me ? '►' : n.done ? '·' : '◆'} ${n.title}${n.done ? ` (${OUTCOME[n.outcome] || n.outcome})` : ''}`, me ? C.white : n.done ? C.dim : C.fg);
          for (const kid of n.kids) walk(S.thread(kid), depth + 1);
        };
        walk(root, 0);
      }
      gap();
      for (const h of th.hist.filter((q) => !q.hidden || th.done)) put(`Day ${Math.max(1, Math.floor(h.at / DAY))}: ${h.text}`, h.hidden ? C.purple : '#d0c0a0');
    }
    const maxScroll = Math.max(0, out.length - rows);
    this.dscroll = Math.max(0, Math.min(this.dscroll, maxScroll));
    out.slice(this.dscroll, this.dscroll + rows).forEach(([l, col], i) => g.text(x, y0 + i, l, col, undefined, w));
    this.scrollbar(g, x + w + 1, y0, rows, out.length);
  }

  // A bar down the right of what's being read, when there's more of it than
  // fits: ▲ and ▼ to click at its ends, the thumb where you are in it.
  scrollbar(g, x, y0, H, n) {
    this.maxScroll = Math.max(0, n - H);
    if (n <= H) return;
    const top = n - H;
    const th = Math.max(2, Math.round(((H - 2) * H) / n));
    const ty = y0 + 1 + Math.round(((H - 2 - th) * this.dscroll) / top);
    for (let y = y0 + 1; y < y0 + H - 1; y++) g.text(x, y, y >= ty && y < ty + th ? '█' : '│', y >= ty && y < ty + th ? C.dim : C.faint);
    g.text(x, y0, '▲', this.dscroll > 0 ? C.hi : C.faint);
    g.text(x, y0 + H - 1, '▼', this.dscroll < top ? C.hi : C.faint);
    this.hit(x, y0, 1, 1, () => this.scrollBy(-3));
    this.hit(x, y0 + H - 1, 1, 1, () => this.scrollBy(3));
    this.hit(x, y0 + 1, 1, H - 2, (ck, game, cx, cy) => this.scrollBy(cy === undefined ? 3 : cy < ty ? -H + 2 : cy >= ty + th ? H - 2 : 0));
  }

  scrollBy(d) {
    this.dscroll = Math.max(0, Math.min(this.maxScroll ?? Infinity, this.dscroll + d));
  }

  drawName(g, game) {
    const S = game.sim.saga;
    const pid = this.pid(game);
    const k = S.person(pid);
    const out = [];
    const put = (text, col = C.fg) => {
      for (const l of wrap(text, this.w - 6)) out.push([l, col]);
    };
    const head = (t) => {
      out.push(['', C.fg]);
      out.push([t, C.hi]);
    };
    head('FAME');
    const f = k.fame;
    put(f >= 40 ? 'Your name is known in every tavern on the islands.' : f >= 20 ? 'Folk in towns you\'ve never seen have heard of you.' : f >= 8 ? 'Your name is getting about.' : f >= 2 ? 'A few people know your name.' : 'Nobody knows your name yet.', C.fg);
    if (k.titles.length) put(`Called: ${[...new Set(k.titles)].slice(-5).join('; ')}.`, C.purple);
    head('AMONG THE OUTLAWS');
    put(`To the outlaws of the hills, you're ${S.underWord(pid)}.`, k.under >= 10 ? C.orange : C.fg);
    if (k.joined !== null && k.joined !== undefined) {
      const b = S.sim.bandits.get(k.joined);
      put(`You ride with ${b ? b.name : 'a band'}.`, C.purple);
    }
    const grudges = S.live().filter((th) => th.m === 'grudge' && th.cast.target.t === 'pl' && th.cast.target.pid === pid);
    for (const th of grudges) put(`${nameOf(S, th.cast.band)[0].toUpperCase()}${nameOf(S, th.cast.band).slice(1)} want you dead${(th.vars.heat || 0) >= 8 ? ', badly' : ''}.`, C.red);
    for (const [band, until] of Object.entries(k.truce || {})) {
      if (until <= S.now) continue;
      const b = S.sim.bandits.get(+band);
      put(`A truce with ${b ? b.name : 'a band'}: ${Math.ceil((until - S.now) / DAY)} days left.`, C.green);
    }
    const priced = S.live().some((th) => (th.m === 'contract' || th.m === 'bounty') && th.cast.target.t === 'pl' && th.cast.target.pid === pid);
    if (priced) put('There\'s a price on your head. You can feel it.', C.red);
    const held = S.live().find((th) => th.m === 'captive' && th.cast.captive.t === 'pl' && th.cast.captive.pid === pid);
    if (held) put(`You're held in ${nameOf(S, held.cast.band)}'s cage.`, C.red);
    head('DEEDS');
    if (!k.deeds.length) put('Nothing worth telling yet.', C.dim);
    for (const d of k.deeds.slice(-10).reverse()) put(`Day ${Math.max(1, Math.floor(d.at / DAY))}: ${d.text}`, '#d0c0a0');
    const rows = this.h - 6;
    const maxScroll = Math.max(0, out.length - rows);
    this.dscroll = Math.max(0, Math.min(this.dscroll, maxScroll));
    out.slice(this.dscroll, this.dscroll + rows).forEach(([l, col], i) => g.text(3, 3 + i, l, col, undefined, this.w - 8));
    this.scrollbar(g, this.w - 3, 3, rows, out.length);
  }

  // Over the list, it moves through the list; anywhere else, through what's
  // written about the one chosen.
  onWheel(d, game) {
    game ||= this.ui.game;
    const m = this.ui.mouseCell;
    if (this.tab !== 'name' && m && m.x - this.x <= (this.listW || 30) && m.x >= this.x && game) {
      const n = this.entries(game).length;
      const was = this.sel;
      this.sel = Math.max(0, Math.min(n - 1, this.sel + Math.sign(d)));
      if (this.sel !== was) this.dscroll = 0;
      return;
    }
    this.scrollBy(Math.sign(d) * 2);
  }

  onKey(k, game) {
    game ||= this.ui.game;
    const code = k.code;
    if (code === 'Escape' || code === 'KeyO') {
      this.close();
      return true;
    }
    const ids = TABS.map((q) => q[0]);
    if (code === 'Tab') {
      this.setTab(ids[(ids.indexOf(this.tab) + 1) % ids.length]);
      return true;
    }
    if (/^Digit[1-4]$/.test(code)) {
      this.setTab(ids[+code.slice(5) - 1]);
      return true;
    }
    const list = this.entries(game);
    if (code === 'ArrowUp' || code === 'KeyW') {
      this.sel = Math.max(0, this.sel - 1);
      this.dscroll = 0;
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      this.sel = Math.min(Math.max(0, list.length - 1), this.sel + 1);
      this.dscroll = 0;
    } else if (code === 'PageDown') this.scrollBy(6);
    else if (code === 'PageUp') this.scrollBy(-6);
    else if (code === 'KeyM') {
      const e = list[this.sel];
      if (e) this.mark(e, game);
    } else if (code === 'KeyG') {
      const e = list[this.sel];
      if (e) this.giveUp(e, game);
    }
    return true;
  }
}

// (For the journal: a line or two of what you're on.)
export function questSummary(game) {
  const S = game.sim.saga;
  if (!S) return [];
  const pid = pidOf(game.player);
  const out = [];
  for (const th of S.threads) for (const t of th.tasks) {
    if (t.status === 'won' && t.ready === pid) out.push({ text: `${t.title}: done, go back to ${t.giverName || 'them'}`, ready: true });
    else if (t.status === 'open' && S.claimedBy(t, pid)) out.push({ text: t.title });
  }
  void townMid;
  return out;
}
