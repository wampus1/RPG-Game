// (Round 121) The windows round holding office (see sim/office.js and
// ui/council.js):
//   HustingsWindow: standing for election: the race as it stands, each
//     faction's leaning, your pledges, speaking in the square, money for
//     the campaign.
//   CountWindow: the night of the count (an election, or a recall): the
//     ballots counted into two heaps, and the result.
//   BannerWindow: a moment marked: sworn in, a new charter, the office
//     lost, a free state declared, a village to found; an offer of office
//     to accept or decline.
//   VoteWindow: the council is voting, and you have a seat on it.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { CHAR_W, CHAR_H } from '../config.js';
import { FACTIONS, FACTION_IDS, members, factionOf } from '../sim/factions.js';
import { CHARTERS, headTitle } from '../sim/charters.js';
import { PLEDGES } from '../sim/office.js';
import { stated } from '../sim/agenda.js';
import { LAWS, LAW_IDS, lawFits, lawOn, byDecree } from '../sim/laws.js';
import { countItem, removeItem } from '../game/inventory.js';
import { CouncilWindow } from './council.js';

const full = (r) => (r && r.name ? `${r.name.first} ${r.name.last}` : 'someone');
const BG = '#0e0b14';

function button(win, g, x, y, label, on, fn, col = C.hi) {
  const hov = on && win.hovering(x, y, label.length, 1);
  g.text(x, y, label, on ? (hov ? '#1a1420' : col) : C.faint, on ? (hov ? col : '#2a2236') : undefined);
  if (on) win.hit(x, y, label.length, 1, fn);
  return x + label.length + 1;
}

// ------------------------------------------------------------ the campaign
export class HustingsWindow extends Window {
  constructor(ui, sid) {
    super(ui, 74, 32, { kind: 'hustings' });
    this.sid = sid;
    this.t = 0;
    this.panel = null; // 'pledge' | 'speak'
    this.pkind = null;
    this.flash = null;
    this.proj = null;
    this.game = ui.game || null;
  }

  update(dt) {
    this.t += dt;
    if (this.flash) this.flash.t += dt;
  }

  q() {
    const q = this.game.sim.causes.of(this.sid);
    return q && q.kind === 'office' ? q : null;
  }

  say(text, color = C.hi) {
    this.flash = { text, color, t: 0 };
  }

