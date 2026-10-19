// (Round 125) Pieces the council and crown windows share: a slider for a
// rate set to the point (a tax, the tribute, the watch's pay), rather than
// one of a few fixed choices; and a person's card, to look someone over
// before naming them to an office.
import { C, wrap } from './ascii.js';

// A slider on a window's grid: ◄ ━━━━●──── ► value. `o`: { v (the value
// shown: a draft), cur (as it stands, marked │), min, max, step, fmt (a
// value as words), set (a new draft), on (can it be moved), w (the bar's
// width), col }. Click a step either end, or anywhere on the bar.
// Returns the x after it.
export function slider(win, g, x, y, o) {
  const { min, max, step = 0.01, fmt = (v) => `${v}`, on = true, w = 18, col = '#ffd070' } = o;
  const v = Math.max(min, Math.min(max, o.v));
  const snap = (q) => Math.max(min, Math.min(max, Math.round((q - min) / step) * step + min));
  const at = (q) => Math.round(((q - min) / Math.max(1e-9, max - min)) * (w - 1));
  const btn = (bx, label, can, fn) => {
    const hov = can && win.hovering(bx, y, label.length, 1);
    g.text(bx, y, label, can ? (hov ? '#1a1420' : C.hi) : C.faint, can ? (hov ? C.hi : '#2a2236') : undefined);
    if (can) win.hit(bx, y, label.length, 1, fn);
  };
  btn(x, '◄', on && v > min + 1e-9, () => o.set(snap(v - step)));
  const bx = x + 2;
  const k = at(v);
  const c = o.cur === undefined || o.cur === null ? null : at(Math.max(min, Math.min(max, o.cur)));
  const hov = on && win.hovering(bx, y, w, 1);
  for (let i = 0; i < w; i++) {
    // (The run up to the value lit, on a shaded ground: the font has no
    // heavy rule.)
    const ch = i === k ? '●' : i === c ? '│' : '─';
    g.put(bx + i, y, ch, i === k ? (hov ? C.white : col) : i === c ? '#a0c8ff' : i < k ? col : '#4a4458', i < k ? '#3a2e1c' : hov ? '#262030' : undefined);
  }
  if (on) for (let i = 0; i < w; i++) win.hit(bx + i, y, 1, 1, () => o.set(snap(min + (i / (w - 1)) * (max - min))));
  btn(bx + w + 1, '►', on && v < max - 1e-9, () => o.set(snap(v + step)));
  const label = fmt(v);
  const changed = o.cur !== undefined && o.cur !== null && Math.abs(v - o.cur) > 1e-9;
  g.text(bx + w + 3, y, label, changed ? C.white : C.fg);
  return bx + w + 4 + label.length;
}

// A button on a window's grid.
export function button(win, g, x, y, label, col, fn, on = true) {
  const hov = on && win.hovering(x, y, label.length, 1);
  g.text(x, y, label, on ? (hov ? '#1a1420' : col) : C.faint, on ? (hov ? col : '#221c2a') : undefined);
  if (on) win.hit(x, y, label.length, 1, fn);
  return x + label.length + 1;
}

// Lines of words wrapped to a width, written down from y; returns the next y.
export function para(g, x, y, text, w, col = C.dim, max = 99) {
  wrap(text, w).slice(0, max).forEach((l, i) => g.text(x, y + i, l, col));
  return y + Math.min(max, wrap(text, w).length);
}

// (Round 125) The record: every matter decided, voted down or set aside,
// newest first; filtered, scrolled, one looked at closely. `win` keeps the
// view in win.rec { filter, top, sel }. `list`: the record (see
// Office.record); `area`: { x, y, w, h }; `who`: the steward's word (the
// steward, the chancellor).
export const OUTCOMES = {
  carried: { word: 'CARRIED', glyph: '✓', color: '#80e070', pass: true },
  decreed: { word: 'DECREED', glyph: '✓', color: '#ffd070', pass: true },
  decided: { word: 'DECIDED', glyph: '✓', color: '#e8e0c8', pass: true },
  standing: { word: 'BY ORDER', glyph: '»', color: '#a0c8ff', pass: true },
  defeated: { word: 'DEFEATED', glyph: '×', color: '#ff7060', pass: false },
  vetoed: { word: 'VETOED', glyph: '×', color: '#ff9070', pass: false },
  'set aside': { word: 'SET ASIDE', glyph: '-', color: '#8a8090', pass: false },
};
const FILTERS = [['all', 'All'], ['pass', 'Passed'], ['fail', 'Failed'], ['standing', 'By order'], ['aside', 'Set aside'], ['crisis', 'Crises']];
const keep = (f, q) => {
  const O = OUTCOMES[q.outcome] || OUTCOMES.decided;
  if (f === 'pass') return O.pass && q.outcome !== 'standing';
  if (f === 'fail') return q.outcome === 'defeated' || q.outcome === 'vetoed';
  if (f === 'standing') return q.outcome === 'standing';
  if (f === 'aside') return q.outcome === 'set aside';
  if (f === 'crisis') return q.crisis;
  return true;
};

