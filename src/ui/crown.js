// (Round 122) The crown window: ruling a realm (see sim/crown.js). Five
// pages, one a key:
//   1 Matters: what's before the crown this morning (a crisis first, with
//     its hours left), each choice and how the realm's towns would take
//     it; decide one and it's decreed (a monarch's word), or put to the
//     realm's vote (its council, its moot, its league), watched in the
//     throne room below.
//   2 Decrees: the least tax, the tribute, the weapons ban, the watch, the
//     draft, tariffs: each a row of choices, what the realm would think.
//   3 Towns: each town's loyalty and why; aid, a road, lighter tribute;
//     the heads of its towns, fellow players among them (raise one to a
//     lordship, depose them, offer a town no one governs to a player).
//   4 Court: the realm's form of government (reform it), your title, your
//     heir, the chancellor's standing orders, pardons (round 140: the
//     others playing, pardoned in every town of the realm), the chronicle.
//   5 Realms: its neighbours: war, peace, alliances.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { drawText } from '../render/font.js';
import { humanoidSheet, SHEET_H } from '../render/sprites.js';
import { CHAR_W, CHAR_H } from '../config.js';
import { REALM_FORMS, FORM_IDS } from '../sim/realmforms.js';
import { WATCHES, DRAFTS, CROWN_ORDERS, CROWN_ORDER_IDS, FLOOR_MAX, SHARE_MIN, SHARE_MAX } from '../sim/crown.js';
import { slider, button, drawRecord, wheelRecord, drawWar } from './govkit.js';
import { shortTitle } from '../sim/realms.js';
import { seatOfPid } from '../sim/saga/refs.js';
import { approvalColor, whoMoves } from './council.js';

const TABS = [
  { id: 'matters', label: 'Matters' },
  { id: 'decrees', label: 'Decrees' },
  { id: 'towns', label: 'Towns' },
  { id: 'court', label: 'Court' },
  { id: 'realms', label: 'Realms' },
  { id: 'war', label: 'War' },
  { id: 'record', label: 'Record' },
];
const W = 84;
const H = 34;
const BODY = 5;
const HALL_Y = 22;
const HALL_H = 9;
const BG = '#0e0c12';
const pc = (v) => `${Math.round(v * 100)}%`;
const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
const plain = (civ) => (civ ? civ.name.replace(/^The /, '') : 'realm');
// A realm's heartland, for short: "Glowmere" of the "Dominion of Glowmere".
const placeOf = (civ) => {
  const n = civ.name.replace(/^The /, '');
  const m = / of (.+)$/.exec(n);
  return m ? m[1] : n.split(' ')[0];
};
const full = (r) => (r && r.name ? `${r.name.first} ${r.name.last}` : 'someone');

function bar(g, x, y, w, v, col, back = '#2a2432') {
  const n = Math.round((Math.max(0, Math.min(100, v)) / 100) * w * 2);
  for (let i = 0; i < w; i++) {
    const k = n - i * 2;
    if (k >= 2) g.put(x + i, y, ' ', col, col);
    else if (k === 1) g.put(x + i, y, '▌', col, back);
    else g.put(x + i, y, ' ', col, back);
  }
}

export class CrownWindow extends Window {
  constructor(ui, civId, tab = 'matters') {
    super(ui, W, H, { kind: 'crown', x: 0, y: 1 });
    this.civId = civId;
    this.tab = tab;
    this.sel = null;
    this.townSel = null;
    this.realmSel = null;
    this.formSel = null;
    this.view = {};
    this.reveal = null;
    this.confirm = null;
    this.t = 0;
    this.cache = new Map();
    this.flash = null;
    this.game = ui.game || null;
  }

  get crown() {
    return this.game.sim.crown;
  }

  civ() {
    return this.game.world.ow.civs[this.civId] || null;
  }

  C() {
    const civ = this.civ();
    return civ ? this.crown.of(civ) : null;
  }

  mine() {
    const civ = this.civ();
    return !!civ && this.crown.isRuler(civ);
  }

  update(dt) {
    this.t += dt;
    if (this.reveal) this.reveal.t += dt;
    if (this.flash) this.flash.t += dt;
  }

  say(text, color = C.hi) {
    this.flash = { text, color, t: 0 };
  }

  // A thing worked out once a second (the realm's reckoning isn't free).
  kept(key, fn) {
    const c = this.cache.get(key);
    if (c && this.t - c.t < 1) return c.v;
    const v = fn();
    this.cache.set(key, { t: this.t, v });
    return v;
  }

  btn(g, x, y, label, col, fn, on = true) {
    const hov = on && this.hovering(x, y, label.length, 1);
    g.text(x, y, label, on ? (hov ? '#1a1420' : col) : C.faint, on ? (hov ? col : '#221c2a') : undefined);
    if (on) this.hit(x, y, label.length, 1, fn);
    return x + label.length + 1;
  }

  // A row of choices, the one that stands lit.
  pills(g, x, y, list, cur, fn, on = true, hover = null) {
    for (const [v, label, off] of list) {
      const now = v === cur;
      const can = on && !now && !off;
      const hov = can && this.hovering(x, y, label.length + 2, 1);
      if (hov && hover) hover(v);
      g.text(x, y, ` ${label} `, now ? '#1a1420' : off ? '#4a4450' : hov ? C.white : C.fg, now ? '#ffd070' : hov ? '#3a3048' : '#221c2a');
      if (can) this.hit(x, y, label.length + 2, 1, () => fn(v));
      x += label.length + 3;
    }
    return x;
  }

  subtabs(g, list, key, def) {
    let x = 2;
    const cur = this.view[key] || def;
    for (const [id, label] of list) {
      const on = id === cur;
      const hov = !on && this.hovering(x, BODY, label.length + 2, 1);
      g.text(x, BODY, ` ${label} `, on ? C.white : hov ? C.fg : C.dim, on ? '#3a3048' : hov ? '#2a2236' : undefined);
      if (!on) this.hit(x, BODY, label.length + 2, 1, () => {
        this.view[key] = id;
        this.confirm = null;
      });
      x += label.length + 3;
    }
    return cur;
  }

