// (Round 121) The council window: governing a town you hold (see
// sim/office.js). Seven pages, one a key:
//   1 The sitting: the matters before the council (a crisis first, with
//     its hours left), each with its choices and what each will do to the
//     treasury and to each faction; decide one and it's put to the vote
//     there and then (in the hall: watch the councillors vote, the seal
//     come down), sent to your steward for the morning (away from it), or
//     decreed (under a protectorate). What's been decided lately below.
//   2 The treasury: what's in it, what comes in and goes out, the tax and
//     the four budget lines (each a proposal put to the council).
//   3 The laws: each, who wants it, and a proposal to pass or repeal it
//     (the drafted ones only a governor can put forward among them).
//   4 The people: the seven factions, how well each thinks of you and why,
//     what each wants, the promises you made them; the town's mood over the
//     last three weeks.
//   5 Officers: the steward, captain, treasurer and magistrate; the
//     council's seats (fellow players can sit on them); standing orders.
//   6 The charter: how the town is governed, and the other ways it could
//     be (reform it, by two in every three); stepping down.
//   7 The realm: its decrees and where you stand with them, petitions to
//     its ruler, its council, breaking away; your ambitions.
// Someone who sits on the council but doesn't govern sees it all, and
// votes when asked.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { drawText } from '../render/font.js';
import { humanoidSheet, SHEET_H } from '../render/sprites.js';
import { CHAR_W, CHAR_H } from '../config.js';
import { FACTIONS, FACTION_IDS, BUDGET, BUDGET_IDS, members, factionStances, townState, wish } from '../sim/factions.js';
import { CHARTERS, CHARTER_IDS, headTitle, charterFits } from '../sim/charters.js';
import { LAWS, LAW_IDS, lawFits, lawOn, byDecree } from '../sim/laws.js';
import { stated, sums, forChange, full } from '../sim/agenda.js';
import { OFFICES, OFFICE_IDS, ORDERS, ORDER_IDS } from '../sim/office.js';
import { authority, formOf } from '../sim/realms.js';
import { seatOfPid } from '../sim/saga/refs.js';
import { seatPart } from '../game/party.js';

// (Round 122: six pages; the realm and your ambitions are views of the
// charter's, the standing orders a view of the officers'.)
const TABS = [
  { id: 'sitting', label: 'Matters' },
  { id: 'treasury', label: 'Money' },
  { id: 'laws', label: 'Laws' },
  { id: 'people', label: 'People' },
  { id: 'officers', label: 'Offices' },
  { id: 'charter', label: 'Charter' },
];
const W = 84;
const H = 34;
const BODY = 5;
const CHAMBER_Y = 22;
const CHAMBER_H = 9;
const BG = '#0e0b14';
// (A candle's place, between two seats.)
const i2x = (xs, k) => (xs[k] + xs[k + 1]) / 2;
const pc = (v) => `${Math.round(v * 100)}%`;
const sign = (v) => (v > 0 ? `+${v}` : `${v}`);

// Approval's colour: red, amber, gold, green.
export function approvalColor(v) {
  return v < 30 ? '#ff6050' : v < 45 ? '#ffa050' : v < 60 ? '#e8d060' : v < 75 ? '#a8e070' : '#70f0a0';
}

// A bar of `w` cells, `v` of 100 full (solid cells, a half-cell at the end).
function bar(g, x, y, w, v, col, back = '#2a2432') {
  const full = Math.round((Math.max(0, Math.min(100, v)) / 100) * w * 2);
  for (let i = 0; i < w; i++) {
    const k = full - i * 2;
    if (k >= 2) g.put(x + i, y, ' ', col, col);
    else if (k === 1) g.put(x + i, y, '▌', col, back);
    else g.put(x + i, y, ' ', col, back);
  }
}

// (Round 122) Who a choice moves, in words: the few it moves most, each
// with an arrow. Returns where it ended.
export function whoMoves(g, x, y, by, maxW = 30, names = (f) => FACTIONS[f].short || FACTIONS[f].name) {
  const list = Object.entries(by).filter(([, d]) => Math.abs(d) >= 1).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
  let cx = x;
  if (!list.length) {
    g.text(cx, y, 'no one minds', C.faint);
    return cx + 12;
  }
  for (const [f, d] of list) {
    const w = `${names(f)}${d >= 4 ? (d > 0 ? '▲▲' : '▼▼') : d > 0 ? '▲' : '▼'}`;
    if (cx + w.length - x > maxW) break;
    const col = FACTIONS[f] ? FACTIONS[f].color : C.fg;
    g.text(cx, y, names(f), col);
    g.text(cx + names(f).length, y, w.slice(names(f).length), d > 0 ? '#80e070' : '#ff7060');
    cx += w.length + 1;
  }
  return cx;
}

// A row of the factions' glyphs, each coloured by how a choice moves them
// (▲ better, ▼ worse, · no matter).
function factionDeltas(g, x, y, by, counts) {
  let cx = x;
  for (const f of FACTION_IDS) {
    if (counts && !counts[f]) continue;
    const d = by[f] || 0;
    g.put(cx, y, FACTIONS[f].glyph, FACTIONS[f].color);
    const mark = d >= 1 ? '▲' : d <= -1 ? '▼' : '·';
    g.put(cx + 1, y, mark, d >= 4 ? '#70f0a0' : d >= 1 ? '#a8d070' : d <= -4 ? '#ff5040' : d <= -1 ? '#e09050' : C.faint);
    cx += 3;
  }
  return cx;
}

export class CouncilWindow extends Window {
  constructor(ui, sid, tab = 'sitting') {
    super(ui, W, H, { kind: 'council', x: 0, y: 1 });
    this.sid = sid;
    this.tab = tab;
    this.sel = null; // the matter looked at
    this.lawSel = null;
    this.facSel = null;
    this.officeSel = null;
    this.reveal = null; // a vote being shown
    this.confirm = null;
    this.t = 0;
    this.cache = new Map(); // what each choice does, worked out once a second
    this.taxDraft = null;
    this.flash = null; // { text, color, t }
    this.game = ui.game || null;
  }

  get office() {
    return this.game.sim.office;
  }

  update(dt) {
    this.t += dt;
    if (this.reveal) this.reveal.t += dt;
    if (this.flash) this.flash.t += dt;
  }

  L() {
    return this.game.sim.layoutOf(this.sid);
  }

  T() {
    return this.office.of(this.sid);
  }

  mine() {
    const T = this.T();
    return !!(T && T.holder && T.holder.pid === this.office.pid());
  }

  say(text, color = C.hi) {
    this.flash = { text, color, t: 0 };
  }

  // What a choice does (kept a second: the reckoning isn't free).
  effects(L, T, it, k) {
    const key = `${it.id}:${k}`;
    const c = this.cache.get(key);
    if (c && this.t - c.t < 1) return c.v;
    const v = stated(this.game.sim, L, T, it.opts[k], CHARTERS, this.game.day);
    this.cache.set(key, { t: this.t, v });
    return v;
  }