export function drawRecord(win, g, list, area, who = 'the steward') {
  const R = (win.rec ||= { filter: 'all', top: 0, sel: null });
  const all = (list || []).slice().reverse();
  const x = area.x;
  // The tally.
  const n = (k) => all.filter((q) => q.outcome === k).length;
  const tally = [['carried', n('carried')], ['decreed', n('decreed') + n('decided')], ['standing', n('standing')], ['defeated', n('defeated') + n('vetoed')], ['set aside', n('set aside')]];
  let tx = x;
  for (const [k, c] of tally) {
    const O = OUTCOMES[k];
    const t = `${O.glyph} ${c} ${k === 'decreed' ? 'decided' : k === 'standing' ? `by ${who}` : k === 'defeated' ? 'failed' : O.word.toLowerCase()}`;
    g.text(tx, area.y, t, O.color);
    tx += t.length + 2;
  }
  // The filters.
  let fx = x;
  for (const [id, label] of FILTERS) {
    const on = R.filter === id;
    const hov = !on && win.hovering(fx, area.y + 1, label.length + 2, 1);
    g.text(fx, area.y + 1, ` ${label} `, on ? '#1a1420' : hov ? C.white : C.dim, on ? '#c8a060' : hov ? '#3a3048' : '#221c2a');
    if (!on) win.hit(fx, area.y + 1, label.length + 2, 1, () => {
      R.filter = id;
      R.top = 0;
      R.sel = null;
    });
    fx += label.length + 3;
  }
  const shown = all.filter((q) => keep(R.filter, q));
  const rows = area.h - 8;
  R.top = Math.max(0, Math.min(R.top, Math.max(0, shown.length - rows)));
  let y = area.y + 3;
  if (!shown.length) g.text(x, y, all.length ? 'Nothing of that kind yet.' : 'Nothing decided yet: the record starts with your first sitting.', C.faint);
  shown.slice(R.top, R.top + rows).forEach((q, i) => {
    const O = OUTCOMES[q.outcome] || OUTCOMES.decided;
    const on = R.sel === R.top + i;
    const hov = win.hovering(x, y, area.w, 1);
    g.fill(x, y, area.w, 1, ' ', C.fg, on ? '#2c2438' : hov ? '#221c2a' : undefined);
    g.text(x, y, `d${q.day}`.padEnd(5), C.faint);
    g.text(x + 5, y, O.glyph, O.color);
    g.text(x + 7, y, O.word.padEnd(9), O.color);
    const votes = q.aye !== null && q.aye !== undefined ? ` ${q.aye}-${q.nay}` : '';
    const text = `${q.crisis ? '! ' : ''}${q.title.replace(/\?$/, '')}${q.choice ? `: ${q.choice}` : ''}`;
    g.text(x + 17, y, text.slice(0, area.w - 18 - votes.length), on || hov ? C.white : C.fg);
    if (votes) g.text(x + area.w - votes.length, y, votes, C.dim);
    win.hit(x, y, area.w, 1, () => {
      R.sel = on ? null : R.top + i;
    });
    y++;
  });
  if (shown.length > rows) {
    g.text(x + area.w - 12, area.y + 2, `${R.top + 1}-${Math.min(shown.length, R.top + rows)} of ${shown.length}`, C.faint);
    const up = R.top > 0;
    const dn = R.top + rows < shown.length;
    button(win, g, x + area.w - 22, area.y + 2, ' ▲ ', C.hi, () => {
      R.top = Math.max(0, R.top - rows + 1);
    }, up);
    button(win, g, x + area.w - 18, area.y + 2, ' ▼ ', C.hi, () => {
      R.top += rows - 1;
    }, dn);
  }
  // The one looked at.
  const q = R.sel !== null ? shown[R.sel] : null;
  const by = area.y + area.h - 4;
  for (let i = 0; i < area.w; i++) g.put(x + i, by - 1, '─', '#3a3040');
  if (!q) {
    g.text(x, by, 'Click an entry to see it in full. The wheel scrolls.', C.faint);
    return;
  }
  const O = OUTCOMES[q.outcome] || OUTCOMES.decided;
  g.text(x, by, `Day ${q.day} · ${O.word}${q.outcome === 'standing' ? ` (${who}, by your standing orders)` : q.by === 'you' ? ' (yours)' : ''}`, O.color);
  wrap(`${q.title}${q.choice ? ` · ${q.choice}` : ''}`, area.w).slice(0, 2).forEach((l, i) => g.text(x, by + 1 + i, l, C.fg));
  if (q.aye !== null && q.aye !== undefined) {
    const t = q.aye + q.nay || 1;
    const w = 20;
    const k = Math.round((q.aye / t) * w);
    const vx = x + area.w - w - 12;
    for (let i = 0; i < w; i++) g.put(vx + i, by, ' ', C.fg, i < k ? '#3a8040' : '#803030');
    g.text(vx + w + 1, by, `${q.aye} to ${q.nay}`, C.dim);
  }
}