  draw(g, game) {
    this.game = game;
    const sim = game.sim;
    const L = sim.layoutOf(this.sid);
    const q = this.q();
    g.fill(0, 0, this.w, this.h, ' ', C.fg, BG);
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, fg: '#e8c070', title: `★ THE ELECTION · ${L ? L.settlement.name.toUpperCase() : ''} ★`, titleFg: '#ffe070' });
    if (!q || !L) {
      g.center(12, 'There\'s no election here now.', C.dim);
      return;
    }
    const pid = sim.office.pid();
    const side = q.cands.findIndex((c) => c.pid === pid);
    const name = (c) => (c.pid ? c.name : full(L.npcs[c.idx]));
    const days = q.end + 1 - game.day;
    g.center(3, q.title.slice(0, this.w - 4), C.white);
    g.center(4, `The town votes on day ${q.end + 1} (${days <= 0 ? 'today' : `in ${days} day${days > 1 ? 's' : ''}`}).`, C.dim);
    // The race, as it stands (worked out once a second).
    if (!this.proj || this.t - this.proj.t > 1) this.proj = { t: this.t, v: sim.causes.tally(L, q), lean: this.leanings(L, q) };
    const [a, b] = this.proj.v;
    const tot = Math.max(1, a + b);
    const cw = 50;
    const x0 = Math.floor((this.w - cw) / 2);
    const left = Math.round((a / tot) * cw);
    g.text(x0, 6, name(q.cands[0]).slice(0, 24), side === 0 ? '#ffe070' : '#ff9a7a');
    const rn = name(q.cands[1]).slice(0, 24);
    g.text(x0 + cw - rn.length, 6, rn, side === 1 ? '#ffe070' : '#ff9a7a');
    for (let i = 0; i < cw; i++) {
      const c = i < left ? (side === 0 ? '#e8c040' : '#c05a48') : side === 1 ? '#e8c040' : '#c05a48';
      g.put(x0 + i, 7, ' ', c, c);
    }
    g.put(x0 + Math.floor(cw / 2), 7, '│', '#ffffff', left > cw / 2 ? (side === 0 ? '#e8c040' : '#c05a48') : side === 1 ? '#e8c040' : '#c05a48');
    g.text(x0, 8, `${a}`, C.white);
    g.text(x0 + cw - `${b}`.length, 8, `${b}`, C.white);
    g.center(8, 'as things stand', C.faint);
    // Each faction's leaning.
    let y = 10;
    g.text(3, y++, 'Faction', C.dim);
    for (const f of FACTION_IDS) {
      const L2 = this.proj.lean[f];
      if (!L2 || !L2.n) continue;
      g.text(3, y, FACTIONS[f].glyph, FACTIONS[f].color);
      g.text(5, y, `${FACTIONS[f].name} (${L2.n})`.slice(0, 22), C.fg);
      const w = 20;
      const yours = side >= 0 ? (side === 1 ? L2.b : L2.a) : L2.b;
      const theirs = side >= 0 ? (side === 1 ? L2.a : L2.b) : L2.a;
      const und = L2.u;
      const ky = Math.round((yours / L2.n) * w);
      const ku = Math.round((und / L2.n) * w);
      for (let i = 0; i < w; i++) {
        const c = i < ky ? '#e8c040' : i < ky + ku ? '#4a4256' : '#c05a48';
        g.put(28 + i, y, ' ', c, c);
      }
      g.text(49, y, `${yours} yours · ${und} unsure · ${theirs} not`.slice(0, 24), C.dim);
      y++;
    }
    y++;
    // Your pledges.
    const mine = (q.pledges && q.pledges[pid]) || [];
    g.text(3, y++, `Your pledges (${mine.length} of 3)`, C.dim);
    if (!mine.length) g.text(4, y++, 'None yet. A pledge wins its faction over, and must be kept in office.', C.faint);
    for (const p of mine) {
      g.text(4, y, FACTIONS[p.f].glyph, FACTIONS[p.f].color);
      g.text(6, y++, `${p.text} (to the ${FACTIONS[p.f].name.toLowerCase()})`.slice(0, 60), C.fg);
    }
    // What you can do.
    y = this.h - 7;
    if (side < 0) {
      g.text(3, y, 'You aren\'t standing in this election.', C.faint);
      return;
    }
    let bx = 3;
    bx = button(this, g, bx, y, ' Make a pledge ', mine.length < 3, () => {
      this.panel = this.panel === 'pledge' ? null : 'pledge';
      this.pkind = null;
    });
    const spoke = q.spoke && q.spoke[pid] === game.day;
    bx = button(this, g, bx, y, spoke ? ' Spoken today ' : ' Speak in the square ', !spoke, () => {
      this.panel = this.panel === 'speak' ? null : 'speak';
    });
    const coins = countItem(game.player.inv, 'coin');
    bx = button(this, g, bx, y, ' Fund it ¤20 ', coins >= 20, () => this.fund(L, q, side, 20), '#e8d8a0');
    bx = button(this, g, bx, y, ' ¤50 ', coins >= 50, () => this.fund(L, q, side, 50), '#e8d8a0');
    g.text(bx + 1, y, `in the campaign: ¤${q.funds[side]}`, C.faint);
    y++;
    if (this.panel === 'pledge') this.drawPledge(g, L, q, y);
    else if (this.panel === 'speak') {
      g.text(3, y++, 'Speak to which faction? (once a day: the undecided among them may come round)', C.dim);
      let px = 3;
      for (const f of FACTION_IDS) {
        if (!this.proj.lean[f] || !this.proj.lean[f].n) continue;
        px = button(this, g, px, y, ` ${FACTIONS[f].glyph} ${FACTIONS[f].name} `, true, () => {
          const r = sim.office.address(L, q, f);
          this.panel = null;
          this.proj = null;
          if (!r.ok) return this.say(r.why, '#ffb080');
          this.say(r.won ? `Your words won over ${r.won} of the ${FACTIONS[f].name.toLowerCase()} (of ${r.heard} who listened).` : `The ${FACTIONS[f].name.toLowerCase()} heard you out, but nobody's mind was changed.`, r.won ? '#a0e8a0' : '#ffb080');
          this.ui.audio?.play(r.won ? 'chime' : 'page');
        }, FACTIONS[f].color);
        if (px > this.w - 16) {
          px = 3;
          y++;
        }
      }
    } else g.text(3, y + 1, 'Talk to townsfolk to win them round one at a time ("What do you make of the vote?").', C.faint);
    if (this.flash && this.flash.t < 4) g.center(this.h - 2, ` ${this.flash.text} `.slice(0, this.w - 4), this.flash.color, 'rgba(20,16,28,0.95)');
    else g.text(2, this.h - 2, 'Esc: close', C.faint);
  }

  drawPledge(g, L, q, y) {
    if (!this.pkind) {
      g.text(3, y++, 'Pledge what?', C.dim);
      let px = 3;
      for (const [k, P] of Object.entries(PLEDGES)) {
        px = button(this, g, px, y, ` ${P.text} `, true, () => {
          this.pkind = k;
        });
        if (px > this.w - 22) {
          px = 3;
          y++;
        }
      }
      return;
    }
    const P = PLEDGES[this.pkind];
    g.text(3, y++, `${P.text}: to which faction?`, C.dim);
    let px = 3;
    for (const f of P.for) {
      if (!this.proj.lean[f] || !this.proj.lean[f].n) continue;
      px = button(this, g, px, y, ` ${FACTIONS[f].glyph} ${FACTIONS[f].name} `, true, () => {
        let law = null;
        if (this.pkind === 'law') law = this.lawFor(L, f);
        if (this.pkind === 'law' && !law) return this.say(`The ${FACTIONS[f].name.toLowerCase()} want no law changed.`, '#ffb080');
        const r = this.game.sim.office.pledge(L, q, this.pkind, f, law);
        this.pkind = null;
        this.panel = null;
        this.proj = null;
        this.say(r.ok ? `You pledged: ${r.text}.` : r.why, r.ok ? '#a0e8a0' : '#ffb080');
      }, FACTIONS[f].color);
      if (px > this.w - 16) {
        px = 3;
        y++;
      }
    }
  }

  // The law a faction most wants changed.
  lawFor(L, f) {
    const M = members(L);
    let best = null;
    for (const id of LAW_IDS) {
      if (!lawFits(L.settlement, id, true) || byDecree(L, id)) continue;
      const on = lawOn(L, id);
      const v = M[f].reduce((n, r) => n + (LAWS[id].stance(r) || 0), 0) / Math.max(1, M[f].length) * (on ? -1 : 1);
      if (v > 0.2 && (!best || v > best.v)) best = { id, v };
    }
    return best ? best.id : null;
  }

  fund(L, q, side, n) {
    const p = this.game.player;
    if (countItem(p.inv, 'coin') < n) return;
    removeItem(p.inv, 'coin', n);
    this.game.sim.causes.fund(L, q, side, n);
    this.proj = null;
    this.say(`¤${n} into the campaign: posters, and ale for the undecided.`, '#e8d8a0');
    this.ui.audio?.play('coin');
  }

  // Each faction: how many lean each way, and how many could go either.
  leanings(L, q) {
    const out = {};
    const c = this.game.sim.causes;
    const votes = c.votes(L, q);
    for (const r of L.npcs) {
      if (!votes.has(r.idx)) continue;
      const f = factionOf(r) || 'crafters';
      const o = (out[f] ||= { n: 0, a: 0, b: 0, u: 0 });
      o.n++;
      const lean = c.lean(L, q, r);
      if (q.swayed[r.idx] === undefined && Math.abs(lean) < 0.25) o.u++;
      else if (votes.get(r.idx)) o.b++;
      else o.a++;
    }
    return out;
  }

  // Bunting across the top.
  drawPixels(ctx) {
    const X = this.x * CHAR_W;
    const Y = (this.y + 1) * CHAR_H;
    const PW = this.w * CHAR_W;
    ctx.strokeStyle = '#8a7050';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const px = X + 8 + (i / 40) * (PW - 16);
      const py = Y + 3 + Math.sin((i / 40) * Math.PI) * 5;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    const cols = ['#e84a50', '#ffe070', '#58a8ff', '#80e070', '#ff9a40'];
    for (let i = 0; i < 26; i++) {
      const f = (i + 0.5) / 26;
      const px = X + 8 + f * (PW - 16);
      const py = Y + 3 + Math.sin(f * Math.PI) * 5;
      const sway = Math.sin(this.t * 2.2 + i) * 1.2;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.moveTo(px - 3, py);
      ctx.lineTo(px + 3, py);
      ctx.lineTo(px + sway, py + 7);
      ctx.closePath();
      ctx.fill();
    }
  }

  onKey(k) {
    if (k.code === 'Escape' || k.code === 'KeyN') {
      if (this.panel) this.panel = null;
      else this.close();
      return true;
    }
    return true;
  }
}