  draw(g, game) {
    this.game = game;
    const civ = this.civ();
    const C0 = this.C();
    g.fill(0, 0, this.w, this.h, ' ', C.fg, BG);
    if (!civ || !C0 || !this.mine()) {
      g.box(0, 0, this.w, this.h, { bg: BG, double: true, title: 'THE CROWN' });
      g.center(10, 'This crown is not yours.', C.dim);
      g.center(12, 'Esc: close', C.faint);
      return;
    }
    const R = game.sim.realms.realm(civ);
    const F = REALM_FORMS[R.form] || REALM_FORMS.monarchy;
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, fg: F.color, title: `${F.glyph} THE ${plain(civ).toUpperCase()} ${F.glyph}`, titleFg: F.color });
    this.header(g, civ, R, C0, F);
    this.tabs(g, C0, F);
    const fn = { matters: this.drawMatters, decrees: this.drawDecrees, towns: this.drawTowns, court: this.drawCourt, realms: this.drawRealms, war: this.drawWarPage, record: this.drawRecordPage }[this.tab];
    fn.call(this, g, civ, R, C0, F);
    if (this.flash && this.flash.t < 4) {
      const text = ` ${this.flash.text} `.slice(0, W - 4);
      g.text(Math.floor((W - text.length) / 2), H - 2, text, this.flash.color, 'rgba(20,16,28,0.95)');
    } else g.text(2, H - 2, '1-7: pages   ↑↓: choose   Enter: decide   Esc: close', C.faint);
  }

  header(g, civ, R, C0, F) {
    const sim = this.game.sim;
    g.text(2, 1, `${shortTitle(civ)} ${R.headName || ''}`.slice(0, 30), C.hi);
    const capL = this.crown.capitalL(civ);
    const tr = `coffers ¤${capL ? Math.floor(capL.econ.treasury) : 0} · tribute ${pc(R.share)}`;
    let rx = W - 2;
    // (Governing a town too: its council, a click away.)
    const T = sim.office.heldBy(sim.office.pid());
    if (T) {
      const lb = ' ♦ Your town ';
      rx -= lb.length;
      const hov = this.hovering(rx, 1, lb.length, 1);
      g.text(rx, 1, lb, hov ? '#1a1420' : '#e8c070', hov ? '#e8c070' : '#2a2236');
      this.hit(rx, 1, lb.length, 1, () => this.ui.openCouncil?.(this.game, T.sid));
      rx -= 2;
    }
    g.text(rx - tr.length, 1, tr, '#e8d8a0');
    const v = C0.lastOverall ?? 50;
    const prev = C0.hist.length > 1 ? C0.hist[C0.hist.length - 2].overall : v;
    g.text(2, 2, 'Loyalty', C.dim);
    bar(g, 10, 2, 20, v, approvalColor(v));
    g.text(31, 2, `${v}`, approvalColor(v));
    if (v !== prev) g.text(34, 2, v > prev ? `▲${v - prev}` : `▼${prev - v}`, v > prev ? '#a8e070' : '#ffa050');
    const term = C0.holder.termEnd ? ` · term ends day ${C0.holder.termEnd}` : '';
    const abs = sim.abs;
    const next = (Math.floor(abs / 1440) + (abs % 1440 < 600 ? 0 : 1)) * 1440 + 600;
    const left = next - abs;
    const nx = `${F.name}${term} · sits in ${Math.floor(left / 60)}h${String(Math.floor(left % 60)).padStart(2, '0')}`;
    g.text(W - 2 - nx.length, 2, nx, C.faint);
  }

  tabs(g, C0, F) {
    let x = 2;
    const open = C0.agenda.filter((q) => !q.done && q.state === 'open').length;
    const crisis = C0.agenda.some((q) => q.crisis && !q.done && q.state === 'open');
    TABS.forEach((tb, i) => {
      const badge = tb.id === 'matters' && open ? ` ${open}` : '';
      const label = ` ${i + 1}·${tb.label}${badge} `;
      const on = this.tab === tb.id;
      const hov = this.hovering(x, 3, label.length, 1);
      const alarm = tb.id === 'matters' && crisis && Math.floor(this.t * 3) % 2;
      g.text(x, 3, label, on ? '#1a1420' : alarm ? '#ffd0c0' : hov ? C.white : C.fg, on ? F.color : alarm ? '#802020' : hov ? '#3a3048' : '#221c2a');
      this.hit(x, 3, label.length, 1, () => this.goTab(tb.id));
      x += label.length + 1;
    });
    for (let i = 1; i < W - 1; i++) g.put(i, 4, '─', '#4a4050');
  }

  goTab(id) {
    // (Round 125: a vote being shown doesn't hold the pages shut: it's
    // put away, its result kept in the record.)
    this.reveal = null;
    this.tab = id;
    this.confirm = null;
    this.ui.audio?.play('page');
  }

  // ------------------------------------------------------------ 1 matters
  items(C0) {
    return C0.agenda.filter((q) => !q.done).sort((a, b) => (b.crisis ? 1 : 0) - (a.crisis ? 1 : 0) || a.id - b.id);
  }

  drawMatters(g, civ, R, C0, F) {
    const items = this.items(C0);
    if (this.sel === null || !items.some((q) => q.id === this.sel)) this.sel = items.length ? items[0].id : null;
    let y = BODY;
    const abs = this.game.sim.abs;
    for (const it of items.slice(0, 8)) {
      const on = it.id === this.sel;
      const hov = this.hovering(1, y, 30, 2);
      g.fill(1, y, 30, 2, ' ', C.fg, on ? (it.crisis ? '#401820' : '#2c2438') : hov ? '#221c2a' : undefined);
      const st = this.stateChip(it, abs);
      g.text(2, y, st.glyph, st.color);
      g.text(4, y, it.title.length > 27 ? `${it.title.slice(0, 26)}…` : it.title, on ? C.white : it.crisis ? '#ffb0a0' : C.fg);
      g.text(4, y + 1, st.text.slice(0, 26), st.color === C.dim ? C.faint : st.color);
      this.hit(1, y, 30, 2, () => {
        this.sel = it.id;
        this.ui.audio?.play('select');
      });
      y += 2;
    }
    if (!items.length) {
      g.text(3, y + 1, 'Nothing before the crown.', C.dim);
      wrap('New matters come each morning at ten. Set your own decrees on the other pages.', 27).forEach((l, i) => g.text(3, y + 3 + i, l, C.faint));
      g.text(3, y + 7, 'Lately', C.faint);
      C0.minutes.slice(-8).reverse().forEach((m, i) => g.text(3, y + 8 + i, m.what.slice(0, 27), C.faint));
    }
    for (let j = BODY; j < H - 3; j++) g.put(31, j, '│', '#3a3040');
    const it = items.find((q) => q.id === this.sel);
    this.hallArea = { x: 33, y: HALL_Y, w: W - 35, h: HALL_H };
    // (A vote being shown, whatever's selected: the matter it was on is
    // done with by now.)
    if (this.reveal) this.drawReveal(g, civ, F, this.reveal.it, 33, W - 35);
    else if (it) this.drawMatter(g, civ, R, C0, F, it);
  }

  stateChip(it, abs) {
    if (it.crisis && it.state === 'open') {
      const left = Math.max(0, it.until - abs);
      return { glyph: '!', color: '#ff7060', text: `CRISIS · ${Math.floor(left / 60)}h${String(Math.floor(left % 60)).padStart(2, '0')} to decide` };
    }
    const s = it.by !== null && it.by !== undefined ? this.game.world.ow.settlements[it.by] : null;
    const by = it.mine ? 'your proposal' : s ? `from ${s.name}` : 'the realm\'s business';
    if (it.state === 'voting') return { glyph: '…', color: '#a0e8ff', text: 'the realm is voting' };
    if (it.struck.length) return { glyph: '×', color: '#ffa050', text: `voted down · ${by}` };
    return { glyph: '•', color: C.dim, text: by };
  }

  drawMatter(g, civ, R, C0, F, it) {
    const x = 33;
    const w = W - x - 2;
    let y = BODY;
    wrap(it.title, w).slice(0, 2).forEach((l) => g.text(x, y++, l, it.crisis ? '#ffb0a0' : C.hi));
    let n = 0;
    for (const p of it.why) for (const l of wrap(p, w)) if (n++ < 4) g.text(x, y++, l, C.dim);
    y++;
    const open = it.state === 'open';
    const ow = this.game.world.ow;
    const town = (sid) => (ow.settlements[sid] ? ow.settlements[sid].name : '?');
    it.opts.forEach((opt, k) => {
      if (y > HALL_Y - 3) return;
      const struck = it.struck.includes(k);
      const can = open && !struck && !opt.off;
      const hov = can && this.hovering(x, y, w, 2);
      g.fill(x, y, w, 2, ' ', C.fg, hov ? '#30283c' : k % 2 ? '#1a1622' : '#1e1a28');
      g.text(x + 1, y, `${k + 1}`, can ? C.hi : C.faint);
      const lab = opt.label.slice(0, w - 13);
      g.text(x + 3, y, lab, struck ? '#806858' : opt.off ? C.faint : C.white);
      if (struck) for (let i = 0; i < lab.length; i++) g.put(x + 3 + i, y, lab[i] === ' ' ? '─' : lab[i], '#806858');
      const ef = this.kept(`${it.id}:${k}`, () => this.crown.stated(civ, opt));
      const line = opt.off ? `not possible: ${opt.off}` : struck ? 'voted down' : ef.text || (opt.trivial ? 'no vote needed' : '');
      g.text(x + 3, y + 1, line.slice(0, w - 13), opt.off || struck ? C.faint : '#c8b890');
      if (!opt.off && !struck && lab.length < w - 20) whoMoves(g, x + 5 + lab.length, y, ef.by, w - 7 - lab.length - 9, town);
      if (ef.overall && !opt.off) {
        const tt = `realm ${sign(ef.overall)}`;
        g.text(W - 3 - tt.length, y, tt, ef.overall > 0 ? '#a8e070' : '#ffa050');
      }
      if (can) this.hit(x, y, w, 2, () => this.choose(civ, it, k));
      y += 2;
    });
    const how = { decree: 'You decree: your privy council only advises.', council: 'The realm\'s council votes; you decide a tie.', moot: 'The heads of the realm\'s towns vote.', league: 'The towns vote, each by the weight of its treasury.', temple: 'You decree; the high priest may veto.' }[F.vote];
    g.text(x, H - 3, (it.crisis ? 'A crisis is yours alone to decide, there and then.' : how).slice(0, w), C.faint);
    if (it.vote && it.vote.ballots && it.vote.ballots.length && it.state === 'voting') {
      const t = `waiting on ${it.vote.ballots.filter((b) => b.v === null).length} player vote(s)`;
      g.text(W - 2 - t.length, HALL_Y - 1, t, '#a0e8ff');
    }
  }

  choose(civ, it, k) {
    if (this.reveal) return;
    const opt = it.opts[k];
    const r = this.crown.decide(civ, it.id, k);
    if (!r.ok) return this.say(r.why || 'Not possible.', '#ffb080');
    this.cache.clear();
    if (r.vote && r.state !== 'waiting') {
      this.reveal = { id: it.id, vote: r.vote, t: 0, label: opt.label, it };
      this.ui.audio?.play('page');
    } else if (r.state === 'waiting') this.say('The realm is voting: waiting on the players among them.', '#a0e8ff');
    else {
      this.say(it.crisis ? 'Done.' : 'So be it.', C.hi);
      this.ui.audio?.play('select');
    }
  }

  revealTimes(v) {
    const crowd = v.ballots.length > 12;
    const step = crowd ? 1.6 / v.ballots.length : 0.42;
    return { step, done: 0.4 + v.ballots.length * step, seal: 0.4 + v.ballots.length * step + 0.25 };
  }

  drawReveal(g, civ, F, it, x, w) {
    const R = this.reveal;
    const v = R.vote;
    const tm = this.revealTimes(v);
    let y = BODY;
    g.text(x, y++, v.state === 'decreed' ? 'By your decree:' : 'Put to the vote:', C.dim);
    wrap(`${it.title.replace(/\?$/, '')}: ${R.label}`, w).forEach((l) => g.text(x, y++, l, C.hi));
    y++;
    const shown = Math.max(0, Math.floor((R.t - 0.4) / tm.step) + 1);
    let aye = 0;
    let nay = 0;
    v.ballots.slice(0, shown).forEach((b) => {
      if (b.v === 1) aye += b.w;
      else if (b.v === 0) nay += b.w;
    });
    v.ballots.slice(0, 10).forEach((b, i) => {
      if (y >= HALL_Y - 2) return;
      const on = i < shown;
      g.text(x, y, b.you ? F.glyph : b.pid ? '♦' : '☺', b.you ? F.color : b.pid ? '#a0e8ff' : C.dim);
      g.text(x + 2, y, `${b.who}${b.w > 1 ? ` (×${b.w})` : ''}`.slice(0, 26), on ? C.white : C.faint);
      if (on) {
        g.text(x + 29, y, b.v === 1 ? '✓ FOR' : b.v === 0 ? '× AGAINST' : '· ABSENT', b.v === 1 ? '#80e070' : b.v === 0 ? '#ff7060' : C.faint);
        if (b.why) g.text(x + 39, y, b.why.slice(0, w - 39), C.dim);
      } else g.text(x + 29, y, '…', C.faint);
      y++;
    });
    const cy = HALL_Y - 1;
    if (v.ballots.length) {
      g.text(x, cy, `For ${String(aye).padStart(3)}`, '#80e070');
      g.text(x + 12, cy, `Against ${String(nay).padStart(3)}`, '#ff7060');
    }
    if (R.t >= tm.seal) {
      const st = v.state;
      const word = { carried: 'CARRIED', decreed: 'SO DECREED', vetoed: 'VETOED' }[st] || 'DEFEATED';
      g.text(x + 28, cy, word, st === 'carried' || st === 'decreed' ? '#80ff90' : '#ff7060');
      if (R.t > tm.seal + 1.2) g.text(x, H - 3, 'Click or Enter to go on.', C.faint);
      if (!R.sounded) {
        R.sounded = true;
        this.ui.audio?.play(st === 'carried' || st === 'decreed' ? 'fanfare' : 'thud');
        this.cache.clear();
      }
    } else if (R.lastShown !== shown) {
      R.lastShown = shown;
      if (shown > 0 && shown <= v.ballots.length) this.ui.audio?.play('tink');
    }
    this.hit(x, BODY, w, H - BODY - 2, () => this.endReveal());
  }

  endReveal() {
    const R = this.reveal;
    if (!R) return;
    const tm = this.revealTimes(R.vote);
    if (R.t < tm.seal) R.t = tm.seal;
    else this.reveal = null;
  }

  // ------------------------------------------------------------ 2 decrees
  drawDecrees(g, civ, R, C0, F) {
    const crown = this.crown;
    const d = R.decrees;
    let y = BODY + 1;
    g.text(2, y++, F.vote === 'decree' || F.vote === 'temple' ? 'The realm\'s decrees: choose, and it is decreed.' : 'The realm\'s decrees: choose, and it goes before the realm\'s vote (Matters).', C.dim);
    y++;
    let look = null;
    const set = (key, v, b) => {
      const r = crown.propose(civ, 'decree', key, b === undefined ? v : b);
      this.cache.clear();
      if (!r.ok) return this.say(r.why, '#ffb080');
      if (r.vote && r.state !== 'waiting') {
        this.tab = 'matters';
        this.sel = r.item.id;
        this.reveal = { id: r.item.id, vote: r.vote, t: 0, label: r.item.opts[0].label, it: r.item };
      } else if (r.item && !r.item.done) {
        this.tab = 'matters';
        this.sel = r.item.id;
        this.say('Before the realm: choose "Decree it" to put it to the vote.', '#a0c8ff');
      } else this.say('So decreed.', F.color);
      this.ui.audio?.play('page');
    };
    const row = (name, list, cur, key, about, overOf = null) => {
      g.text(2, y, name, C.fg);
      this.pills(g, 16, y, list, cur, (v) => set(key, v), true, (v) => {
        look = { key, about, over: overOf ? overOf(v) : null, v };
      });
      y += 2;
    };
    const cap = F.shareCap || SHARE_MAX;
    // (Round 125) The least tax and the tribute, set to the point: a draft
    // on a slider, then decreed (or put to the vote).
    const rate = (name, key, cur, min, max, about, overOf) => {
      this.drafts ||= {};
      const v = this.drafts[key] ?? cur;
      g.text(2, y, name, C.fg);
      const ex = slider(this, g, 16, y, { v, cur, min, max, step: 0.01, fmt: (q) => (q ? pc(q) : 'none'), set: (q) => {
        this.drafts[key] = q;
      } });
      if (Math.abs(v - cur) > 1e-9) {
        look = { key, about, over: overOf(v), v };
        button(this, g, ex + 1, y, ' Decree it ', F.color, () => {
          set(key, v);
          delete this.drafts[key];
        });
      } else if (this.hovering(16, y, 30, 1)) look = { key, about, over: null, v };
      g.text(16, y + 1, `now ${cur ? pc(cur) : 'none'}${Math.abs(v - cur) > 1e-9 ? ` · to ${v ? pc(v) : 'none'}` : ''}`, C.faint);
      y += 2;
    };
    rate('Least tax', 'taxFloor', d.taxFloor || 0, 0, FLOOR_MAX, 'The least tax every town must levy. The towns resent it, and the realm\'s tribute grows.', (v) => ({ taxFloor: v }));
    rate('Tribute', 'share', R.share, SHARE_MIN, cap, `What every town sends the capital, of its taxes: the realm's coffers, and your pay.${F.shareCap ? ` (A ${F.name.toLowerCase()}: never above ${pc(F.shareCap)}.)` : ''}`, (v) => ({ share: v }));
    row('Weapons ban', [[false, 'none'], [true, 'in every town']], !!d.armsBan, 'armsBan', 'No drawn weapons in the streets of any town of the realm.', (v) => ({ armsBan: v }));
    row('The watch', WATCHES.map((v) => [v, v]), d.watch || 'standard', 'watch', 'How many of the grown folk stand watch in every town: a light watch costs less, a heavy one keeps order.');
    row('The draft', DRAFTS.map((v) => [v, v === 'none' ? 'none' : v === 'elders' ? 'elders' : 'young and old']), d.draft || 'none', 'draft', 'Who is called to the watch in time of war.');
    // Tariffs on the merchants of the realm's neighbours.
    g.text(2, y++, 'Tariffs', C.fg);
    const sim = this.game.sim;
    const others = sim.realms.civs.filter((o) => o !== civ && sim.realms.members(o).length).slice(0, 4);
    for (const o of others) {
      g.text(4, y, placeOf(o).slice(0, 11), C.dim);
      const on = d.tariffOn.includes(o.id);
      this.pills(g, 16, y, [[false, 'free trade'], [true, 'a tariff']], on, (v) => set('tariff', v, { civ: o.id, v }), true, () => {
        look = { key: 'tariff', about: `A tariff on merchants of the ${plain(o)}: coin for the towns, cooler relations with them.` };
      });
      y++;
    }
    // What the one looked at would do.
    const x = 56;
    for (let j = BODY + 2; j < H - 3; j++) g.put(x - 2, j, '│', '#3a3040');
    if (look) {
      let ly = BODY + 3;
      wrap(look.about, W - x - 2).forEach((l) => g.text(x, ly++, l, C.dim));
      if (look.over) {
        ly++;
        const pv = this.kept(`dec:${look.key}:${look.v}`, () => crown.preview(civ, look.over));
        g.text(x, ly++, `The realm: ${pv.overall ? sign(pv.overall) : 'no change'}`, pv.overall > 0 ? '#a8e070' : pv.overall < 0 ? '#ffa050' : C.dim);
        const ow = this.game.world.ow;
        Object.entries(pv.by).filter(([, v]) => v).sort((a, b) => a[1] - b[1]).slice(0, 8).forEach(([sid, v]) => {
          g.text(x + 1, ly, ow.settlements[sid].name.slice(0, 16), C.fg);
          g.text(x + 19, ly++, sign(v), v > 0 ? '#a8e070' : '#ffa050');
        });
      }
    } else {
      g.text(x, BODY + 3, 'Point at a choice to see', C.faint);
      g.text(x, BODY + 4, 'how the towns would take it.', C.faint);
    }
  }

  // ------------------------------------------------------------ 3 towns
  drawTowns(g, civ, R, C0, F) {
    const sim = this.game.sim;
    const crown = this.crown;
    const A = this.kept('approvals', () => crown.approvals(civ));
    const towns = sim.realms.memberLayouts(civ).sort((a, b) => (A.by[a.settlement.id]?.v ?? 50) - (A.by[b.settlement.id]?.v ?? 50));
    if (this.townSel === null || !towns.some((L) => L.settlement.id === this.townSel)) this.townSel = towns.length ? towns[0].settlement.id : null;
    let y = BODY;
    g.text(2, y++, 'Town             Loyalty', C.faint);
    for (const L of towns.slice(0, 22)) {
      const s = L.settlement;
      const a = A.by[s.id] || { v: 50 };
      const on = s.id === this.townSel;
      const hov = this.hovering(1, y, 34, 1);
      g.fill(1, y, 34, 1, ' ', C.fg, on ? '#2c2438' : hov ? '#221c2a' : undefined);
      const T = sim.office.of(s.id);
      g.text(2, y, s.id === R.capital ? '★' : T && T.holder ? '♦' : '·', s.id === R.capital ? '#ffd070' : T && T.holder ? '#a0e8ff' : C.faint);
      g.text(4, y, s.name.slice(0, 14), on ? C.white : C.fg);
      for (let i = 0; i < 10; i++) g.put(19 + i, y, i < Math.round(a.v / 10) ? '▪' : '·', i < Math.round(a.v / 10) ? approvalColor(a.v) : '#3a3448');
      g.text(30, y, `${a.v}`, approvalColor(a.v));
      this.hit(1, y, 34, 1, () => {
        this.townSel = s.id;
        this.confirm = null;
      });
      y++;
    }
    g.text(2, H - 3, '★ the capital   ♦ governed by a player', C.faint);
    for (let j = BODY; j < H - 3; j++) g.put(36, j, '│', '#3a3040');
    const L = towns.find((q) => q.settlement.id === this.townSel);
    if (!L) return;
    const s = L.settlement;
    const a = A.by[s.id] || { v: 50, why: [] };
    const x = 38;
    const w = W - x - 2;
    y = BODY;
    g.text(x, y++, `${s.name}${s.id === R.capital ? ' (the capital)' : ''}`, C.hi);
    const T = sim.office.of(s.id);
    const head = T && T.holder ? `${sim.office.title(L, T)} ${T.holder.name} (a player)` : `${s.type} of ${a.pop} · ${L.npcs.find((r) => r.job === 'mayor' && r.alive !== false) ? `mayor ${full(L.npcs.find((r) => r.job === 'mayor' && r.alive !== false))}` : 'no mayor'}`;
    g.text(x, y++, head.slice(0, w), T && T.holder ? '#a0e8ff' : C.dim);
    g.text(x, y++, `Treasury ¤${Math.floor(L.econ.treasury)} · taxes ${pc(L.econ.tax)}${crown.relieved(civ, s.id, this.game.day) ? ' · half tribute' : ''}`, C.dim);
    y++;
    g.text(x, y, 'Loyalty', C.dim);
    bar(g, x + 8, y, 16, a.v, approvalColor(a.v));
    g.text(x + 25, y++, `${a.v}`, approvalColor(a.v));
    for (const q of a.why.slice(0, 6)) {
      g.text(x + 1, y, q.v > 0 ? '▲' : '▼', q.v > 0 ? '#a8e070' : '#ff8060');
      g.text(x + 3, y++, q.text.slice(0, w - 4), C.fg);
    }
    y++;
    // What the crown can do for it, or to it.
    let bx = x;
    if (s.id !== R.capital) {
      bx = this.btn(g, bx, y, ' Send ¤60 ', '#a0e8a0', () => this.act(civ, 'aid', s.id));
      bx = this.btn(g, bx, y, ' Lighter tribute ', '#a0e8a0', () => this.act(civ, 'relief', s.id), !crown.relieved(civ, s.id, this.game.day));
      this.btn(g, bx, y, ' A road ', '#a0c8ff', () => this.act(civ, 'road', s.id));
      y += 2;
    }
    if (T && T.holder && T.holder.pid !== sim.office.pid()) {
      bx = x;
      if (F.vote === 'decree') bx = this.btn(g, bx, y, ' Raise to a lordship ', '#d8b0ff', () => {
        const r = crown.grantLordship(civ, s.id);
        this.say(r.ok ? `${T.holder.name} is lord of ${s.name} now.` : r.why, r.ok ? '#d8b0ff' : '#ffb080');
      }, T.charter !== 'lordship');
      this.btn(g, bx, y, ` Depose ${T.holder.name} `.slice(0, 24), '#ff9a7a', () => this.act(civ, 'depose', s.id));
      y += 2;
    } else if (!T || !T.holder) {
      const cands = crown.governorCandidates(civ);
      if (cands.length) {
        g.text(x, y++, 'Offer its governorship to:', C.dim);
        bx = x;
        for (const c of cands.slice(0, 4)) bx = this.btn(g, bx, y, ` ${c.name} `, '#a0e8ff', () => {
          const r = crown.offerGovernor(civ, s.id, c.pid);
          this.say(r.ok ? `Your offer goes to ${c.name}.` : r.why, r.ok ? '#a0e8ff' : '#ffb080');
        });
        y += 2;
      }
    }
  }

  act(civ, kind, a) {
    const r = this.crown.propose(civ, kind, a);
    this.cache.clear();
    if (!r.ok) return this.say(r.why, '#ffb080');
    if (r.vote && r.state !== 'waiting') {
      this.tab = 'matters';
      this.sel = r.item.id;
      this.reveal = { id: r.item.id, vote: r.vote, t: 0, label: r.item.opts[0].label, it: r.item };
    } else if (r.item && !r.item.done) {
      this.tab = 'matters';
      this.sel = r.item.id;
      this.say('Before the realm: choose the first option to put it to the vote.', '#a0c8ff');
    } else this.say('Done.', C.hi);
    this.ui.audio?.play('page');
    return r;
  }

  // ------------------------------------------------------------ 4 court
  // (Round 140) The others playing, and what the realm's towns hold against
  // them: pardoned, by your word, in every one (desertion from the realm's
  // war too).
  drawPardons(g, civ) {
    const sim = this.game.sim;
    const o = sim.office;
    const mine = sim.crown.isRuler(civ, o.pid());
    const towns = this.game.world.ow.settlements;
    let y = BODY + 3;
    g.text(2, y++, 'The others playing, and the realm\'s law', C.hi);
    y++;
    const others = o.others();
    if (!others.length) for (const l of wrap('No one else is playing in this world just now. Any who join and fall foul of the realm\'s towns can be pardoned here, in every town of the realm at once.', W - 4)) g.text(2, y++, l, C.dim);
    for (const { pid, name } of others.slice(0, 8)) {
      const st = o.realmStanding(pid, civ);
      if (!st) continue;
      g.text(2, y, name.slice(0, 20), C.white);
      const bits = [];
      if (st.towns.length) bits.push(`in trouble in ${st.towns.length === 1 && towns[st.towns[0]] ? towns[st.towns[0]].name : `${st.towns.length} towns`}`);
      if (st.exiled) bits.push(`exiled from ${st.exiled}`);
      if (st.deserter) bits.push('a deserter');
      g.text(24, y, (bits.join(', ') || 'nothing against them').slice(0, 38), bits.length ? '#ffa050' : C.faint);
      if (mine) button(this, g, W - 12, y, ' Pardon ', '#ffd070', () => {
        const cap = sim.realms.capitalOf(civ);
        const L = cap && sim.layoutOf(cap.id);
        const r = L ? o.pardon(L, pid, true) : { ok: false, why: 'The realm has no capital.' };
        this.say(r.ok ? `${r.name} is pardoned throughout the realm.` : r.why, r.ok ? '#a0e8ff' : '#ffb080');
      }, !!(bits.length));
      y += 2;
    }
    wrap('A pardon drops the charges, wipes the record clean and lifts any exile, in every town of the realm. (To make someone a citizen, open the council of a town you head: its People page.)', W - 4).slice(0, 3).forEach((l, i) => g.text(2, H - 6 + i, l, C.faint));
    return null;
  }

  drawCourt(g, civ, R, C0, F) {
    const view = this.subtabs(g, [['form', 'Government'], ['heir', 'Title and heir'], ['orders', 'Standing orders'], ['pardons', 'Pardons'], ['chron', 'Chronicle']], 'court', 'form');
    if (view === 'heir') return this.drawHeir(g, civ, R, C0, F);
    if (view === 'pardons') return this.drawPardons(g, civ);
    if (view === 'orders') return this.drawOrders(g, civ, R, C0);
    if (view === 'chron') return this.drawChronicle(g, civ, R, C0);
    const sim = this.game.sim;
    let y = BODY + 2;
    const look = this.formSel && REALM_FORMS[this.formSel] ? this.formSel : R.form;
    g.text(2, y++, 'How the realm is governed:', C.dim);
    y++;
    for (const id of FORM_IDS) {
      const f = REALM_FORMS[id];
      const on = id === R.form;
      const sel = id === look;
      const hov = this.hovering(1, y, 30, 1);
      g.fill(1, y, 30, 1, ' ', C.fg, sel ? '#2c2438' : hov ? '#221c2a' : undefined);
      g.text(2, y, f.glyph, f.color);
      g.text(4, y, f.name, on ? f.color : C.fg);
      if (on) g.text(22, y, '(now)', C.faint);
      this.hit(1, y, 30, 1, () => {
        this.formSel = id;
      });
      y += 2;
    }
    // Who's at court.
    y++;
    const ch = sim.realms.ruler(civ);
    g.text(2, y++, `Chancellor: ${ch ? full(ch) : 'none'}`, C.dim);
    if (R.form === 'republic') {
      const names = R.council.map((p) => sim.realms.recOf(p)).filter(Boolean).map((r) => r.name.first);
      const seats = sim.office.realmSeats(civ).map((T) => T.holder.name);
      wrap(`Council: ${[...names, ...seats].join(', ') || 'empty'}`, 29).slice(0, 3).forEach((l) => g.text(2, y++, l, C.dim));
    }
    for (let j = BODY + 2; j < H - 3; j++) g.put(32, j, '│', '#3a3040');
    // The one looked at.
    const f = REALM_FORMS[look];
    const x = 34;
    const w = W - x - 2;
    y = BODY + 2;
    g.text(x, y++, `${f.glyph} ${f.name}`, f.color);
    g.text(x, y++, `${f.styles ? f.styles.join(', ') : f.title} · ¤${f.stipend} a day`, C.dim);
    y++;
    for (const l of f.rules) for (const ln of wrap(`• ${l}`, w)) g.text(x, y++, ln, C.fg);
    y++;
    if (look !== R.form) {
      const pv = this.kept(`form:${look}`, () => this.crown.preview(civ, { form: look }));
      g.text(x, y++, `The realm would take it: ${pv.overall ? sign(pv.overall) : 'no change'}`, pv.overall > 0 ? '#a8e070' : pv.overall < 0 ? '#ffa050' : C.dim);
      if (F.vote !== 'decree' && F.vote !== 'temple') g.text(x, y++, 'Carried only by two in every three.', C.faint);
      y++;
      this.btn(g, x, y, ` Make it a ${f.name.toLowerCase()} `, f.color, () => {
        const r = this.crown.propose(civ, 'form', look);
        this.cache.clear();
        if (!r.ok) return this.say(r.why, '#ffb080');
        this.formSel = null;
        if (r.item && !r.item.done) {
          this.tab = 'matters';
          this.sel = r.item.id;
          this.say('Before the realm: choose the first option to put it to the vote.', '#a0c8ff');
        } else this.say(`The ${plain(civ)} is a ${f.name.toLowerCase()} now.`, f.color);
      });
    }
    // Giving it all up.
    if (this.confirm === 'abdicate') {
      g.text(x, H - 4, 'Give up the throne? There is no undoing it.', '#ff9a7a');
      let bx = this.btn(g, x, H - 3, ' Yes, abdicate ', '#ff9a7a', () => {
        this.crown.abdicate(civ);
        this.close();
      });
      this.btn(g, bx, H - 3, ' No ', C.fg, () => {
        this.confirm = null;
      });
    } else this.btn(g, W - 14, H - 3, ' Abdicate ', '#ff9a7a', () => {
      this.confirm = 'abdicate';
    });
  }

  drawHeir(g, civ, R, C0, F) {
    let y = BODY + 2;
    const crown = this.crown;
    g.text(2, y++, 'Your title', C.hi);
    if (F.styles) {
      const grand = this.game.sim.realms.members(civ).length >= 5;
      const list = [...F.styles, ...(grand ? F.grand || [] : [])];
      this.pills(g, 3, y, list.map((st) => [st, st]), R.headStyle, (st) => {
        if (crown.setStyle(civ, st)) this.say(`You are ${st} of the ${plain(civ)}.`, F.color);
      });
      y++;
      if (!grand && F.grand) g.text(3, y++, `A realm of five towns or more may call its ruler ${F.grand.join(' or ')}.`, C.faint);
    } else g.text(3, y++, `A ${F.name.toLowerCase()}'s head is its ${F.title}: there's no choosing.`, C.dim);
    y += 2;
    g.text(2, y++, 'Your heir', C.hi);
    if (F.vote !== 'decree' && F.vote !== 'temple') {
      g.text(3, y++, `A ${F.name.toLowerCase()} chooses its own next ${F.title.toLowerCase()}: you name no heir.`, C.dim);
      return;
    }
    g.text(3, y++, C0.heir ? `${C0.heir.name}${C0.heir.pid ? ' (a player)' : ''}: comes to the throne if you step down or die.` : 'None named: the court will choose.', C0.heir ? '#ffe070' : C.dim);
    y++;
    const cands = crown.heirCandidates(civ);
    if (!cands.length) g.text(3, y++, 'No one at court fit to name.', C.faint);
    for (const c of cands.slice(0, 8)) {
      const now = C0.heir && C0.heir.name === c.name;
      this.btn(g, 3, y, ` ${now ? '★' : '·'} ${c.name}${c.pid ? ' (a player)' : ''} `, c.pid ? '#a0e8ff' : C.fg, () => {
        crown.nameHeir(civ, c);
        this.say(`${c.name} is your heir.`, '#ffe070');
      }, !now);
      y++;
    }
  }

  drawOrders(g, civ, R, C0) {
    let y = BODY + 2;
    const ch = this.game.sim.realms.ruler(civ);
    g.text(2, y++, `What ${ch ? `Chancellor ${full(ch)}` : 'the chancellor'} does with what you leave undecided:`, C.dim);
    y++;
    for (const id of CROWN_ORDER_IDS) {
      const o = CROWN_ORDERS[id];
      g.text(3, y, o.name, C.fg);
      this.pills(g, 30, y, o.opts.map(([v, , short]) => [v, short]), C0.orders[id], (v) => {
        C0.orders[id] = v;
        this.ui.audio?.play('select');
      });
      const cur = o.opts.find((q) => q[0] === C0.orders[id]);
      g.text(5, y + 1, cur ? cur[1] : '', C.faint);
      y += 3;
    }
  }

  drawChronicle(g, civ, R, C0) {
    let y = BODY + 2;
    g.text(2, y++, 'Lately', C.hi);
    for (const m of C0.minutes.slice(-14).reverse()) if (y < H - 9) g.text(3, y++, `day ${m.day}: ${m.what}`.slice(0, W - 6), C.dim);
    y = Math.max(y + 1, H - 8);
    g.text(2, y++, 'Rulers before you', C.hi);
    if (!C0.past.length) g.text(3, y++, 'You are the first player to rule here.', C.faint);
    for (const p of C0.past.slice(-4).reverse()) g.text(3, y++, `${p.name}, days ${p.from}-${p.to}: ${p.why}`.slice(0, W - 6), C.dim);
  }

  // ------------------------------------------------------------ 5 realms
  drawRealms(g, civ, R, C0, F) {
    const sim = this.game.sim;
    const war = sim.war;
    const pol = sim.politics;
    const others = sim.realms.civs.filter((o) => o !== civ && sim.realms.members(o).length);
    if (this.realmSel === null || !others.some((o) => o.id === this.realmSel)) this.realmSel = others.length ? others[0].id : null;
    let y = BODY;
    g.text(4, y, 'Realm', C.faint);
    g.text(27, y++, 'Standing', C.faint);
    for (const o of others.slice(0, 20)) {
      const rel = sim.realms.relation(civ, o);
      const on = o.id === this.realmSel;
      const hov = this.hovering(1, y, 40, 1);
      g.fill(1, y, 40, 1, ' ', C.fg, on ? '#2c2438' : hov ? '#221c2a' : undefined);
      const foe = war && war.enemies(civ, o);
      const ally = pol.allied(civ, o);
      g.text(2, y, foe ? '×' : ally ? '♥' : '·', foe ? '#ff6050' : ally ? '#80e0a0' : C.faint);
      g.text(4, y, plain(o).slice(0, 22), on ? C.white : C.fg);
      const st = foe ? 'at war' : ally ? 'allied' : rel.standing;
      g.text(27, y, st, foe ? '#ff6050' : ally ? '#80e0a0' : rel.standing === 'friendly' ? '#a8e070' : rel.standing === 'hostile' ? '#ffa050' : C.dim);
      g.text(35, y, sign(Math.round(rel.score)), C.faint);
      if (sim.realms.realm(o).head) g.text(40, y, '♦', '#a0e8ff');
      this.hit(1, y, 40, 1, () => {
        this.realmSel = o.id;
      });
      y++;
    }
    g.text(2, H - 3, '× at war   ♥ allied   ♦ ruled by a player', C.faint);
    for (let j = BODY; j < H - 3; j++) g.put(42, j, '│', '#3a3040');
    const o = others.find((q) => q.id === this.realmSel);
    if (!o) return;
    const x = 44;
    const w = W - x - 2;
    y = BODY;
    g.text(x, y++, o.name.slice(0, w), C.hi);
    g.text(x, y++, `Ruled by ${sim.realms.rulerName(o) || 'no one'}${sim.realms.realm(o).head ? ' (a player)' : ''}`.slice(0, w), C.dim);
    g.text(x, y++, `${sim.realms.members(o).length} towns · strength ${Math.round(pol.strength(o))} (yours ${Math.round(pol.strength(civ))})`.slice(0, w), C.dim);
    y++;
    const foe = war && war.enemies(civ, o);
    const ally = pol.allied(civ, o);
    const truce = war && war.truce(civ, o);
    const clash = pol.clash(civ, o);
    if (truce) g.text(x, y++, 'A truce holds between you.', '#a0c8ff');
    if (clash) wrap(`Kept apart: ${clash}.`, w).slice(0, 2).forEach((l) => g.text(x, y++, l, C.faint));
    y++;
    let bx = x;
    if (foe) {
      this.btn(g, bx, y, ' Sue for peace ', '#a0e8a0', () => this.act(civ, 'sue', o.id));
    } else {
      bx = this.btn(g, bx, y, ' Declare war ', '#ff9a7a', () => this.act(civ, 'war', o.id), !ally && !truce && !(war && war.atWar(civ)));
      this.btn(g, bx, y, ' Offer an alliance ', '#80e0a0', () => this.act(civ, 'ally', o.id), !ally && !clash);
    }
    y += 2;
    if (war && war.atWar(civ) && !foe) g.text(x, y++, 'The realm is at war already.', C.faint);
    void F;
  }

  // ------------------------------------------------------------ the hall
  // The throne room, drawn in pixels: a vaulted hall in the realm's
  // colours, the throne on its dais (a gilt throne, a speaker's chair, an
  // elder's bench, a temple's seat, a merchant's chair), you on it, and
  // who votes with you down either side. When they vote, each holds up
  // their vote in turn; then the seal comes down (gold, for a decree).
  drawPixels(ctx) {
    if (this.tab !== 'matters' || !this.hallArea) return;
    const civ = this.civ();
    const C0 = this.C();
    if (!civ || !C0) return;
    const R = this.game.sim.realms.realm(civ);
    const F = REALM_FORMS[R.form] || REALM_FORMS.monarchy;
    const a = this.hallArea;
    const X = (this.x + a.x) * CHAR_W;
    const Y = (this.y + a.y) * CHAR_H;
    const PW = a.w * CHAR_W;
    const PH = a.h * CHAR_H;
    const t = this.t;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, PW, PH);
    ctx.clip();
    // Stone, in courses; arches along the back.
    ctx.fillStyle = '#242030';
    ctx.fillRect(X, Y, PW, PH);
    ctx.fillStyle = '#2c2838';
    for (let row = 0; row < PH; row += 6) for (let col = (row / 6) % 2 ? 0 : 7; col < PW; col += 14) ctx.fillRect(X + col, Y + row, 13, 5);
    const cx = Math.round(X + PW / 2);
    for (let k = -2; k <= 2; k++) {
      if (!k) continue;
      const ax = cx + k * 52;
      ctx.fillStyle = '#16141e';
      ctx.fillRect(ax - 9, Y + 10, 18, 34);
      ctx.beginPath();
      ctx.arc(ax, Y + 10, 9, Math.PI, 0);
      ctx.fill();
      // Light through it, by the hour.
      const m = this.game.minute;
      const day = m > 360 && m < 1140;
      ctx.fillStyle = day ? 'rgba(200,220,255,0.35)' : 'rgba(60,70,140,0.35)';
      ctx.fillRect(ax - 6, Y + 10, 12, 30);
      ctx.beginPath();
      ctx.arc(ax, Y + 10, 6, Math.PI, 0);
      ctx.fill();
    }
    // Banners, either side of the throne.
    for (const side of [-1, 1]) {
      const bx = cx + side * 26;
      const sway = Math.sin(t * 1.2 + side) * 1.2;
      ctx.fillStyle = '#c8a040';
      ctx.fillRect(bx - 9, Y + 2, 18, 2);
      ctx.fillStyle = F.color;
      ctx.beginPath();
      ctx.moveTo(bx - 7, Y + 4);
      ctx.lineTo(bx + 7, Y + 4);
      ctx.lineTo(bx + 7 + sway, Y + 34);
      ctx.lineTo(bx + sway, Y + 28);
      ctx.lineTo(bx - 7 + sway, Y + 34);
      ctx.closePath();
      ctx.fill();
      drawText(ctx, F.glyph, bx - 3 + Math.round(sway / 2), Y + 10, '#1a1420');
    }
    // The carpet down from the dais; the dais.
    const floorY = Y + PH - 14;
    ctx.fillStyle = '#3a3040';
    ctx.fillRect(X, floorY, PW, PH);
    ctx.fillStyle = R.form === 'theocracy' ? '#d8d0f0' : R.form === 'league' ? '#2a6a50' : '#8a1e28';
    ctx.fillRect(cx - 10, floorY - 2, 20, PH);
    ctx.fillStyle = '#c8a040';
    ctx.fillRect(cx - 10, floorY - 2, 1, PH);
    ctx.fillRect(cx + 9, floorY - 2, 1, PH);
    ctx.fillStyle = '#4a4458';
    ctx.fillRect(cx - 22, floorY - 6, 44, 6);
    ctx.fillStyle = '#5a5468';
    ctx.fillRect(cx - 22, floorY - 6, 44, 1);
    // The throne, by the realm's form.
    const th = { monarchy: ['#c89a30', '#ffe070', 40], theocracy: ['#c8c0e0', '#ffffff', 42], republic: ['#6a4a30', '#a0c8ff', 30], elder: ['#5a4028', '#c8a0ff', 24], league: ['#4a3a28', '#ffd070', 32] }[R.form] || ['#c89a30', '#ffe070', 40];
    const tY = floorY - 6;
    ctx.fillStyle = th[0];
    ctx.fillRect(cx - 10, tY - th[2], 20, th[2]);
    ctx.fillStyle = th[1];
    ctx.fillRect(cx - 10, tY - th[2], 20, 2);
    if (R.form === 'monarchy') for (const dx of [-8, -1, 6]) ctx.fillRect(cx + dx, tY - th[2] - 4, 3, 4);
    if (R.form === 'theocracy') {
      ctx.fillRect(cx - 1, tY - th[2] - 8, 2, 8);
      ctx.fillRect(cx - 4, tY - th[2] - 6, 8, 2);
    }
    // You, on it.
    const look = this.game.player.look;
    try {
      ctx.drawImage(humanoidSheet(look), 4 * 16, 0, 16, SHEET_H, cx - 8, tY - 26, 16, SHEET_H);
    } catch {
      // (No look to draw.)
    }
    if (R.form === 'monarchy') {
      const cy = tY - 29 + Math.round(Math.sin(t * 2) * 0.4);
      ctx.fillStyle = '#ffd040';
      ctx.fillRect(cx - 4, cy + 2, 8, 2);
      for (const dx of [-4, -1, 2]) ctx.fillRect(cx + dx, cy, 2, 2);
    }
    // Who votes, either side: the ballots being shown, or the realm's
    // council (or its towns' heads) as they'd sit.
    const Rv = this.reveal;
    const tm = Rv ? this.revealTimes(Rv.vote) : null;
    const shown = Rv ? Math.max(0, Math.floor((Rv.t - 0.4) / tm.step) + 1) : 0;
    const voters = this.voters(civ, R, F, Rv);
    voters.forEach((vt, i) => {
      const side = i % 2 ? 1 : -1;
      const k = Math.floor(i / 2);
      const px = cx + side * (44 + k * 24);
      const py = floorY - 2;
      if (px < X + 8 || px > X + PW - 8) return;
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(px - 7, py - 16, 14, 16);
      if (vt.look) {
        try {
          ctx.drawImage(humanoidSheet(vt.look), 4 * 16, 0, 16, SHEET_H, px - 8, py - 24, 16, SHEET_H);
        } catch {
          // (No look to draw.)
        }
      } else {
        ctx.fillStyle = vt.col || '#a08870';
        ctx.fillRect(px - 3, py - 14, 6, 10);
        ctx.fillStyle = '#e8c8a0';
        ctx.fillRect(px - 2, py - 19, 4, 4);
      }
      if (vt.pid) {
        ctx.fillStyle = '#a0e8ff';
        ctx.fillRect(px - 4, py + 1, 8, 1);
      }
      if (Rv && vt.bi !== undefined && vt.bi < shown) {
        const at = 0.4 + vt.bi * tm.step;
        const up = Math.min(1, (Rv.t - at) / 0.18);
        const hy = py - 34 - Math.round(up * 5);
        const v = Rv.vote.ballots[vt.bi].v;
        ctx.fillStyle = v === 1 ? '#2aa040' : v === 0 ? '#c02a28' : '#5a5a60';
        ctx.fillRect(px - 5, hy, 11, 9);
        ctx.fillStyle = '#ffffff';
        if (v === 1) for (const [dx, dy] of [[-3, 4], [-2, 5], [-1, 6], [0, 5], [1, 4], [2, 3], [3, 2]]) ctx.fillRect(px + dx, hy + dy, 1, 1);
        else if (v === 0) for (let d = -2; d <= 2; d++) {
          ctx.fillRect(px + d, hy + 4 + d, 1, 1);
          ctx.fillRect(px + d, hy + 4 - d, 1, 1);
        }
      }
    });
    // Torches.
    for (const side of [-1, 1]) {
      const lx = cx + side * (PW / 2 - 10);
      const fl = Math.sin(t * 9 + side) > 0 ? 1 : 0;
      const glow = ctx.createRadialGradient(lx, Y + 22, 1, lx, Y + 22, 22);
      glow.addColorStop(0, 'rgba(255,200,110,0.28)');
      glow.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 22, Y, 44, 44);
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(lx - 1, Y + 22, 2, 8);
      ctx.fillStyle = fl ? '#ffe070' : '#ff9a30';
      ctx.fillRect(lx - 2, Y + 18 - fl, 4, 4);
    }
    // The seal: gold for a decree, red wax for a vote carried, grey for
    // one lost.
    if (Rv && Rv.t >= tm.done) {
      const k = Math.min(1, (Rv.t - tm.done) / 0.25);
      const st = Rv.vote.state;
      const good = st === 'carried' || st === 'decreed';
      const wax = st === 'decreed' ? '#c89a30' : good ? '#b81e2c' : '#4a4a58';
      const size = 30 * (1.9 - 0.9 * k);
      const sx = X + PW - 30;
      const sy = Y + 24;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = wax;
      ctx.beginPath();
      for (let j = 0; j < 16; j++) {
        const ang = (j / 16) * Math.PI * 2;
        const r = size / 2 + (j % 2 ? 2 : -1) * (size / 30);
        ctx.lineTo(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = st === 'decreed' ? '#ffe070' : good ? '#d83040' : '#6a6a78';
      ctx.beginPath();
      ctx.arc(sx, sy, size * 0.34, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, st === 'decreed' ? F.glyph : good ? '✓' : '×', sx - 3, sy - 4, st === 'decreed' ? '#6a4a10' : good ? '#ffd8b0' : '#d0d0e0');
      ctx.globalAlpha = 1;
      if (k < 1) {
        ctx.fillStyle = `rgba(255,240,200,${0.25 * (1 - k)})`;
        ctx.fillRect(X, Y, PW, PH);
      }
    }
    ctx.restore();
  }

  // Who stands in the hall: { look, col, pid, bi (their ballot) }.
  voters(civ, R, F, Rv) {
    const sim = this.game.sim;
    const out = [];
    const lookOf = (b) => {
      if (b.pid) {
        const seat = seatOfPid(this.game, b.pid);
        const p = seat ? (seat === this.game.seat ? this.game.player : seat.ent) : null;
        return p ? p.look : null;
      }
      if (b.idx === undefined) return null;
      const sid = b.sid ?? R.capital;
      const L = this.game.world.layouts.get(sid);
      const r = L && L.npcs[b.idx];
      return r ? r.look : null;
    };
    if (Rv) {
      Rv.vote.ballots.forEach((b, bi) => {
        if (!b.you && out.length < 8) out.push({ look: lookOf(b), pid: b.pid, bi, col: b.v === 0 ? '#c02a28' : '#a08870' });
      });
      return out;
    }
    if (F.vote === 'council') {
      for (const p of R.council.slice(0, 6)) {
        const r = sim.realms.recOf(p);
        if (r) out.push({ look: r.look });
      }
      for (const T of sim.office.realmSeats(civ).slice(0, 2)) out.push({ look: lookOf({ pid: T.holder.pid }), pid: T.holder.pid });
    } else if (F.vote === 'moot' || F.vote === 'league') {
      for (const L of sim.realms.memberLayouts(civ).slice(0, 8)) {
        const T = sim.office.of(L.settlement.id);
        if (T && T.holder) {
          if (T.holder.pid !== sim.office.pid()) out.push({ look: lookOf({ pid: T.holder.pid }), pid: T.holder.pid });
          continue;
        }
        const m = L.npcs.find((r) => r.job === 'mayor' && r.alive !== false);
        if (m) out.push({ look: m.look });
      }
    } else {
      // A monarch's guards (or a holy realm's priest), and the chancellor.
      const ch = sim.realms.ruler(civ);
      if (ch) out.push({ look: ch.look });
      out.push({ col: F.vote === 'temple' ? '#e8e0ff' : '#8a8aa0' });
      out.push({ col: '#8a8aa0' });
    }
    return out.slice(0, 8);
  }

  // ------------------------------------------------------------ keys
  // (Round 125) How the war goes, at a glance; and the means to end it.
  drawWarPage(g, civ) {
    const w = drawWar(this, g, this.game, civ, { x: 2, y: BODY, w: W - 4, h: H - BODY - 5 });
    const war = this.game.sim.war;
    if (w && war && war.wars.includes(w)) {
      const foe = war.civ(w.lead[war.sideOf(w, civ) === 'a' ? 'b' : 'a']);
      let bx = this.btn(g, 2, H - 4, ' Sue for peace ', '#a0e8a0', () => this.act(civ, 'sue', foe ? foe.id : null), !!foe);
      bx = this.btn(g, bx, H - 4, ' The draft and the watch (Decrees) ', C.fg, () => this.goTab('decrees'));
      this.btn(g, bx, H - 4, ' Realms ', C.fg, () => this.goTab('realms'));
    }
  }

  // (Round 125) The record of what was decided, carried, defeated.
  drawRecordPage(g, civ, R, C0) {
    drawRecord(this, g, C0.record, { x: 2, y: BODY, w: W - 4, h: H - BODY - 2 }, 'the chancellor');
  }

  onWheel(d) {
    if (this.tab === 'record') wheelRecord(this, d);
  }

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
      else if (/^Digit\d$/.test(k.code)) {
        this.reveal = null;
        return this.onKey(k);
      }
      return true;
    }
    const n = parseInt((k.code.match(/^Digit(\d)$/) || [])[1], 10);
    if (n >= 1 && n <= TABS.length) {
      this.goTab(TABS[n - 1].id);
      return true;
    }
    const C0 = this.C();
    const civ = this.civ();
    if (!C0 || !civ) return true;
    if (this.tab === 'matters') {
      const items = this.items(C0);
      const i = items.findIndex((q) => q.id === this.sel);
      if ((k.code === 'ArrowDown' || k.code === 'KeyS') && items[i + 1]) this.sel = items[i + 1].id;
      else if ((k.code === 'ArrowUp' || k.code === 'KeyW') && i > 0) this.sel = items[i - 1].id;
      else if (k.code === 'Enter' && items[i]) {
        const it = items[i];
        const kk = it.opts.findIndex((o, j) => !o.off && !it.struck.includes(j));
        if (kk >= 0 && it.state === 'open') this.choose(civ, it, kk);
      }
    }
    return true;
  }
}