// Scroll the record by the wheel.
export function wheelRecord(win, d) {
  const R = (win.rec ||= { filter: 'all', top: 0, sel: null });
  R.top = Math.max(0, R.top + (d > 0 ? 3 : -3));
}

// (Round 125) How a war is going, at a glance: the balance of it, how
// weary each side is, who fights on each side, the towns taken and lost,
// the next battle and the last ones. `civ`: the realm whose war it is (or
// whose last war, at peace). `area`: { x, y, w, h }. Returns the war shown
// (null at peace with no war remembered).
const pl = (c) => (c ? c.name.replace(/^The /, '') : '?');
export function drawWar(win, g, game, civ, area) {
  const sim = game.sim;
  const war = sim.war;
  const ow = game.world.ow;
  const { x, w } = area;
  let y = area.y;
  if (!war || !civ) {
    g.text(x, y, 'No word of any war.', C.faint);
    return null;
  }
  const cur = war.warOf(civ);
  const last = cur || war.past.slice().reverse().find((q) => q.a.includes(civ.id) || q.b.includes(civ.id));
  if (!last) {
    g.text(x, y++, `The ${pl(civ)} is at peace, and has been as long as anyone here remembers.`, C.dim);
    const near = sim.realms.civs.filter((o) => o !== civ && sim.realms.members(o).length).map((o) => ({ o, r: sim.realms.relation(civ, o) })).sort((p, q) => p.r.score - q.r.score).slice(0, 4);
    if (near.length) {
      y++;
      g.text(x, y++, 'Who might come to blows with it:', C.fg);
      for (const { o, r } of near) g.text(x + 1, y++, `${pl(o).slice(0, 26).padEnd(27)}${r.standing} (${Math.round(r.score)})`, r.standing === 'hostile' ? '#ffa050' : C.dim);
    }
    return null;
  }
  const side = war.sideOf(last, civ);
  const other = side === 'a' ? 'b' : 'a';
  const foe = war.civ(last.lead[other]);
  const day = game.day;
  g.text(x, y++, cur ? `AT WAR with the ${pl(foe)}` : `The last war: with the ${pl(foe)} (over, day ${last.over ? last.over.day : '?'})`, cur ? '#ff7060' : C.hi);
  g.text(x, y++, `Over ${last.why || 'old grievances'} · ${cur ? `${day - last.start} days now` : `${(last.over ? last.over.day : day) - last.start} days`}`.slice(0, w), C.dim);
  if (!cur && last.over && last.over.text) {
    wrap(last.over.text, w).slice(0, 2).forEach((l) => g.text(x, y++, l, C.fg));
  }
  y++;
  // The balance: a tug of war, ours to the left.
  const sc = (side === 'a' ? 1 : -1) * last.score;
  const bw = Math.min(40, w - 18);
  g.text(x, y, 'The balance', C.fg);
  const bx = x + 13;
  const mid = Math.floor(bw / 2);
  const at = Math.round(mid + (sc / 100) * mid);
  for (let i = 0; i < bw; i++) {
    const ours = i < at;
    g.put(bx + i, y, i === mid ? '│' : ' ', '#1a1420', ours ? '#3a7040' : '#7a3030');
  }
  g.put(bx + Math.max(0, Math.min(bw - 1, at)), y, '◆', '#ffe070', '#2a2030');
  const word = sc >= 60 ? 'winning handily' : sc >= 20 ? 'winning' : sc > -20 ? 'even' : sc > -60 ? 'losing' : 'losing badly';
  g.text(bx + bw + 2, y++, word, sc >= 20 ? '#80e070' : sc > -20 ? C.dim : '#ff7060');
  g.text(bx, y++, 'us'.padEnd(bw - 4) + 'them', C.faint);
  // Weariness: at the top of the bar, a side asks for terms.
  const tired = (ids) => Math.max(0, ...ids.map((id) => last.weary[id] || 0));
  for (const [label, ids, col] of [['Our weariness', last[side], '#e8c070'], ['Theirs', last[other], '#c08080']]) {
    const v = Math.min(1, tired(ids));
    g.text(x, y, label, C.dim);
    const n = Math.round(v * 20);
    for (let i = 0; i < 20; i++) g.put(x + 15 + i, y, i < n ? '▪' : '·', i < n ? col : '#3a3448');
    g.text(x + 37, y++, `${Math.round(v * 100)}%${v >= 1 ? ' (ready to treat)' : ''}`, v >= 0.8 ? '#ffa050' : C.faint);
  }
  // Who fights.
  const pol = sim.politics;
  const strength = (ids) => Math.round(ids.reduce((n, id) => n + (war.civ(id) ? pol.strength(war.civ(id)) : 0), 0));
  y++;
  const list = (ids) => ids.map((id) => pl(war.civ(id))).join(', ');
  g.text(x, y, 'With us', C.dim);
  g.text(x + 9, y++, `${list(last[side])} · strength ${strength(last[side])}`.slice(0, w - 9), '#a0e8a0');
  g.text(x, y, 'Against', C.dim);
  g.text(x + 9, y++, `${list(last[other])} · strength ${strength(last[other])}`.slice(0, w - 9), '#ffa080');
  // Towns taken and lost.
  const caps = last.captured || [];
  const won = caps.filter((q) => last[side].includes(q.by));
  const lost = caps.filter((q) => last[other].includes(q.by));
  const nm = (q) => (ow.settlements[q.sid] ? ow.settlements[q.sid].name : '?');
  g.text(x, y, 'Taken', C.dim);
  g.text(x + 9, y++, won.length ? won.map(nm).join(', ').slice(0, w - 9) : 'none', won.length ? '#a0e8a0' : C.faint);
  g.text(x, y, 'Lost', C.dim);
  g.text(x + 9, y++, lost.length ? lost.map(nm).join(', ').slice(0, w - 9) : 'none', lost.length ? '#ff8070' : C.faint);
  // The front: our towns within reach of theirs.
  if (cur) {
    const front = sim.realms.members(civ).filter((s) => war.front(s));
    g.text(x, y, 'The front', C.dim);
    g.text(x + 10, y++, front.length ? front.map((s) => s.name).join(', ').slice(0, w - 10) : 'quiet', front.length ? '#ffd090' : C.faint);
    const P = last.plan;
    if (P) {
      const s = ow.settlements[P.def];
      const ours = last[side].includes(P.ca) || last[side].includes(P.cb) ? (P.attacker === side ? 'we attack' : 'we defend') : '';
      const left = Math.max(0, P.at - sim.abs);
      g.text(x, y++, `Next battle: ${P.name}, outside ${s ? s.name : '?'}${ours ? ` (${ours})` : ''}, in ${Math.floor(left / 60)}h`.slice(0, w), '#ffe070');
    }
  }
  // The last battles.
  y++;
  g.text(x, y++, 'Battles', C.fg);
  const bs = last.battles.slice(-Math.max(1, area.y + area.h - y - 1)).reverse();
  if (!bs.length) g.text(x + 1, y++, 'None fought yet.', C.faint);
  for (const b of bs) {
    if (y >= area.y + area.h) break;
    const weWon = b.winner === side;
    const n0 = side === 'a' ? b.na : b.nb;
    const n1 = side === 'a' ? b.nb : b.na;
    const l0 = side === 'a' ? b.la : b.lb;
    const l1 = side === 'a' ? b.lb : b.la;
    g.text(x + 1, y, `d${b.day}`.padEnd(5), C.faint);
    g.text(x + 6, y, weWon ? (b.decisive ? 'WON ★' : 'WON') : b.decisive ? 'ROUTED' : 'LOST', weWon ? '#80e070' : '#ff7060');
    g.text(x + 13, y, `${b.name}`.slice(0, Math.max(8, w - 44)), C.fg);
    const t = `${n0} v ${n1} · fell ${l0} / ${l1}`;
    g.text(x + w - t.length, y++, t, C.dim);
  }
  return last;
}