  draw(g, game) {
    this.game = game;
    const L = this.L();
    const T = this.T();
    g.fill(0, 0, this.w, this.h, ' ', C.fg, BG);
    if (!L || !L.econ || !T || !T.holder) {
      g.box(0, 0, this.w, this.h, { bg: BG, double: true, title: 'THE COUNCIL' });
      g.center(10, 'This council no longer sits for you.', C.dim);
      g.center(12, 'Esc: close', C.faint);
      return;
    }
    const s = L.settlement;
    const ch = CHARTERS[T.charter];
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, fg: ch.color, title: `${ch.glyph} THE COUNCIL OF ${s.name.toUpperCase()} ${ch.glyph}`, titleFg: ch.color });
    this.header(g, L, T);
    this.tabs(g, T);
    // (The realm page of old: the charter's realm view now.)
    if (this.tab === 'realm') {
      this.tab = 'charter';
      this.view = 'realm';
    }
    const fn = { sitting: this.drawSitting, treasury: this.drawTreasury, laws: this.drawLaws, people: this.drawPeople, officers: this.drawOfficers, charter: this.drawCharter }[this.tab];
    fn.call(this, g, L, T);
    // A word on what just happened.
    if (this.flash && this.flash.t < 4) {
      const text = ` ${this.flash.text} `.slice(0, W - 4);
      g.text(Math.floor((W - text.length) / 2), H - 2, text, this.flash.color, 'rgba(20,16,28,0.95)');
    } else g.text(2, H - 2, this.mine() ? '1-6: pages   ↑↓: choose   Enter: decide   Esc: close' : '1-6: pages   You sit on this council: you vote when it asks you.   Esc: close', C.faint);
  }

  header(g, L, T) {
    const s = L.settlement;
    const h = T.holder;
    const title = headTitle(T.charter, s, h && h.style);
    const e = L.econ;
    g.text(2, 1, `${title} ${h.name}`.slice(0, 30), C.hi);
    const tr = `¤${Math.floor(e.treasury)} · taxes ${pc(e.tax)}`;
    // (Ruling the realm too: the crown's window, a click away.)
    const civ = s.civ;
    const crown = this.game.sim.crown;
    let rx = W - 2;
    if (civ && crown && crown.isRuler(civ, this.office.pid())) {
      const lb = ' ★ The crown ';
      rx -= lb.length;
      const hov = this.hovering(rx, 1, lb.length, 1);
      g.text(rx, 1, lb, hov ? '#1a1420' : '#ffd070', hov ? '#ffd070' : '#2a2236');
      this.hit(rx, 1, lb.length, 1, () => this.ui.openCrown?.(this.game, civ));
      rx -= 2;
    }
    g.text(rx - tr.length, 1, tr, '#e8d8a0');
    // The town's mood, at a glance; when the council next sits.
    const v = T.lastOverall ?? 50;
    const prev = T.hist.length > 1 ? T.hist[T.hist.length - 2].overall : v;
    g.text(2, 2, 'Approval', C.dim);
    bar(g, 11, 2, 20, v, approvalColor(v));
    g.text(32, 2, `${v}`, approvalColor(v));
    if (v !== prev) g.text(35, 2, v > prev ? `▲${v - prev}` : `▼${prev - v}`, v > prev ? '#a8e070' : '#ffa050');
    const abs = this.game.sim.abs;
    const next = (Math.floor(abs / 1440) + (abs % 1440 < 600 ? 0 : 1)) * 1440 + 600;
    const left = next - abs;
    const nx = `${this.office.inHall(L) ? 'in the hall' : 'by letter'} · sits in ${Math.floor(left / 60)}h${String(Math.floor(left % 60)).padStart(2, '0')}`;
    g.text(W - 2 - nx.length, 2, nx, C.faint);
  }

  tabs(g, T) {
    let x = 2;
    const open = T.agenda.filter((q) => !q.done && q.state === 'open').length;
    const crisis = T.agenda.some((q) => q.crisis && !q.done && q.state === 'open');
    TABS.forEach((tb, i) => {
      const badge = tb.id === 'sitting' && open ? ` ${open}` : '';
      const label = ` ${i + 1}·${tb.label}${badge} `;
      const on = this.tab === tb.id;
      const hov = this.hovering(x, 3, label.length, 1);
      const alarm = tb.id === 'sitting' && crisis && Math.floor(this.t * 3) % 2;
      g.text(x, 3, label, on ? '#1a1420' : alarm ? '#ffd0c0' : hov ? C.white : C.fg, on ? CHARTERS[T.charter].color : alarm ? '#802020' : hov ? '#3a3048' : '#221c2a');
      this.hit(x, 3, label.length, 1, () => this.goTab(tb.id));
      x += label.length + 1;
    });
    for (let i = 1; i < W - 1; i++) g.put(i, 4, '─', '#4a4050');
  }

  goTab(id) {
    if (this.reveal) return;
    this.tab = id;
    this.confirm = null;
    this.ui.audio?.play('page');
  }

  // ------------------------------------------------------------ 1 sitting
  items(T) {
    return T.agenda.filter((q) => !q.done).sort((a, b) => (b.crisis ? 1 : 0) - (a.crisis ? 1 : 0) || a.id - b.id);
  }

  drawSitting(g, L, T) {
    const items = this.items(T);
    if (this.sel === null || !items.some((q) => q.id === this.sel)) this.sel = items.length ? items[0].id : null;
    // The matters, on the left: a line each, and what's become of it.
    let y = BODY;
    const abs = this.game.sim.abs;
    for (const it of items.slice(0, 8)) {
      const on = it.id === this.sel;
      const hov = this.hovering(1, y, 30, 2);
      const bg = on ? (it.crisis ? '#401820' : '#2c2438') : hov ? '#221c2a' : undefined;
      g.fill(1, y, 30, 2, ' ', C.fg, bg);
      const st = this.stateChip(it, abs);
      g.text(2, y, st.glyph, st.color);
      const t = it.title.length > 27 ? `${it.title.slice(0, 26)}…` : it.title;
      g.text(4, y, t, on ? C.white : it.crisis ? '#ffb0a0' : C.fg);
      if (it.crisis && it.state === 'open') {
        // Time running out, as a fuse.
        const span = Math.max(1, it.until - it.day * 1440 - 600);
        const left = Math.max(0, it.until - abs) / span;
        for (let i = 0; i < 26; i++) g.put(4 + i, y + 1, i / 26 < left ? '▪' : '·', i / 26 < left ? (Math.floor(this.t * 4) % 2 && i === Math.floor(left * 26) - 1 ? '#ffff80' : '#ff7050') : '#4a3038');
      } else g.text(4, y + 1, st.text.slice(0, 26), st.color === C.dim ? C.faint : st.color);
      this.hit(1, y, 30, 2, () => {
        this.sel = it.id;
        this.ui.audio?.play('select');
      });
      y += 2;
    }
    if (!items.length) {
      g.text(3, y + 1, 'Nothing before the council.', C.dim);
      wrap('New matters come each morning at ten. Propose your own from the other pages.', 27).forEach((l, i) => g.text(3, y + 3 + i, l, C.faint));
      // What was decided lately, while there's room.
      const my = y + 7;
      g.text(3, my, 'Lately', C.faint);
      T.minutes.slice(-8).reverse().forEach((m, i) => g.text(3, my + 1 + i, `${m.title.replace(/\?$/, '')}: ${m.what}`.slice(0, 27), C.faint));
    }
    for (let j = BODY; j < H - 3; j++) g.put(31, j, '│', '#3a3040');
    const it = items.find((q) => q.id === this.sel);
    if (it) this.drawMatter(g, L, T, it);
  }

  stateChip(it, abs) {
    if (it.crisis && it.state === 'open') {
      const left = Math.max(0, it.until - abs);
      return { glyph: '!', color: '#ff7060', text: `CRISIS · ${Math.floor(left / 60)}h${String(Math.floor(left % 60)).padStart(2, '0')} to decide` };
    }
    const by = it.by && FACTIONS[it.by] ? `from the ${FACTIONS[it.by].name.toLowerCase()}` : it.by === 'realm' ? 'from the realm' : it.mine ? 'your proposal' : 'the town\'s business';
    if (it.state === 'carried') return { glyph: '✓', color: '#80e070', text: 'carried: done at 10:00' };
    if (it.state === 'sent') return { glyph: '»', color: '#a0c8ff', text: 'sent: voted on at 10:00' };
    if (it.state === 'voting') return { glyph: '…', color: '#a0e8ff', text: 'the council is voting' };
    if (it.struck.length) return { glyph: '×', color: '#ffa050', text: `voted down · ${by}` };
    return { glyph: '•', color: it.by && FACTIONS[it.by] ? FACTIONS[it.by].color : C.dim, text: by };
  }

  drawMatter(g, L, T, it) {
    const x = 33;
    const w = W - x - 2;
    let y = BODY;
    if (this.reveal && this.reveal.id === it.id) return this.drawReveal(g, L, T, it, x, w);
    wrap(it.title, w).slice(0, 2).forEach((l) => g.text(x, y++, l, it.crisis ? '#ffb0a0' : C.hi));
    let why = 0;
    for (const p of it.why) {
      for (const l of wrap(p, w)) {
        if (why >= 4) break;
        g.text(x, y++, l, C.dim);
        why++;
      }
    }
    y++;
    const mine = this.mine();
    const open = it.state === 'open';
    it.opts.forEach((opt, k) => {
      if (y > CHAMBER_Y - 3) return;
      const struck = it.struck.includes(k);
      const chosen = it.choice === k && !open;
      const can = mine && open && !struck && !opt.off;
      const hov = can && this.hovering(x, y, w, 2);
      g.fill(x, y, w, 2, ' ', C.fg, chosen ? '#203a28' : hov ? '#30283c' : k % 2 ? '#1a1622' : '#1e1a28');
      g.text(x + 1, y, `${k + 1}`, can ? C.hi : C.faint);
      const lab = opt.label.slice(0, w - 13);
      g.text(x + 3, y, lab, struck ? '#806858' : opt.off ? C.faint : chosen ? '#a0f0b0' : C.white);
      if (struck) for (let i = 0; i < lab.length; i++) g.put(x + 3 + i, y, lab[i] === ' ' ? '─' : lab[i], '#806858');
      const ef = this.effects(L, T, it, k);
      const line = opt.off ? `not possible: ${opt.off}` : struck ? 'voted down by the council' : (ef.lines[0] && ef.lines[0].text) || (opt.trivial ? 'no vote needed' : '');
      g.text(x + 3, y + 1, line.slice(0, w - 13), opt.off || struck ? C.faint : '#c8b890');
      // Who it moves, after its name, where there's room.
      if (!opt.off && !struck && lab.length < w - 20) whoMoves(g, x + 5 + lab.length, y, ef.by, w - 7 - lab.length - 8);
      if (ef.overall && !opt.off) {
        const tt = `town ${sign(ef.overall)}`;
        g.text(W - 3 - tt.length, y, tt, ef.overall > 0 ? '#a8e070' : '#ffa050');
      }
      if (can) this.hit(x, y, w, 2, () => this.choose(L, T, it, k));
      y += 2;
    });
    // The chamber, below.
    this.chamberArea = { x, y: CHAMBER_Y, w, h: CHAMBER_H };
    const ch = CHARTERS[T.charter];
    const how = ch.vote === 'decree' ? 'You decide by decree.' : ch.vote === 'assembly' ? 'Every grown townsperson votes.' : ch.vote === 'factions' ? 'Each faction has one voice.' : ch.vote === 'guild' ? 'The guild masters vote, by the weight of their purses.' : ch.vote === 'temple' ? 'The temple\'s council votes; the priest may veto.' : 'The council votes; you decide a tie.';
    g.text(x, H - 3, (it.crisis ? 'A crisis is yours alone to decide, there and then.' : this.office.inHall(L) || ch.vote === 'decree' ? how : `${how}`.length > w - 12 ? how : `${how} (By letter.)`).slice(0, w), C.faint);
    if (it.vote && it.vote.ballots && it.vote.ballots.length && !it.crisis) {
      const t = `last vote: ${it.vote.aye} for, ${it.vote.nay} against (${it.vote.state})`;
      g.text(W - 2 - t.length, CHAMBER_Y - 1, t, it.vote.state === 'carried' ? '#80e070' : '#ffa050');
    }
  }
  choose(L, T, it, k) {
    if (this.reveal) return;
    const opt = it.opts[k];
    const r = this.office.decide(L, it.id, k);
    if (!r.ok) return this.say(r.why || 'Not possible.', '#ffb080');
    this.cache.clear();
    if (r.vote && r.vote.ballots && r.vote.ballots.length && r.state !== 'waiting') {
      this.reveal = { id: it.id, vote: r.vote, t: 0, label: opt.label, title: it.title, it };
      this.ui.audio?.play('page');
    } else if (r.state === 'waiting') this.say('The council is voting: waiting on the players among them.', '#a0e8ff');
    else if (r.state === 'sent') this.say('Your word goes to the steward: the council votes on it at ten.', '#a0c8ff');
    else if (r.state === 'decreed') this.say('So decreed. It\'s done at ten.', CHARTERS[T.charter].color);
    else {
      this.say(it.crisis ? 'Done.' : 'So be it.', C.hi);
      this.ui.audio?.play('select');
    }
  }

  // ------------------------------------------------------------ the vote
  // Who votes, in order: the ballots revealed a few a second, then the seal.
  revealTimes(v) {
    const crowd = v.ballots.length > 12;
    const step = crowd ? 1.6 / v.ballots.length : 0.42;
    return { step, done: 0.4 + v.ballots.length * step, seal: 0.4 + v.ballots.length * step + 0.25 };
  }

  drawReveal(g, L, T, it, x, w) {
    const R = this.reveal;
    const v = R.vote;
    const tm = this.revealTimes(v);
    let y = BODY;
    g.text(x, y++, 'Put to the vote:', C.dim);
    wrap(`${it.title.replace(/\?$/, '')}: ${R.label}`, w).forEach((l) => g.text(x, y++, l, C.hi));
    y++;
    const shown = Math.max(0, Math.floor((R.t - 0.4) / tm.step) + 1);
    const crowd = v.ballots.length > 12;
    let aye = 0;
    let nay = 0;
    v.ballots.slice(0, shown).forEach((b) => {
      if (b.v === 1) aye += b.w;
      else if (b.v === 0) nay += b.w;
    });
    if (!crowd) {
      v.ballots.forEach((b, i) => {
        if (y >= CHAMBER_Y - 2) return;
        const on = i < shown;
        const f = b.f && FACTIONS[b.f];
        g.text(x, y, f ? f.glyph : b.you ? '♦' : '☺', f ? f.color : C.hi);
        g.text(x + 2, y, `${b.who}${b.w > 1 ? ` (×${b.w})` : ''}`.slice(0, 19), on ? C.white : C.faint);
        if (on) {
          g.text(x + 21, y, b.v === 1 ? '✓ FOR' : b.v === 0 ? '× AGAINST' : '· ABSENT', b.v === 1 ? '#80e070' : b.v === 0 ? '#ff7060' : C.faint);
          if (b.why) g.text(x + 31, y, b.why.slice(0, w - 31), C.dim);
        } else g.text(x + 21, y, '…', C.faint);
        y++;
      });
    } else {
      g.text(x, y++, `${v.ballots.length} vote${v.kind === 'assembly' ? ' in the moot' : ''}`, C.dim);
    }
    // The count, and then the seal.
    const cy = CHAMBER_Y - 1;
    g.text(x, cy, `For ${String(aye).padStart(3)}`, '#80e070');
    g.text(x + 12, cy, `Against ${String(nay).padStart(3)}`, '#ff7060');
    const done = R.t >= tm.seal;
    if (done) {
      const st = v.state;
      const word = st === 'carried' ? 'CARRIED' : st === 'vetoed' ? 'VETOED' : 'DEFEATED';
      g.text(x + 28, cy, word, st === 'carried' ? '#80ff90' : '#ff7060');
      g.text(x, H - 3, R.t > tm.seal + 1.2 ? 'Click or Enter to go on.' : '', C.faint);
      if (!R.sounded) {
        R.sounded = true;
        this.ui.audio?.play(st === 'carried' ? 'fanfare' : 'thud');
        this.cache.clear();
      }
    } else if (R.lastShown !== shown) {
      R.lastShown = shown;
      if (shown > 0 && shown <= v.ballots.length && !crowd) this.ui.audio?.play('tink');
    }
    this.chamberArea = { x, y: CHAMBER_Y, w, h: CHAMBER_H };
    this.hit(x, BODY, w, H - BODY - 2, () => this.endReveal());
  }

  endReveal() {
    const R = this.reveal;
    if (!R) return;
    const tm = this.revealTimes(R.vote);
    if (R.t < tm.seal) R.t = tm.seal;
    else this.reveal = null;
  }

  // The chamber, drawn in pixels: the hall's back wall under the town's
  // banner, its windows lit by the hour, and the council seated behind the
  // long table (each as they really look, a nameplate before them), you in
  // the high chair at its middle. When it votes, each holds up their vote
  // in turn, and the seal comes down. A moot is the town's crowd before the
  // table; a commune, the factions' banners.
  drawPixels(ctx) {
    if (this.tab === 'people') return this.drawMoodChart(ctx);
    if (this.tab === 'treasury') return this.drawTreasuryChart(ctx);
    if (this.tab !== 'sitting' || !this.chamberArea) return;
    const T = this.T();
    const L = this.L();
    if (!T || !T.holder || !L) return;
    const a = this.chamberArea;
    const X = (this.x + a.x) * CHAR_W;
    const Y = (this.y + a.y) * CHAR_H;
    const PW = a.w * CHAR_W;
    const PH = a.h * CHAR_H;
    const ch = CHARTERS[T.charter];
    const t = this.t;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, PW, PH);
    ctx.clip();
    // The wall: dark panelling, a lighter rail.
    ctx.fillStyle = '#2a1e18';
    ctx.fillRect(X, Y, PW, PH);
    for (let px = 0; px < PW; px += 22) {
      ctx.fillStyle = '#231812';
      ctx.fillRect(X + px, Y, 1, PH);
      ctx.fillStyle = '#33251c';
      ctx.fillRect(X + px + 3, Y + 4, 16, PH - 30);
      ctx.fillStyle = '#2c2018';
      ctx.fillRect(X + px + 4, Y + 5, 14, PH - 32);
    }
    ctx.fillStyle = '#4a3424';
    ctx.fillRect(X, Y + PH - 28, PW, 2);
    // Windows, lit by the hour.
    const m = this.game.minute;
    const day = m > 360 && m < 1140;
    const dusk = (m > 300 && m <= 420) || (m >= 1080 && m < 1200);
    for (const wx of [X + 18, X + PW - 34]) {
      ctx.fillStyle = '#1a120c';
      ctx.fillRect(wx - 1, Y + 3, 18, 26);
      const grad = ctx.createLinearGradient(0, Y + 4, 0, Y + 28);
      grad.addColorStop(0, day ? '#a8d0f0' : dusk ? '#f0a070' : '#141c3a');
      grad.addColorStop(1, day ? '#d8ecf8' : dusk ? '#c06a60' : '#24305a');
      ctx.fillStyle = grad;
      ctx.fillRect(wx, Y + 4, 16, 24);
      ctx.fillStyle = '#1a120c';
      ctx.fillRect(wx + 7, Y + 4, 2, 24);
      ctx.fillRect(wx, Y + 15, 16, 2);
      if (!day && !dusk) {
        ctx.fillStyle = '#e8e8ff';
        for (let k = 0; k < 4; k++) if (Math.sin(t * 2 + k * 3 + wx) > -0.3) ctx.fillRect(wx + 2 + ((k * 5) % 13), Y + 6 + ((k * 7) % 8), 1, 1);
      }
      // (Light falling in, by day.)
      if (day) {
        ctx.fillStyle = 'rgba(255,240,200,0.06)';
        ctx.beginPath();
        ctx.moveTo(wx, Y + 28);
        ctx.lineTo(wx + 16, Y + 28);
        ctx.lineTo(wx + 34, Y + PH);
        ctx.lineTo(wx + 12, Y + PH);
        ctx.fill();
      }
    }
    const cx = Math.round(X + PW / 2);
    const crowd = ch.vote === 'assembly';
    const facs = ch.vote === 'factions';
    const R = this.reveal;
    const tm = R ? this.revealTimes(R.vote) : null;
    const shown = R ? Math.max(0, Math.floor((R.t - 0.4) / tm.step) + 1) : 0;
    const tableY = Y + PH - 24;
    // The seated: you in the middle, the council either side.
    const seats = [];
    const look = this.game.player.look;
    seats.push({ you: true, look, name: T.holder.name, col: '#ffd070' });
    if (!crowd && !facs) {
      for (const c of T.council) {
        if (c.pid) seats.push({ pid: c.pid, name: c.name, look: this.playerLook(c.pid), col: '#a0e8ff' });
        else {
          const r = L.npcs[c.idx];
          if (r) seats.push({ idx: c.idx, name: r.name.first, look: r.look, col: (FACTIONS[this.facOf(L, c.idx)] || FACTIONS.crafters).color });
        }
      }
    }
    const n = seats.length;
    const sp = Math.min(46, (PW - 60) / Math.max(1, n));
    // The town's banners either side of the high chair, swaying a little.
    for (const side of [-1, 1]) {
      const bx = Math.round(cx + side * Math.max(20, sp / 2));
      const bw = 14;
      const sway = Math.sin(t * 1.3 + side) * 1.2;
      ctx.fillStyle = '#8a6a30';
      ctx.fillRect(bx - bw / 2 - 2, Y + 3, bw + 4, 2);
      ctx.fillStyle = ch.color;
      ctx.beginPath();
      ctx.moveTo(bx - bw / 2, Y + 5);
      ctx.lineTo(bx + bw / 2, Y + 5);
      ctx.lineTo(bx + bw / 2 + sway, Y + 30);
      ctx.lineTo(bx + sway, Y + 25);
      ctx.lineTo(bx - bw / 2 + sway, Y + 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(bx - bw / 2, Y + 5, 2, 22);
      drawText(ctx, ch.glyph, bx - 3 + Math.round(sway / 2), Y + 10, '#1a1420');
    }
    // (Left, right, left, right... out from the middle.)
    const xs = seats.map((st, i) => (i === 0 ? cx : cx + Math.ceil(i / 2) * sp * (i % 2 ? -1 : 1)));
    // The ballot each holds (the vote being shown, in the order cast).
    const vote = (st) => {
      if (!R || crowd || facs) return null;
      const bi = R.vote.ballots.findIndex((b) => (st.you ? b.you : st.pid ? b.pid === st.pid : b.idx === st.idx));
      if (bi < 0 || bi >= shown) return null;
      return { v: R.vote.ballots[bi].v, at: 0.4 + bi * tm.step };
    };
    seats.forEach((st, i) => {
      const px = Math.round(xs[i]);
      // A high-backed chair (the head's, gilt and taller).
      ctx.fillStyle = st.you ? '#a07a28' : '#4a2e18';
      ctx.fillRect(px - 9, tableY - (st.you ? 34 : 28), 18, st.you ? 34 : 28);
      ctx.fillStyle = st.you ? '#e8c050' : '#6a4424';
      ctx.fillRect(px - 9, tableY - (st.you ? 34 : 28), 18, 2);
      if (st.you) {
        ctx.fillStyle = '#ffe070';
        ctx.fillRect(px - 2, tableY - 38, 4, 4);
        ctx.fillRect(px - 9, tableY - 36, 2, 2);
        ctx.fillRect(px + 7, tableY - 36, 2, 2);
      }
      // Who sits there, as they look.
      if (st.look) {
        try {
          const sheet = humanoidSheet(st.look);
          ctx.drawImage(sheet, 4 * 16, 0, 16, SHEET_H, px - 8, tableY - 26, 16, SHEET_H);
        } catch {
          // (No look to draw: an empty chair.)
        }
      }
      // Their vote, held up over their head.
      const vb = vote(st);
      if (vb) {
        const up = Math.min(1, (R.t - vb.at) / 0.18);
        const hy = tableY - 36 - Math.round(up * 6) + (up >= 1 ? Math.round(Math.sin((R.t - vb.at) * 8) * 0.6) : 0);
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(px, hy + 8, 1, 8);
        ctx.fillStyle = vb.v === 1 ? '#2aa040' : vb.v === 0 ? '#c02a28' : '#5a5a60';
        ctx.fillRect(px - 5, hy - 1, 11, 10);
        ctx.fillStyle = vb.v === 1 ? '#5ad070' : vb.v === 0 ? '#f05048' : '#8a8a90';
        ctx.fillRect(px - 5, hy - 1, 11, 2);
        ctx.fillStyle = '#ffffff';
        if (vb.v === 1) for (const [dx, dy] of [[-3, 4], [-2, 5], [-1, 6], [0, 5], [1, 4], [2, 3], [3, 2]]) ctx.fillRect(px + dx, hy + dy, 1, 1);
        else if (vb.v === 0) for (let d = -2; d <= 2; d++) {
          ctx.fillRect(px + d, hy + 4 + d, 1, 1);
          ctx.fillRect(px + d, hy + 4 - d, 1, 1);
        }
      }
    });
    // The table, over their laps: its top, its front, the charter's
    // runner, a candle between each pair, nameplates.
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(X + 10, tableY, PW - 20, 3);
    ctx.fillStyle = '#5a3820';
    ctx.fillRect(X + 10, tableY + 3, PW - 20, PH);
    ctx.fillStyle = '#4a2c18';
    for (let px = X + 18; px < X + PW - 18; px += 30) ctx.fillRect(px, tableY + 6, 22, 12);
    ctx.fillStyle = ch.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(cx - 18, tableY + 1, 36, PH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < 36; k += 3) ctx.fillRect(cx - 18 + k, tableY + 19, 1, 3);
    seats.forEach((st, i) => {
      const px = Math.round(xs[i]);
      if (i) {
        // A brass nameplate.
        const nm = (st.name || '').slice(0, 7);
        const nw = nm.length * 6 + 4;
        ctx.fillStyle = '#b08a3a';
        ctx.fillRect(px - nw / 2, tableY + 6, nw, 9);
        ctx.fillStyle = '#e8c870';
        ctx.fillRect(px - nw / 2, tableY + 6, nw, 1);
        drawText(ctx, nm, px - nw / 2 + 2, tableY + 7, '#2a1a0a');
        ctx.fillStyle = st.col;
        ctx.fillRect(px - nw / 2, tableY + 15, nw, 1);
      }
    });
    // Candles, their light flickering on the wall.
    const sx = [...xs].sort((p, q) => p - q);
    for (let k = 0; k < n - 1; k++) {
      const lx = Math.round(i2x(sx, k));
      const fl = Math.sin(t * 9 + k * 2) > 0 ? 1 : 0;
      const glow = ctx.createRadialGradient(lx, tableY - 4, 1, lx, tableY - 4, 18);
      glow.addColorStop(0, 'rgba(255,210,120,0.22)');
      glow.addColorStop(1, 'rgba(255,210,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 18, tableY - 22, 36, 36);
      ctx.fillStyle = '#f0e8d0';
      ctx.fillRect(lx - 1, tableY - 4, 2, 4);
      ctx.fillStyle = fl ? '#ffe070' : '#ffb040';
      ctx.fillRect(lx - 1, tableY - 6 - fl, 2, 2);
    }
    // A moot: the town crowded before the table, each turning green or
    // red as they vote.
    if (crowd) {
      const ppl = R && R.vote.ballots.length > 1 ? R.vote.ballots.filter((b) => !b.you) : [];
      const total = ppl.length || Math.min(36, (T.counts ? Object.values(T.counts).reduce((p, q) => p + q, 0) : 20));
      for (let k = 0; k < Math.min(48, total); k++) {
        const col = k % 16;
        const row = Math.floor(k / 16);
        const hx = X + 16 + col * ((PW - 32) / 16) + (row % 2 ? 6 : 0);
        const hy = Y + PH - 8 + row * -5;
        const b = ppl[k];
        const on = R && b && k < shown;
        ctx.fillStyle = on ? (b.v === 1 ? '#3ac050' : '#d03a30') : b && b.f ? FACTIONS[b.f].color : '#a08870';
        ctx.fillRect(Math.round(hx), Math.round(hy), 4, 4);
        ctx.fillStyle = '#e8c8a0';
        ctx.fillRect(Math.round(hx) + 1, Math.round(hy) - 2, 2, 2);
      }
    }
    // A commune: each faction's banner, raised for, dipped against.
    if (facs) {
      const fs = R ? R.vote.ballots : FACTION_IDS.filter((f) => (T.counts || {})[f]).map((f) => ({ f, v: null }));
      fs.forEach((b, k) => {
        const fx = X + 44 + k * ((PW - 110) / Math.max(1, fs.length - 1 || 1));
        const on = R && k < shown;
        const lift = on ? (b.v === 1 ? -6 : 6) : 0;
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(Math.round(fx), Y + 8 + lift, 1, 30);
        ctx.fillStyle = FACTIONS[b.f].color;
        ctx.fillRect(Math.round(fx) + 1, Y + 8 + lift, 10, 9);
        drawText(ctx, FACTIONS[b.f].glyph, Math.round(fx) + 3, Y + 9 + lift, '#1a1420');
        if (on) drawText(ctx, b.v === 1 ? '✓' : '×', Math.round(fx) + 3, Y + 20 + lift, b.v === 1 ? '#70f090' : '#ff6050', '#000');
      });
    }
    // The seal comes down.
    if (R && R.t >= tm.done) {
      const k = Math.min(1, (R.t - tm.done) / 0.25);
      const st = R.vote.state;
      const wax = st === 'carried' ? '#b81e2c' : '#4a4a58';
      const size = 30 * (1.9 - 0.9 * k);
      const sx = X + PW - 30;
      const sy = Y + 22;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(sx + 2, sy + 3, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = wax;
      ctx.beginPath();
      for (let j = 0; j < 16; j++) {
        const ang = (j / 16) * Math.PI * 2;
        const r = size / 2 + (j % 2 ? 2 : -1) * (size / 30);
        ctx.lineTo(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = st === 'carried' ? '#d83040' : '#6a6a78';
      ctx.beginPath();
      ctx.arc(sx, sy, size * 0.34, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, st === 'carried' ? '✓' : '×', sx - 3, sy - 4, st === 'carried' ? '#ffd8b0' : '#d0d0e0');
      ctx.globalAlpha = 1;
      if (k < 1) {
        ctx.fillStyle = `rgba(255,240,200,${0.25 * (1 - k)})`;
        ctx.fillRect(X, Y, PW, PH);
      }
    }
    ctx.restore();
  }

  // Another player's look (the one they have now), for their seat.
  playerLook(pid) {
    const seat = seatOfPid(this.game, pid);
    if (!seat) return null;
    const p = seat === this.game.seat ? this.game.player : seat.ent;
    return p ? p.look : null;
  }

  facOf(L, idx) {
    const r = L.npcs[idx];
    if (!r) return 'crafters';
    const M = members(L);
    for (const f of FACTION_IDS) if (M[f].includes(r)) return f;
    return 'crafters';
  }

  // ------------------------------------------------------------ 2 treasury
  drawTreasury(g, L, T) {
    const e = L.econ;
    const sim = this.game.sim;
    const S = sums(sim, L, T);
    let y = BODY;
    g.text(2, y, `The treasury: ¤${Math.floor(e.treasury)}`, C.hi);
    y++;
    g.text(2, y, `The town should keep ¤${S.reserve} in hand.`, e.treasury < S.reserve ? '#ffa050' : C.dim);
    y += 1;
    this.chartArea = { x: 2, y, w: 38, h: 8 };
    g.text(2, y + 8, 'The treasury, sitting by sitting', C.faint);
    y += 10;
    const td = T.today || {};
    const count = (j) => residents(L).filter((r) => r.job === j).length;
    const wages = S.guards * (e.guardWage ?? 5) + count('mayor') * 8 + count('priest') * 3 + count('builder') * 4;
    const rows = [
      ['Taxes yesterday', `+¤${e.taxY || 0}`, '#a8e070'],
      ['To the realm', `-¤${e.tributeY || 0}`, '#ffa050'],
      ['Wages (a day)', `-¤${wages}`, '#ffa050'],
      ['Relief today', `-¤${(td.relief || 0) + (td.alms || 0)}`, '#ffa050'],
      ['Your pay', `-¤${td.stipend || 0}${T.purse ? ` (¤${T.purse} kept for you)` : ''}`, '#ffa050'],
    ];
    for (const [a, b, c] of rows) {
      g.text(3, y, a, C.dim);
      g.text(20, y, b, c);
      y++;
    }
    // The tax.
    const mine = this.mine();
    y = BODY;
    const x = 43;
    g.text(x, y++, 'Taxes', C.hi);
    const floor = S.floor;
    const cap = S.cap;
    if (this.taxDraft === null) this.taxDraft = e.tax;
    const draft = this.taxDraft;
    const btn = (bx, by, label, on, fn) => {
      const hov = on && this.hovering(bx, by, label.length, 1);
      g.text(bx, by, label, on ? (hov ? '#1a1420' : C.hi) : C.faint, on ? (hov ? C.hi : '#2a2236') : undefined);
      if (on) this.hit(bx, by, label.length, 1, fn);
    };
    btn(x, y, ' ◄ ', mine && draft > 0, () => {
      this.taxDraft = Math.max(0, Math.round((draft - 0.01) * 100) / 100);
    });
    g.text(x + 4, y, `${pc(draft)}`.padStart(4), draft !== e.tax ? C.white : C.fg);
    btn(x + 9, y, ' ► ', mine && draft < cap - 1e-9, () => {
      this.taxDraft = Math.min(cap, Math.round((draft + 0.01) * 100) / 100);
    });
    if (draft !== e.tax) btn(x + 14, y, ' Propose it ', mine, () => this.proposeIt(L, 'tax', draft));
    y++;
    g.text(x, y++, `now ${pc(e.tax)} · realm's least ${pc(floor)}${CHARTERS[T.charter].taxCap ? ` · most ${pc(cap)}` : ''}`, C.dim);
    if (draft !== e.tax) {
      const st = stated(sim, L, T, { fx: { tax: draft } }, CHARTERS, this.game.day);
      g.text(x, y, ((st.lines[0] && st.lines[0].text) || '').slice(0, W - x - 2), '#c8b890');
      factionDeltas(g, x, y + 1, st.by, T.counts);
      if (draft < floor - 1e-9) g.text(x, y + 2, 'Under the realm\'s least tax: defiance.', '#ff9070');
    } else g.text(x, y, '◄ ► to set a new rate, then propose it.', C.faint);
    y += 4;
    g.text(x, y++, 'Spending', C.hi);
    for (const id of BUDGET_IDS) {
      const B = BUDGET[id];
      const cur = T.budget[id] ?? 1;
      g.text(x, y, B.name, C.fg);
      let bx = x + 13;
      B.short.forEach((lv, k) => {
        const label = ` ${lv} `;
        const on = k === cur;
        const pending = T.agenda.some((q) => q.key === `budget:${id}` && !q.done && q.opts[0].fx.budget[id] === k);
        const can = mine && !on && !(T.charter === 'commune' && id === 'relief' && k < 1);
        const hov = can && this.hovering(bx, y, label.length, 1);
        if (hov) this.budgetHover = { id, k };
        g.text(bx, y, label, on ? '#1a1420' : pending ? '#a0c8ff' : hov ? C.white : C.dim, on ? '#c8a060' : hov ? '#3a3048' : pending ? '#203048' : '#1c1824');
        if (can) this.hit(bx, y, label.length, 1, () => this.proposeIt(L, 'budget', id, k));
        bx += label.length + 1;
      });
      y++;
      const lv = B.levels[cur];
      g.text(x + 1, y++, `${lv}: ${B.about}`.slice(0, W - x - 3), C.faint);
    }
    // What a change would do, pointed at.
    const bh = this.budgetHover;
    this.budgetHover = null;
    if (bh) {
      const st = stated(sim, L, T, { fx: { budget: { [bh.id]: bh.k } } }, CHARTERS, this.game.day);
      g.text(x, y + 1, `${BUDGET[bh.id].levels[bh.k]}:`, C.fg);
      factionDeltas(g, x, y + 2, st.by, T.counts);
    } else g.text(x, y + 1, mine ? 'Each change is put before the council.' : '', C.faint);
  }

  proposeIt(L, kind, a, b) {
    const r = this.office.propose(L, kind, a, b);
    if (!r.ok) return this.say(r.why, '#ffb080');
    this.say('Put before the council (page 1).', '#a0e8a0');
    this.sel = r.item.id;
    this.ui.audio?.play('page');
    this.taxDraft = null;
    return r;
  }

  // A chart of the treasury over the last sittings.
  drawTreasuryChart(ctx) {
    const T = this.T();
    const a = this.chartArea;
    if (!T || !a) return;
    const X = (this.x + a.x) * CHAR_W;
    const Y = (this.y + a.y) * CHAR_H;
    const PW = a.w * CHAR_W;
    const PH = a.h * CHAR_H;
    ctx.fillStyle = '#16121c';
    ctx.fillRect(X, Y, PW, PH);
    const h = T.hist;
    if (!h.length) return;
    const max = Math.max(50, ...h.map((q) => q.treasury));
    const bw = Math.max(3, Math.floor(PW / 21) - 2);
    h.forEach((q, i) => {
      const bh = Math.max(1, Math.round((q.treasury / max) * (PH - 6)));
      const bx = X + 3 + i * (bw + 2);
      ctx.fillStyle = i === h.length - 1 ? '#ffe070' : '#a88a40';
      ctx.fillRect(bx, Y + PH - 2 - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bx, Y + PH - 2 - bh, bw, 1);
    });
    ctx.fillStyle = '#5a5060';
    ctx.font = '6px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`¤${max}`, X + PW - 2, Y + 1);
  }

  // ------------------------------------------------------------ 3 laws
  drawLaws(g, L, T) {
    const s = L.settlement;
    const ids = LAW_IDS.filter((id) => lawFits(s, id, true) || lawOn(L, id));
    if (!this.lawSel || !ids.includes(this.lawSel)) this.lawSel = ids[0];
    let y = BODY;
    g.text(2, y, 'Law', C.dim);
    g.text(27, y, 'The town for it', C.dim);
    y++;
    for (const id of ids) {
      if (y >= H - 4) break;
      const law = LAWS[id];
      const on = lawOn(L, id);
      const dec = byDecree(L, id);
      const sel = this.lawSel === id;
      const hov = this.hovering(1, y, 46, 1);
      g.fill(1, y, 46, 1, ' ', C.fg, sel ? '#2c2438' : hov ? '#221c2a' : undefined);
      g.text(2, y, dec ? '♜' : on ? '■' : '□', dec ? '#ff9070' : on ? '#80e070' : C.faint);
      g.text(4, y, `${law.name}${law.draft ? ' ✎' : ''}`.slice(0, 22), on ? C.white : C.fg);
      const share = forChange(L, id, true);
      bar(g, 27, y, 12, share * 100, share >= 0.5 ? '#80b860' : '#b07850');
      g.text(40, y, `${Math.round(share * 100)}%`.padStart(4), C.dim);
      this.hit(1, y, 46, 1, () => {
        this.lawSel = id;
        this.ui.audio?.play('select');
      });
      y++;
    }
    g.text(2, H - 3, '■ in force   □ not   ♜ the realm\'s decree   ✎ only a governor can draft it', C.faint);
    for (let j = BODY; j < H - 3; j++) g.put(48, j, '│', '#3a3040');
    // The one looked at.
    const id = this.lawSel;
    if (!id) return;
    const law = LAWS[id];
    const on = lawOn(L, id);
    const dec = byDecree(L, id);
    const x = 50;
    let ry = BODY;
    g.text(x, ry++, law.name, C.hi);
    g.text(x, ry++, dec ? 'In force by the realm\'s decree.' : on ? 'In force.' : 'Not in force.', dec ? '#ff9070' : on ? '#80e070' : C.dim);
    ry++;
    for (const l of wrap(law.desc, W - x - 2)) g.text(x, ry++, l, C.fg);
    ry++;
    const st = stated(this.game.sim, L, T, { fx: { law: { id, on: !on } } }, CHARTERS, this.game.day);
    g.text(x, ry++, on ? 'Throwing it out would please:' : 'Passing it would please:', C.dim);
    const M = members(L);
    const sorted = FACTION_IDS.filter((f) => M[f].length).sort((a, b) => (st.by[b] || 0) - (st.by[a] || 0));
    for (const f of sorted) {
      const d = st.by[f] || 0;
      if (ry > H - 7) break;
      g.text(x + 1, ry, FACTIONS[f].glyph, FACTIONS[f].color);
      g.text(x + 3, ry, FACTIONS[f].name.slice(0, 18), C.fg);
      g.text(x + 22, ry++, d ? `${d > 0 ? '+' : ''}${d}` : '·', d > 0 ? '#80e070' : d < 0 ? '#ff7060' : C.faint);
    }
    if (this.mine() && !dec) {
      const pending = T.agenda.some((q) => q.key === `law:${id}` && !q.done);
      const label = pending ? ' Before the council already ' : on ? ' Propose throwing it out ' : ' Propose passing it ';
      const hov = !pending && this.hovering(x, H - 5, label.length, 1);
      g.text(x, H - 5, label, pending ? '#a0c8ff' : hov ? '#1a1420' : C.hi, pending ? '#203048' : hov ? C.hi : '#2a2236');
      if (!pending) this.hit(x, H - 5, label.length, 1, () => this.proposeIt(L, 'law', id));
    }
  }

  // ------------------------------------------------------------ 4 people
  drawPeople(g, L, T) {
    const M = members(L);
    const stances = factionStances(L, M, this.game.day);
    const state = townState(L, T);
    const A = this.office.approvals(L, T);
    const prev = T.hist.length > 1 ? T.hist[T.hist.length - 2].by : null;
    const ids = FACTION_IDS.filter((f) => M[f].length);
    if (!this.facSel || !ids.includes(this.facSel)) this.facSel = ids[0];
    let y = BODY;
    for (const f of ids) {
      const F = FACTIONS[f];
      const v = A.by[f].v;
      const sel = this.facSel === f;
      const hov = this.hovering(1, y, 46, 1);
      g.fill(1, y, 46, 1, ' ', C.fg, sel ? '#2c2438' : hov ? '#221c2a' : undefined);
      g.text(2, y, F.glyph, F.color);
      g.text(4, y, `${F.name} (${M[f].length})`.slice(0, 21), sel ? C.white : C.fg);
      bar(g, 26, y, 14, v, approvalColor(v));
      g.text(41, y, `${v}`.padStart(3), approvalColor(v));
      const p = prev && prev[f] !== undefined ? v - prev[f] : 0;
      if (p) g.text(44, y, p > 0 ? '▲' : '▼', p > 0 ? '#a8e070' : '#ffa050');
      this.hit(1, y, 46, 1, () => {
        this.facSel = f;
        this.ui.audio?.play('select');
      });
      y++;
    }
    // The town over the last weeks, below.
    this.moodArea = { x: 2, y: y + 2, w: 44, h: Math.min(9, H - 6 - y - 2) };
    g.text(2, y + 1, 'Approval, sitting by sitting', C.faint);
    for (let j = BODY; j < H - 3; j++) g.put(48, j, '│', '#3a3040');
    // The faction looked at: what they want, and why they think as they do.
    const f = this.facSel;
    const x = 50;
    let ry = BODY;
    const F = FACTIONS[f];
    g.text(x, ry++, `${F.glyph} ${F.name}`, F.color);
    for (const l of wrap(F.about, W - x - 2)) g.text(x, ry++, l, C.dim);
    ry++;
    g.text(x, ry++, 'They want', C.dim);
    for (const l of wrap(wish(L, T, f, state, M, stances), W - x - 3)) g.text(x + 1, ry++, l, C.white);
    ry++;
    g.text(x, ry++, 'Why they think as they do', C.dim);
    for (const w of A.by[f].why.slice(0, 5)) {
      const v = Math.round(w.v);
      if (!v || ry > H - 9) continue;
      g.text(x, ry, `${v > 0 ? '+' : ''}${v}`.padStart(3), v > 0 ? '#a8e070' : '#ff8060');
      for (const l of wrap(w.text, W - x - 6).slice(0, 2)) g.text(x + 4, ry++, l, C.fg);
    }
    // Promises made them.
    const pr = T.promises.filter((p) => p.f === f && (p.state === 'open' || this.game.day - p.made < 14));
    if (pr.length) {
      ry = Math.max(ry + 1, H - 8);
      g.text(x, ry++, 'Your promises to them', C.dim);
      for (const p of pr.slice(0, 2)) {
        g.text(x + 1, ry, p.text.slice(0, 20), C.fg);
        g.text(x + 22, ry++, p.state === 'open' ? `by day ${p.due}` : p.state, p.state === 'kept' ? '#80e070' : p.state === 'broken' ? '#ff7060' : '#e8d060');
      }
    }
  }

  drawMoodChart(ctx) {
    const T = this.T();
    const a = this.moodArea;
    if (!T || !a) return;
    const X = (this.x + a.x) * CHAR_W;
    const Y = (this.y + a.y) * CHAR_H;
    const PW = a.w * CHAR_W;
    const PH = a.h * CHAR_H;
    ctx.fillStyle = '#16121c';
    ctx.fillRect(X, Y, PW, PH);
    // Bands: the danger below 30, the comfort above 60.
    ctx.fillStyle = 'rgba(255,80,60,0.12)';
    ctx.fillRect(X, Y + PH * 0.7, PW, PH * 0.3);
    ctx.fillStyle = 'rgba(120,240,140,0.08)';
    ctx.fillRect(X, Y, PW, PH * 0.4);
    const h = T.hist;
    if (h.length < 1) return;
    const px = (i) => X + 2 + (i / Math.max(1, 20)) * (PW - 4);
    const py = (v) => Y + PH - 2 - (v / 100) * (PH - 4);
    // Each faction, faint.
    for (const f of FACTION_IDS) {
      if (!(T.counts || {})[f]) continue;
      ctx.strokeStyle = FACTIONS[f].color;
      ctx.globalAlpha = f === this.facSel ? 0.9 : 0.28;
      ctx.lineWidth = 1;
      ctx.beginPath();
      h.forEach((q, i) => {
        const v = q.by ? q.by[f] ?? 50 : 50;
        if (i) ctx.lineTo(px(i) + 0.5, py(v) + 0.5);
        else ctx.moveTo(px(i) + 0.5, py(v) + 0.5);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // The town as a whole, bold.
    ctx.strokeStyle = '#ffe070';
    ctx.lineWidth = 2;
    ctx.beginPath();
    h.forEach((q, i) => {
      if (i) ctx.lineTo(px(i), py(q.overall));
      else ctx.moveTo(px(i), py(q.overall));
    });
    ctx.stroke();
    const last = h[h.length - 1];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px(h.length - 1) - 1, py(last.overall) - 1, 3, 3);
  }

  // ------------------------------------------------------------ 5 officers
  // A row of sub-views at the top of a page; the one shown.
  subtabs(g, list, key, def) {
    let x = 2;
    const cur = this[key] && list.some((q) => q[0] === this[key]) ? this[key] : def;
    for (const [id, label] of list) {
      const lb = ` ${label} `;
      const on = id === cur;
      const hov = !on && this.hovering(x, BODY, lb.length, 1);
      g.text(x, BODY, lb, on ? C.white : hov ? C.fg : C.dim, on ? '#3a3048' : hov ? '#2a2236' : undefined);
      if (on) for (let i = 0; i < lb.length; i++) g.put(x + i, BODY + 1, '▀', '#c8a060');
      this.hit(x, BODY, lb.length, 1, () => {
        this[key] = id;
        this.ui.audio?.play('select');
      });
      x += lb.length + 2;
    }
    return cur;
  }

  drawOfficers(g, L, T) {
    const mine = this.mine();
    const view = this.subtabs(g, [['people', 'Officers and council'], ['orders', 'Standing orders']], 'oview', 'people');
    if (view === 'orders') return this.drawOrders(g, L, T, mine);
    let y = BODY + 3;
    for (const k of OFFICE_IDS) {
      const O = OFFICES[k];
      const r = this.office.officer(L, T, k);
      const sel = this.officeSel === k;
      const hov = mine && this.hovering(1, y, 48, 2);
      g.fill(1, y, 48, 2, ' ', C.fg, sel ? '#2c2438' : hov ? '#221c2a' : undefined);
      g.text(2, y, O.name, C.fg);
      if (r) {
        const f = this.facOf(L, r.idx);
        g.text(24, y, FACTIONS[f].glyph, FACTIONS[f].color);
        g.text(26, y, full(r).slice(0, 19), C.white);
        const loy = T.loyal[r.idx];
        if (loy !== undefined) g.text(46, y, loy > 0 ? '♥' : '♡', loy >= 30 ? '#ff80a0' : loy >= 0 ? '#c08090' : '#606060');
      } else g.text(24, y, '(nobody)', C.faint);
      g.text(3, y + 1, O.short, sel ? '#c8b890' : C.faint);
      if (mine) this.hit(1, y, 48, 2, () => {
        this.officeSel = sel ? null : k;
        this.ui.audio?.play('select');
      });
      y += 2;
    }
    y++;
    // The council's seats.
    const ch = CHARTERS[T.charter];
    g.text(2, y++, ch.seats ? `The council (${T.council.length} of ${ch.seats} seats)` : `${ch.name}: no council seats`, C.hi);
    for (const c of T.council) {
      if (c.pid) {
        g.text(3, y, '☺', '#a0e8ff');
        g.text(5, y, `${c.name} (a player)`, '#a0e8ff');
        if (mine) {
          const lb = ' unseat ';
          const hov = this.hovering(40, y, lb.length, 1);
          g.text(40, y, lb, hov ? C.white : C.dim, hov ? '#4a2a30' : undefined);
          this.hit(40, y, lb.length, 1, () => this.office.unseatPlayer(L, c.pid));
        }
      } else {
        const r = L.npcs[c.idx];
        if (!r) continue;
        const f = this.facOf(L, c.idx);
        g.text(3, y, FACTIONS[f].glyph, FACTIONS[f].color);
        g.text(5, y, `${full(r)}, ${FACTIONS[f].name.toLowerCase()}`.slice(0, 34), C.fg);
        const loy = T.loyal[c.idx];
        g.text(41, y, loy === undefined ? '' : loy >= 30 ? 'loyal' : loy >= 0 ? 'fair' : 'hostile', loy >= 30 ? '#80e070' : loy >= 0 ? C.dim : '#ff8060');
      }
      y++;
    }
    // Fellow players who could sit.
    if (mine && ch.seats) {
      for (const p of this.citizensPlaying(L, T).slice(0, 2)) {
        const lb = ` Seat ${p.name} on the council `;
        const hov = this.hovering(3, y, lb.length, 1);
        g.text(3, y, lb, hov ? '#1a1420' : '#a0e8ff', hov ? '#a0e8ff' : '#1c2a34');
        this.hit(3, y, lb.length, 1, () => {
          const r = this.office.seatPlayer(L, p.pid, p.name);
          this.say(r.ok ? `${p.name} has a seat.` : r.why, r.ok ? '#a0e8a0' : '#ffb080');
        });
        y++;
      }
    }
    for (let j = BODY + 2; j < H - 3; j++) g.put(50, j, '│', '#3a3040');
    // Right: someone to name.
    const x = 52;
    let ry = BODY + 3;
    if (!this.officeSel || !mine) {
      wrap(mine ? 'Choose an office on the left to name someone to it.' : 'The town\'s officers and its council.', W - x - 2).forEach((l) => g.text(x, ry++, l, C.faint));
      return;
    }
    {
      const k = this.officeSel;
      g.text(x, ry++, `Name a ${OFFICES[k].name.toLowerCase()}`, C.hi);
      wrap(OFFICES[k].about, W - x - 2).slice(0, 3).forEach((l) => g.text(x, ry++, l, C.faint));
      ry++;
      const cur = this.office.officer(L, T, k);
      for (const c of this.office.candidates(L, k).slice(0, 10)) {
        const r = c.r;
        const f = this.facOf(L, r.idx);
        const hov = this.hovering(x, ry, W - x - 2, 1);
        g.fill(x, ry, W - x - 2, 1, ' ', C.fg, r === cur ? '#203a28' : hov ? '#30283c' : undefined);
        g.text(x, ry, FACTIONS[f].glyph, FACTIONS[f].color);
        g.text(x + 2, ry, full(r).slice(0, 17), r === cur ? '#a0f0b0' : C.fg);
        g.text(x + 20, ry, this.trait(k, r).slice(0, W - x - 22), C.dim);
        if (r !== cur) this.hit(x, ry, W - x - 2, 1, () => {
          this.office.appoint(L, k, r.idx);
          this.say(`${full(r)} is ${OFFICES[k].name.toLowerCase()} now.`, '#a0e8a0');
          this.ui.audio?.play('chime');
        });
        ry++;
      }
      if (cur && k !== 'steward') {
        const lb = ` Dismiss ${cur.name.first} `;
        const hov = this.hovering(x, ry + 1, lb.length, 1);
        g.text(x, ry + 1, lb, hov ? C.white : C.dim, hov ? '#4a2a30' : '#2a1c20');
        this.hit(x, ry + 1, lb.length, 1, () => this.office.dismiss(L, k));
      }
      return;
    }
  }

  drawOrders(g, L, T, mine) {
    const x = 4;
    let ry = BODY + 3;
    g.text(x, ry++, 'What your steward does with whatever you leave undecided by the next sitting:', C.dim);
    ry++;
    for (const k of ORDER_IDS) {
      const O = ORDERS[k];
      g.text(x, ry, O.name, C.fg);
      let bx = x + 20;
      let long = '';
      for (const [v, desc, short] of O.opts) {
        const lb = ` ${short} `;
        const on = T.orders[k] === v;
        const hov = this.hovering(bx, ry, lb.length, 1);
        if (on) long = desc;
        g.text(bx, ry, lb, on ? '#1a1420' : hov && mine ? C.white : C.dim, on ? '#c8a060' : hov && mine ? '#3a3048' : '#1c1824');
        if (mine && !on) this.hit(bx, ry, lb.length, 1, () => {
          this.office.setOrder(L, k, v);
          this.ui.audio?.play('select');
        });
        bx += lb.length + 1;
      }
      g.text(Math.max(bx + 2, 56), ry, long.slice(0, W - Math.max(bx + 2, 56) - 2), C.faint);
      ry += 2;
    }
  }

  trait(k, r) {
    const P = r.personality || {};
    if (k === 'steward') return (P.diligence ?? 0.5) > 0.65 ? 'diligent' : (P.diligence ?? 0.5) < 0.3 ? 'careless' : 'steady';
    if (k === 'captain') return (P.bravery ?? 0.5) > 0.7 ? 'bold' : 'steady';
    if (k === 'treasurer') return `${(r.skills?.trading || 0) > 0.5 ? 'shrewd' : 'plain'}${(P.kindness ?? 0.5) < 0.3 ? ', sly' : ''}`;
    if (k === 'magistrate') return (P.temper ?? 0.5) > 0.6 || (P.kindness ?? 0.5) < 0.4 ? 'stern' : 'lenient';
    return '';
  }

  // Other players, citizens of this town, who could take a council seat.
  citizensPlaying(L, T) {
    const game = this.game;
    if (!game.seats || game.seats.length < 2) return [];
    const out = [];
    for (const seat of game.seats) {
      const pid = seat.host ? 'host' : String(seat.id);
      if (pid === T.holder.pid || T.council.some((c) => c.pid === pid)) continue;
      const cz = seatPart(game, seat, 's', 'citizen');
      if (cz && cz.sid === this.sid) out.push({ pid, name: seat.name });
    }
    return out;
  }

  // ------------------------------------------------------------ 6 charter
  drawCharter(g, L, T) {
    const choosing = !!T.chooseCharter && this.mine();
    const view = choosing ? 'charter' : this.subtabs(g, [['charter', 'Charter'], ['realm', 'The realm'], ['goals', 'Ambitions']], 'view', 'charter');
    if (view === 'realm') return this.drawRealm(g, L, T);
    if (view === 'goals') return this.drawAmbitions(g, L, T);
    let y = BODY + 3;
    g.text(2, y++, choosing ? 'Write your village\'s charter:' : 'How the town is governed:', choosing ? C.hi : C.dim);
    y++;
    const look = this.charterSel && CHARTERS[this.charterSel] ? this.charterSel : T.charter;
    for (const id of CHARTER_IDS) {
      const c = CHARTERS[id];
      const on = id === T.charter;
      const sel = id === look;
      const fits = charterFits(L, id);
      const hov = this.hovering(1, y, 30, 1);
      g.fill(1, y, 30, 1, ' ', C.fg, sel ? '#2c2438' : hov ? '#221c2a' : undefined);
      g.text(2, y, c.glyph, fits ? c.color : C.faint);
      g.text(4, y, c.name, on ? c.color : fits ? C.fg : C.faint);
      if (on) g.text(24, y, 'now', c.color);
      this.hit(1, y, 30, 1, () => {
        this.charterSel = id;
        this.ui.audio?.play('select');
      });
      y++;
    }
    for (let j = BODY + 2; j < H - 3; j++) g.put(32, j, '│', '#3a3040');
    // The one looked at.
    const c = CHARTERS[look];
    const x = 34;
    let ry = BODY + 3;
    g.text(x, ry++, `${c.glyph} ${c.name}`, c.color);
    ry++;
    for (const rule of c.rules) for (const l of wrap(rule, W - x - 2)) if (ry < H - 9) g.text(x, ry++, l, C.fg);
    ry++;
    const likes = FACTION_IDS.filter((f) => c.mod[f]).sort((a, b) => c.mod[b] - c.mod[a]);
    if (likes.length) {
      g.text(x, ry++, 'Who it pleases:', C.dim);
      whoMoves(g, x + 1, ry++, Object.fromEntries(likes.map((f) => [f, c.mod[f]])), W - x - 3);
    }
    const by = H - 6;
    if (this.mine()) {
      if (look === T.charter) g.text(x, by, choosing ? 'As it stands.' : 'The town\'s charter now.', C.faint);
      else if (!charterFits(L, look)) g.text(x, by, 'Needs a temple and a priest.', C.faint);
      else {
        const pending = T.agenda.some((q) => q.key === 'charter' && !q.done && q.opts[0].fx.charter === look);
        const lb = choosing ? ' Choose this charter ' : pending ? ' Before the council ' : ' Propose it (two in three) ';
        const hov = !pending && this.hovering(x, by, lb.length, 1);
        g.text(x, by, lb, pending ? '#a0c8ff' : hov ? '#1a1420' : C.hi, pending ? '#203048' : hov ? C.hi : '#2a2236');
        if (!pending) this.hit(x, by, lb.length, 1, () => {
          if (choosing) {
            this.office.chooseCharter(L, look);
            this.say(`${L.settlement.name} is to be governed as ${c.short}.`, c.color);
            this.ui.audio?.play('fanfare');
          } else this.proposeIt(L, 'charter', look);
        });
      }
    }
    // Stepping down; who came before.
    if (this.mine() && !choosing) {
      const sy = H - 4;
      const lb = this.confirm === 'step' ? ' Really step down? Click again ' : ' Step down ';
      const hov = this.hovering(2, sy, lb.length, 1);
      g.text(2, sy, lb, hov ? C.white : '#c08080', hov ? '#6a2a30' : '#2a1c20');
      this.hit(2, sy, lb.length, 1, () => {
        if (this.confirm === 'step') {
          this.office.stepDown(L);
          this.close();
        } else this.confirm = 'step';
      });
      const h = T.holder;
      const term = h.termEnd ? `Your term runs to day ${h.termEnd}.` : h.how === 'appointment' ? 'You serve at the realm\'s pleasure.' : 'You have no fixed term.';
      g.text(2, sy - 1, term, C.faint);
    }
  }

  // The town's realm: its decrees and where the town stands with them,
  // petitions, its council, the throne, breaking away.
  drawRealm(g, L, T) {
    const s = L.settlement;
    const civ = s.civ;
    const sim = this.game.sim;
    const crown = sim.crown;
    let y = BODY + 3;
    const mine = this.mine();
    const btn = (x, yy, label, col, fn, on = true) => {
      const hov = on && this.hovering(x, yy, label.length, 1);
      g.text(x, yy, label, on ? (hov ? '#1a1420' : col) : C.faint, on ? (hov ? col : '#221c2a') : undefined);
      if (on) this.hit(x, yy, label.length, 1, fn);
      return x + label.length + 1;
    };
    if (!civ) {
      g.text(2, y, `${s.name} answers to no realm.`, C.fg);
      return;
    }
    const realms = sim.realms;
    const R = realms.realm(civ);
    const ruler = realms.rulerName(civ);
    g.text(2, y++, civ.name, '#a0c8ff');
    const yours = crown && crown.isRuler(civ, this.office.pid());
    for (const l of wrap(yours ? 'You rule it.' : `Ruled by ${ruler || authority(civ)}${R.head ? ' (a player)' : ''}, from ${realms.capitalOf(civ)?.name || '?'}.`, 46).slice(0, 2)) g.text(2, y++, l, C.dim);
    if (yours) {
      y++;
      btn(2, y, ' ★ Open the crown ', '#ffd070', () => this.ui.openCrown?.(this.game, civ));
      return;
    }
    y++;
    g.text(2, y++, 'Its decrees, and the town', C.hi);
    const floor = R.decrees.taxFloor || 0;
    const below = L.econ.tax < floor - 1e-9;
    g.text(3, y, `Least tax ${pc(floor)}`, C.fg);
    g.text(24, y++, below ? (T.defy.taxFloor !== undefined ? '× defied' : '× the town falls short') : '✓ met', below ? '#ff8060' : '#80e070');
    g.text(3, y++, `Weapons ban: ${R.decrees.armsBan ? 'in every town' : 'none'}`, C.fg);
    if ((T.defyLevel || 0) > 0) g.text(3, y++, `The realm's patience: ${['', 'a warning sent', 'the town fined', 'an ultimatum'][Math.min(3, T.defyLevel)]}`, '#ff9070');
    y++;
    // Petitions.
    g.text(2, y++, R.head ? `Petition ${ruler}` : 'Petition the realm', C.hi);
    const P = [['aid', 'Aid'], ['floor', 'A lower least tax'], ['tribute', 'Less tribute'], ['road', 'A road to the capital']];
    let px = 3;
    for (const [k, label] of P) {
      const last = T.petitions[k];
      const wait = k === 'floor' ? 14 : 7;
      const ready = last === undefined || this.game.day - last >= wait;
      px = btn(px, y, ` ${label} `, C.fg, () => {
        const r = this.office.petition(L, k);
        this.say(r.ok ? r.text : r.why, r.granted ? '#a0e8a0' : r.pending ? '#a0c8ff' : '#ffb080');
        this.ui.audio?.play(r.granted ? 'chime' : 'page');
      }, mine && ready);
    }
    y += 2;
    // The realm's council, and its throne.
    if (formOf(civ) === 'council') {
      if (T.realm.seat) {
        g.text(2, y++, '✦ You sit on the realm\'s council.', '#a0e8ff');
        if (mine && !R.head) btn(3, y++, ' Stand for speaker ', '#a0e8ff', () => {
          const r = crown.standForSpeaker(civ);
          this.say(!r.ok ? r.why : r.won ? `The council chose you (${r.aye} to ${r.nay})!` : `The council would not have you (${r.aye} to ${r.nay}).`, r.won ? '#ffe070' : '#ffb080');
        });
      } else if (T.realm.offered && mine) {
        btn(2, y++, ' Take the seat on the realm\'s council ', '#a0e8ff', () => {
          const r = this.office.takeRealmSeat(L);
          this.say(r.ok ? 'You sit on the realm\'s council.' : r.why, '#a0e8ff');
        });
      } else g.text(2, y++, 'Its council seats a town\'s head the town thinks well of.', C.faint);
    }
    if (crown && crown.heirs[civ.id] && crown.heirs[civ.id].pid === this.office.pid()) g.text(2, y++, `★ You are heir to the ${civ.name.replace(/^The /, '')}.`, '#ffe070');
    if (mine && crown && realms.isCapital(s) && !R.head) {
      const t = crown.canUsurp(civ);
      btn(2, y++, ' Seize the throne ', '#ff9a7a', () => {
        const r = crown.usurp(civ);
        this.say(r.ok ? 'The throne is yours.' : r.why, r.ok ? '#ffe070' : '#ffb080');
      }, t.ok);
      if (!t.ok) g.text(3, y++, t.why.slice(0, 46), C.faint);
    }
    // Breaking away.
    if (mine && !realms.isCapital(s)) {
      y++;
      const pending = T.agenda.some((q) => q.key === 'secede' && !q.done);
      btn(2, y++, pending ? ' Breaking away is before the council ' : ' Propose breaking away ', '#ff9a7a', () => this.proposeIt(L, 'secede'), !pending);
      const sup = sim.realms.support(L);
      g.text(3, y++, `The town ${sup > 0.15 ? 'is keen to go it alone' : sup > -0.1 ? 'is torn about going it alone' : 'wants to stay in the realm'}.`, C.faint);
    }
  }

  drawAmbitions(g, L, T) {
    let y = BODY + 3;
    for (const go of this.office.goals(L, T)) {
      g.text(4, y, go.done ? '★' : '☆', go.done ? '#ffe070' : C.dim);
      g.text(6, y, go.name.slice(0, 50), go.done ? '#ffe070' : C.fg);
      if (!go.done) bar(g, 58, y, 20, go.v * 100, '#c8a060');
      else g.text(58, y, 'realised', '#c8a060');
      y += 2;
    }
  }

  // ------------------------------------------------------------ keys
  onKey(k) {
    if (k.code === 'Escape' || k.code === 'KeyN') {
      if (this.reveal) {
        this.reveal = null;
        return true;
      }
      this.close();
      return true;
    }
    if (this.reveal) {
      if (k.code === 'Enter' || k.code === 'Space') this.endReveal();
      return true;
    }
    const n = parseInt((k.code.match(/^Digit(\d)$/) || [])[1], 10);
    const L = this.L();
    const T = this.T();
    if (!T || !L) return true;
    if (this.tab === 'sitting' && this.mine()) {
      const items = this.items(T);
      const i = items.findIndex((q) => q.id === this.sel);
      if (k.code === 'ArrowDown' || k.code === 'KeyS') {
        if (items[i + 1]) this.sel = items[i + 1].id;
        return true;
      }
      if (k.code === 'ArrowUp' || k.code === 'KeyW') {
        if (i > 0) this.sel = items[i - 1].id;
        return true;
      }
      // (With a matter open, the digits choose among its choices; Shift
      // and a digit, the pages.)
      const it = items[i];
      if (n >= 1 && it && !k.shift && it.state === 'open' && it.opts[n - 1]) {
        this.choose(L, T, it, n - 1);
        return true;
      }
      if (k.code === 'Enter' && it && it.state === 'open') {
        const j = it.opts.findIndex((o, q) => !o.off && !it.struck.includes(q));
        if (j >= 0) this.choose(L, T, it, j);
        return true;
      }
    }
    if (n >= 1 && n <= TABS.length) {
      this.goTab(TABS[n - 1].id);
      return true;
    }
    if (k.code === 'Tab' || k.code === 'ArrowRight') {
      const j = TABS.findIndex((q) => q.id === this.tab);
      this.goTab(TABS[(j + 1) % TABS.length].id);
      return true;
    }
    if (k.code === 'ArrowLeft') {
      const j = TABS.findIndex((q) => q.id === this.tab);
      this.goTab(TABS[(j + TABS.length - 1) % TABS.length].id);
      return true;
    }
    return true;
  }
}

function residents(L) {
  return L.npcs.filter((r) => r.alive !== false && !r.away && !r.migrated && !r.visitor);
}

export { seatOfPid };