// ------------------------------------------------------------ the count
export class CountWindow extends Window {
  constructor(ui, data) {
    super(ui, 62, 22, { kind: 'officecount' });
    this.d = data;
    this.t = 0;
    this.confetti = [];
    this.game = ui.game || null;
  }

  update(dt) {
    this.t += dt;
    for (const c of this.confetti) {
      c.y += c.vy * dt;
      c.x += Math.sin(this.t * 3 + c.ph) * dt * 8;
      c.vy += dt * 20;
    }
    this.confetti = this.confetti.filter((c) => c.y < this.h * CHAR_H + 10);
  }

  // How far through the count (0..1), and done.
  phase() {
    return Math.min(1, Math.max(0, (this.t - 0.6) / 3.2));
  }

  draw(g, game) {
    this.game = game;
    const d = this.d;
    const L = game.sim.layoutOf(d.sid);
    const recall = d.kind === 'recall';
    g.fill(0, 0, this.w, this.h, ' ', C.fg, BG);
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, fg: '#e8c070', title: recall ? ' THE RECALL VOTE ' : ' THE COUNT ', titleFg: '#ffe070' });
    g.center(2, (L ? L.settlement.name : '').toUpperCase(), C.dim);
    wrap(d.title, this.w - 6).slice(0, 2).forEach((l, i) => g.center(3 + i, l, C.white));
    const p = this.phase();
    const shown = d.t.map((n) => Math.round(n * Math.min(1, p * (1 + 0.15 * Math.sin(this.t * 7)))));
    if (p >= 1) shown.splice(0, 2, ...d.t);
    this.heaps = shown;
    g.text(6, 7, d.names[0].slice(0, 22), d.you === 0 && !recall ? '#ffe070' : C.fg);
    g.text(this.w - 6 - d.names[1].slice(0, 22).length, 7, d.names[1].slice(0, 22), d.you === 1 && !recall ? '#ffe070' : C.fg);
    g.text(6, 16, `${shown[0]}`.padStart(3), C.white);
    g.text(this.w - 9, 16, `${shown[1]}`.padStart(3), C.white);
    // The two tallies, growing out from the middle.
    const half = Math.floor(this.w / 2) - 4;
    const tot = Math.max(1, d.t[0] + d.t[1]);
    const cols = recall ? ['#60c070', '#e05040'] : [d.you === 0 ? '#ffe070' : '#d07060', d.you === 1 ? '#ffe070' : '#d07060'];
    const mid = Math.floor(this.w / 2);
    const k0 = Math.round((shown[0] / tot) * half);
    const k1 = Math.round((shown[1] / tot) * half);
    for (let i = 0; i < half; i++) {
      g.put(mid - 1 - i, 13, ' ', cols[0], i < k0 ? cols[0] : '#221c2a');
      g.put(mid + i, 13, ' ', cols[1], i < k1 ? cols[1] : '#221c2a');
    }
    g.put(mid, 12, '▼', C.dim);
    if (p >= 1) {
      const won = recall ? d.win === 0 : d.win === d.you;
      const word = recall ? (d.win === 1 ? 'RECALLED' : 'YOU STAY') : won ? 'ELECTED' : 'DEFEATED';
      if (!this.sounded) {
        this.sounded = true;
        this.ui.audio?.play(won ? 'fanfare' : 'thud');
        if (won) for (let i = 0; i < 60; i++) this.confetti.push({ x: Math.random() * this.w * CHAR_W, y: -Math.random() * 40, vy: 10 + Math.random() * 30, ph: Math.random() * 6, c: ['#e84a50', '#ffe070', '#58a8ff', '#80e070', '#ff9a40', '#c090ff'][i % 6] });
      }
      g.center(18, ` ${word} `, won ? '#1a1420' : '#ffe0e0', won ? '#ffe070' : '#802020');
      g.center(19, `${d.t[0]} to ${d.t[1]}`, C.dim);
      g.center(20, 'Enter: close', C.faint);
    }
  }

  // Two ballot boxes, the ballots dropping into heaps beside them.
  drawPixels(ctx) {
    const X = this.x * CHAR_W;
    const Y = this.y * CHAR_H;
    const PW = this.w * CHAR_W;
    const heaps = this.heaps || [0, 0];
    const max = Math.max(1, ...this.d.t);
    for (let s = 0; s < 2; s++) {
      const bx = s ? X + PW - 120 : X + 40;
      const by = Y + 9 * CHAR_H;
      // The box.
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(bx, by + 30, 30, 24);
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(bx, by + 30, 30, 3);
      ctx.fillStyle = '#1a1010';
      ctx.fillRect(bx + 9, by + 31, 12, 2);
      ctx.fillStyle = '#c8a040';
      ctx.fillRect(bx + 13, by + 40, 4, 4);
      // The heap: a stack of ballots, the newest falling.
      const n = heaps[s];
      const rows = Math.ceil((n / max) * 10);
      const col = this.d.kind === 'recall' ? (s ? '#e05040' : '#60c070') : s === this.d.you ? '#ffe070' : '#d07060';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 6; c++) {
          if (r * 6 + c >= Math.ceil((n / max) * 60)) break;
          ctx.fillStyle = (r + c) % 2 ? col : '#f0e8d0';
          ctx.fillRect(bx + 36 + c * 5, by + 50 - r * 4, 4, 3);
        }
      }
      if (this.phase() < 1 && n > 0) {
        const f = (this.t * 2.4 + s * 0.5) % 1;
        ctx.fillStyle = '#f0e8d0';
        ctx.fillRect(bx + 13, by + 4 + f * 26, 4, 3);
      }
    }
    for (const c of this.confetti) {
      ctx.fillStyle = c.c;
      ctx.fillRect(X + c.x, Y + c.y, 2, 2);
    }
  }

  onKey(k) {
    if (k.code === 'Escape' || k.code === 'Enter' || k.code === 'Space') {
      if (this.phase() < 1) this.t = 10;
      else this.close();
    }
    return true;
  }

  onClick(ck, cx, cy, game) {
    if (this.phase() < 1) this.t = 10;
    else this.close();
    void ck;
    void cx;
    void cy;
    void game;
    return true;
  }
}

// ------------------------------------------------------------ banners
const BANNER = {
  oath: (d, L) => ({ title: 'SWORN IN', head: `${d.title} of ${L.settlement.name}`, color: CHARTERS[d.charter].color, lines: [{ election: 'Elected by the town.', appointment: 'Appointed by the realm.', acclaim: 'Acclaimed by its people.', coup: 'The hall is yours. The town will remember how.', founding: 'Its founder.' }[d.how] || '', `${L.settlement.name} is governed as ${CHARTERS[d.charter].short}.`, 'Your steward keeps the hall; the council sits every morning at ten.', 'Press N to open your council.'] }),
  charter: (d, L) => ({ title: 'A NEW CHARTER', head: `${L.settlement.name}: ${CHARTERS[d.charter].name}`, color: CHARTERS[d.charter].color, lines: CHARTERS[d.charter].rules }),
  fallen: (d, L) => ({ title: 'OUT OF OFFICE', head: `No longer ${d.title} of ${L.settlement.name}`, color: '#a08080', lines: [`${d.why[0].toUpperCase()}${d.why.slice(1)}.`, `You served ${d.days} day${d.days === 1 ? '' : 's'}.`] }),
  free: (d, L) => ({ title: 'A FREE STATE', head: d.civ, color: '#80e0c0', lines: [`${L.settlement.name} has broken away${d.from ? ` from the ${d.from.replace(/^The /, '')}` : ''}.`, 'You are the head of a realm of your own: its decrees are yours to set (N: the council, Realm).', 'Other towns may yet swear themselves to it.'] }),
  founding: (d, L) => ({ title: 'A VILLAGE BEGUN', head: L.settlement.name, color: '#a0e8a0', lines: ['Your settlers have pitched their tents. The village is yours to govern.', 'Write its charter: how it is to be governed.'], action: 'Write the charter' }),
  offer: (d, L) => ({ title: d.how === 'acclaim' ? 'THE PEOPLE CALL FOR YOU' : 'AN OFFER OF OFFICE', head: `${L.settlement.name}`, color: '#ffe070', lines: [d.text, d.how === 'acclaim' ? 'Lead them, and you\'ll answer to them at the end of the term.' : 'Serve at the realm\'s pleasure: no elections, but the realm can dismiss you.'], yes: true }),
};

export class BannerWindow extends Window {
  constructor(ui, kind, data) {
    super(ui, 58, 18, { kind: 'officebanner' });
    this.k = kind;
    this.d = data;
    this.t = 0;
    this.game = ui.game || null;
  }

  update(dt) {
    this.t += dt;
  }

  draw(g, game) {
    this.game = game;
    const L = game.sim.layoutOf(this.d.sid);
    g.fill(0, 0, this.w, this.h, ' ', C.fg, BG);
    if (!L) return;
    const B = BANNER[this.k](this.d, L);
    this.B = B;
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, fg: B.color, title: ` ${B.title} `, titleFg: B.color });
    g.center(8, B.head.slice(0, this.w - 4), C.white);
    let y = 10;
    for (const l of B.lines) for (const w of wrap(l, this.w - 8)) if (y < this.h - 3) g.center(y++, w, C.dim);
    if (B.yes) {
      let x = Math.floor(this.w / 2) - 12;
      x = button(this, g, x, this.h - 2, ' Accept ', true, () => this.answer(true), '#a0e8a0');
      button(this, g, x + 2, this.h - 2, ' Decline ', true, () => this.answer(false), '#ff9a7a');
    } else if (B.action) {
      button(this, g, Math.floor((this.w - B.action.length - 2) / 2), this.h - 2, ` ${B.action} `, true, () => this.act());
    } else g.center(this.h - 2, 'Enter: close', C.faint);
  }

  answer(yes) {
    const r = this.game.sim.office.answer(yes);
    this.close();
    if (yes && r.ok) this.ui.open(new BannerWindow(this.ui, 'oath', { sid: this.d.sid, how: this.d.how, title: this.game.sim.office.title(r.L), charter: this.game.sim.office.of(this.d.sid).charter }));
  }

  act() {
    this.close();
    if (this.k === 'founding') this.ui.open(new CouncilWindow(this.ui, this.d.sid, 'charter'));
  }

  // A great wax seal (or, out of office, a broken one), slowly turning in
  // the light, the charter's colours behind.
  drawPixels(ctx) {
    const B = this.B;
    if (!B) return;
    const cx = (this.x + this.w / 2) * CHAR_W;
    const cy = (this.y + 4) * CHAR_H;
    const k = Math.min(1, this.t / 0.5);
    const r = 18 * (1.6 - 0.6 * (1 - Math.pow(1 - k, 3)));
    // Rays.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.t * 0.15);
    ctx.globalAlpha = 0.18 * k;
    ctx.fillStyle = B.color;
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(60, -6);
      ctx.lineTo(60, 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = k;
    const wax = this.k === 'fallen' ? '#5a4a50' : this.k === 'free' ? '#2a8a7a' : '#b81e2c';
    ctx.fillStyle = wax;
    ctx.beginPath();
    for (let j = 0; j < 18; j++) {
      const a = (j / 18) * Math.PI * 2;
      const rr = r + (j % 2 ? 2 : -1);
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = this.k === 'fallen' ? '#6a5a60' : this.k === 'free' ? '#40b0a0' : '#d83040';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // The town's mark pressed into it: a tower and a star.
    ctx.fillStyle = this.k === 'fallen' ? '#4a3a40' : 'rgba(255,220,180,0.85)';
    ctx.fillRect(cx - 4, cy - 6, 8, 11);
    ctx.fillRect(cx - 6, cy - 8, 3, 3);
    ctx.fillRect(cx - 1, cy - 8, 3, 3);
    ctx.fillRect(cx + 4, cy - 8, 3, 3);
    ctx.fillStyle = this.k === 'fallen' ? '#6a5a60' : this.k === 'free' ? '#40b0a0' : '#d83040';
    ctx.fillRect(cx - 1, cy, 2, 5);
    if (this.k === 'fallen') {
      // Cracked across.
      ctx.strokeStyle = '#1a1014';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - 4);
      ctx.lineTo(cx - 3, cy + 2);
      ctx.lineTo(cx + 4, cy - 3);
      ctx.lineTo(cx + r, cy + 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  onKey(k) {
    if (k.code === 'Escape' || ((k.code === 'Enter' || k.code === 'Space') && !this.B?.yes)) {
      if (this.B && this.B.action && k.code !== 'Escape') this.act();
      else this.close();
    }
    return true;
  }
}

// ------------------------------------------------------------ a seat's vote
export class VoteWindow extends Window {
  constructor(ui, data) {
    super(ui, 60, 20, { kind: 'officevote' });
    this.d = data;
    this.game = ui.game || null;
  }

  draw(g, game) {
    this.game = game;
    const o = game.sim.office;
    const L = game.sim.layoutOf(this.d.sid);
    const T = o.of(this.d.sid);
    const it = T && T.agenda.find((q) => q.id === this.d.id);
    g.fill(0, 0, this.w, this.h, ' ', C.fg, BG);
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, fg: '#a0e8ff', title: ` THE COUNCIL OF ${L ? L.settlement.name.toUpperCase() : ''} VOTES `, titleFg: '#a0e8ff' });
    if (!it || it.state !== 'voting' || !it.vote) {
      g.center(8, 'The vote is over.', C.dim);
      g.center(this.h - 2, 'Enter: close', C.faint);
      return;
    }
    const opt = it.opts[it.choice];
    let y = 2;
    g.text(3, y++, `${headTitle(T.charter, L.settlement)} ${T.holder.name} proposes:`, C.dim);
    wrap(`${it.title.replace(/\?$/, '')}: ${opt.label}`, this.w - 6).forEach((l) => g.text(3, y++, l, C.hi));
    y++;
    for (const p of it.why) for (const l of wrap(p, this.w - 6)) if (y < 12) g.text(3, y++, l, C.dim);
    const st = stated(game.sim, L, T, opt, CHARTERS, game.day);
    y = 13;
    if (st.lines[0]) g.text(3, y++, st.lines[0].text.slice(0, this.w - 6), '#c8b890');
    let fx = 3;
    for (const f of FACTION_IDS) {
      const d = st.by[f];
      if (d === undefined) continue;
      g.put(fx, y, FACTIONS[f].glyph, FACTIONS[f].color);
      g.put(fx + 1, y, d >= 1 ? '▲' : d <= -1 ? '▼' : '·', d >= 1 ? '#a8e070' : d <= -1 ? '#ff8060' : C.faint);
      fx += 4;
    }
    const mine = it.vote.ballots.find((b) => b.pid === o.pid());
    if (mine && mine.v === null) {
      let x = 14;
      x = button(this, g, x, this.h - 3, ' ✓ Vote for it ', true, () => this.cast(true), '#a0e8a0');
      button(this, g, x + 2, this.h - 3, ' × Vote against it ', true, () => this.cast(false), '#ff9a7a');
    } else g.center(this.h - 3, 'You\'ve voted. The council will have its answer soon.', C.dim);
    g.text(2, this.h - 2, 'Esc: decide later (N: the council)', C.faint);
  }

  cast(aye) {
    this.game.sim.office.cast(this.d.sid, this.d.id, aye);
    this.ui.audio?.play('select');
    this.close();
  }

  onKey(k) {
    if (k.code === 'Escape') this.close();
    return true;
  }
}
