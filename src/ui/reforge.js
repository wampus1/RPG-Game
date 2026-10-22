// (Round 78) The anvil's other work (see game/reforge.js): a piece of gear
// from your pack reforged, or a modifier moved off one piece onto another
// of the same kind. Pick the piece on the left; what can be done with it,
// and what it costs, on the right.
// (Round 132) Reforging and tempering are worked at the forge, by hand (see
// ui/forgewin.js, game/smithing.js); a piece of your own pressed into a
// blank cast; a cast poured, as many copies as the makings allow.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS } from '../world/items.js';
import { parseStar, modOf, gearClass, starText, modLine } from '../world/quality.js';
import { bindings, rebindable, rebindCost, rebind } from '../game/rebind.js';
import { TRIGGERS } from '../world/triggers.js';
import { countItem } from '../game/inventory.js';
import { workable, moveCost, movable, moveMod } from '../game/reforge.js';
import { reforgeCostOf, pressCast, recipeFor, masteryCap } from '../game/smithing.js';
import { mastery } from '../game/mastery.js';
import { lifts } from '../world/smithmats.js';
import { craftSources, countFrom } from '../game/invtools.js';
import { openForge } from './forgewin.js';

export class ReforgeWindow extends Window {
  constructor(ui) {
    super(ui, 70, 26, { kind: 'reforge' });
    this.sel = -1;
    this.target = -1;
    this.mod = null;
    this.scroll = 0;
    this.view = null;
    this.bindSel = -1;
  }
  pieces(game) {
    const inv = game.player.inv;
    const out = [];
    inv.forEach((s, i) => {
      if (s && (workable(s.item) || (ITEMS[s.item] && ITEMS[s.item].cast))) out.push(i);
    });
    return out;
  }
  draw(g, game) {
    const inv = game.player.inv;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, C.bg);
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'THE ANVIL · REFORGE · TEMPER · CASTS · MOVE · TRIGGERS' });
    const list = this.pieces(game);
    if (!list.includes(this.sel)) this.sel = -1;
    if (!list.includes(this.target) || this.target === this.sel) this.target = -1;
    g.text(2, 1, 'Your gear', C.dim);
    if (!list.length) g.text(2, 3, 'Nothing in your pack to work.', C.faint);
    const per = 20;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, list.length - per)));
    list.slice(this.scroll, this.scroll + per).forEach((i, k) => {
      const y = 2 + k;
      const it = ITEMS[inv[i].item];
      const on = i === this.sel;
      const tgt = i === this.target;
      const hov = this.hovering(1, y, 30, 1);
      g.fill(1, y, 30, 1, ' ', C.fg, on ? '#3a3050' : tgt ? '#203a30' : hov ? '#2a2236' : undefined);
      g.text(2, y, (it.stars ? starText(it.stars).slice(0, it.stars) + ' ' : '') + it.name.slice(0, 26 - (it.stars || 0)), on ? C.white : tgt ? '#a0e8c0' : C.fg);
      this.hit(1, y, 30, 1, () => {
        // (A second piece picked, of the same kind, while one has
        // modifiers: where a modifier would go.)
        if (this.sel >= 0 && i !== this.sel && movable(inv[this.sel].item, inv[i].item).length) {
          this.target = this.target === i ? -1 : i;
          this.mod = null;
        } else {
          this.sel = i === this.sel ? -1 : i;
          this.target = -1;
          this.mod = null;
          this.view = null;
          this.bindSel = -1;
        }
        this.ui.audio?.play('select');
      });
    });
    const x = 34;
    if (this.sel < 0) {
      wrap('Pick a piece on the left to reforge it at the forge (its modifiers beaten out afresh, its stars kept, any far land\'s mark kept), or to temper it (a rare material worked in, for a star more).', 33).forEach((l, k) => g.text(x, 2 + k, l, C.dim));
      wrap('Or pick the piece a modifier\'s on, then the piece of the same kind it\'s to go onto: the first is used up in the doing.', 33).forEach((l, k) => g.text(x, 9 + k, l, C.dim));
      wrap('A piece you forged yourself can be pressed into a blank cast; a cast, poured again and again.', 33).forEach((l, k) => g.text(x, 14 + k, l, C.dim));
      wrap('A piece with triggers can have them change round what each sets off.', 33).forEach((l, k) => g.text(x, 18 + k, l, C.dim));
      return;
    }
    const s = inv[this.sel];
    if (ITEMS[s.item] && ITEMS[s.item].cast) return this.drawCast(g, game, s, x);
    const it = ITEMS[s.item];
    const p = parseStar(s.item);
    const cls = gearClass(it.stars ? ITEMS[it.plain] : it);
    g.text(x, 2, it.name.slice(0, 34), C.hi);
    g.text(x, 3, p ? starText(p.stars) : 'No stars yet', p ? '#ffd060' : C.faint);
    // (Round 137) Its triggers, and what each sets off.
    if (this.view === 'bind' && this.target < 0) return this.drawBind(g, game, s, x);
    let y = 4;
    // (One line each: what each does is in the piece's own description.)
    for (const m of p ? p.mods : []) {
      const l = modLine(cls, m);
      if (!l) continue;
      const d = modOf(cls, m);
      const t = d.trig && TRIGGERS[d.trig];
      g.text(x, y++, `${l.glyph} ${l.name}${t ? ` ← ${TRIGGERS[d.trig].trait}` : ''}`.slice(0, 35), l.color);
    }
    y++;
    const coins = countItem(inv, 'coin');
    const costLine = (c) => `¤${c.coin} and ${c.n} ${ITEMS[c.item].name}${c.n > 1 ? 's' : ''}`;
    const ok = (c) => coins >= c.coin && countItem(inv, c.item) >= c.n;
    const button = (yy, label, can, fn) => {
      const hov = this.hovering(x, yy, label.length, 1);
      g.text(x, yy, label, can ? (hov ? C.white : C.hi) : C.faint, can ? (hov ? '#4a3a60' : '#2a2230') : undefined);
      if (can) this.hit(x, yy, label.length, 1, (ck, gm) => fn(gm || game));
    };
    if (this.target < 0) {
      const c = reforgeCostOf(s.item);
      const src = craftSources(game);
      const canR = coins >= c.coin && countFrom(src, c.item) >= 1;
      g.text(x, y++, `Reforge: ¤${c.coin} and ${c.name}`, canR ? C.fg : C.red);
      button(y++, ' Reforge it at the forge ', canR, (gm) => {
        this.close();
        openForge(this.ui, gm, null, { mode: 'reforge', slot: this.sel, station: 'anvil' });
      });
      y++;
      // (Round 132) Tempering: a rare material for a star more.
      const cap = masteryCap(mastery(game, 'smithing').rank);
      const rare = inv.some((q) => q && lifts(q.item));
      const stars = p ? p.stars : 1;
      g.text(x, y++, stars >= 5 ? 'Temper: it has all the stars it can.' : stars >= cap ? `Temper: your rank allows ${cap} stars.` : `Temper: a rare material${rare ? '' : ' (you have none)'}`, stars < cap && rare ? C.fg : C.red);
      button(y++, ' Temper it at the forge ', stars < Math.min(5, cap) && rare, (gm) => {
        this.close();
        openForge(this.ui, gm, null, { mode: 'temper', slot: this.sel, station: 'anvil' });
      });
      y++;
      // (Round 132) A piece of your own, pressed into a blank cast.
      if (p && p.origin === 'c') {
        const blanks = countItem(inv, 'blank_cast');
        g.text(x, y++, `Press a cast: a blank cast${blanks ? ` (${blanks})` : ' (none)'}`, blanks ? C.fg : C.red);
        button(y++, ' Press it into a cast ', blanks > 0, (gm) => {
          const r = pressCast(gm, s.item);
          this.ui.msg(r.text, r.ok ? '#ffd060' : '#ffb080');
        });
        y++;
      }
      // (Round 137) What its triggers set off, changed round.
      if (rebindable(s.item)) {
        button(y++, ' Change round its triggers ', true, () => {
          this.view = 'bind';
          this.bindSel = -1;
          this.ui.audio?.play('select');
        });
        y++;
      }
      if (p && p.mods.length) wrap('To move one of its modifiers, pick the piece it\'s to go onto (green when it can).', 34).forEach((l) => g.text(x, y++, l, C.faint));
      return;
    }
    const t = inv[this.target];
    const can = movable(s.item, t.item);
    g.text(x, y++, `Onto: ${ITEMS[t.item].name}`.slice(0, 34), '#a0e8c0');
    g.text(x, y++, 'Which modifier:', C.dim);
    for (const m of can) {
      const d = modOf(cls, m);
      const on = this.mod === m;
      const hov = this.hovering(x, y, 30, 1);
      g.text(x, y, `${on ? '►' : ' '} ${d.name}`, on ? C.white : hov ? C.hi : C.fg, on ? '#3a3050' : undefined);
      this.hit(x, y, 30, 1, () => {
        this.mod = m;
        this.ui.audio?.play('select');
      });
      y++;
    }
    y++;
    const c = moveCost(t.item);
    g.text(x, y++, `Cost: ${costLine(c)}`, ok(c) ? C.fg : C.red);
    g.text(x, y++, `(${it.name.slice(0, 20)} is used up)`, C.faint);
    button(y++, ' Move the modifier ', ok(c) && !!this.mod, (gm) => {
      const r = moveMod(gm, this.sel, this.target, this.mod);
      if (!r.ok) return this.ui.msg(r.why, '#ffb080');
      this.ui.msg(`The ${modOf(cls, this.mod).name.toLowerCase()} mark is beaten into your ${ITEMS[r.key].name}.`, '#ffd060');
      this.sel = gm.player.inv.findIndex((q) => q && q.item === r.key);
      this.target = -1;
      this.mod = null;
    });
  }
  // (Round 137) A piece's triggers, each with what it sets off: pick two,
  // and they trade (for a little of what the piece is made of, and coin).
  drawBind(g, game, s, x) {
    const it = ITEMS[s.item];
    const inv = game.player.inv;
    const list = bindings(s.item);
    g.text(x, 2, it.name.slice(0, 34), C.hi);
    g.text(x, 3, 'What each trigger sets off:', C.dim);
    let y = 5;
    list.forEach((b, k) => {
      const on = this.bindSel === b.i;
      const hov = this.hovering(x, y, 35, 2);
      g.fill(x, y, 35, 2, ' ', C.fg, on ? '#3a3050' : hov ? '#2a2236' : undefined);
      g.text(x, y, `${k + 1}. ${b.when}`.slice(0, 35), on ? C.white : b.rate.color);
      g.text(x + 3, y + 1, `→ ${b.ab ? '☼' : '♦'} ${b.name}`.slice(0, 32), b.ab ? '#ffb0f0' : '#90c8f8');
      this.hit(x, y, 35, 2, (ck, gm) => {
        const game2 = gm || game;
        if (!(this.bindSel >= 0) || this.bindSel === b.i) {
          this.bindSel = this.bindSel === b.i ? -1 : b.i;
          this.ui.audio?.play('select');
          return;
        }
        const slot = game2.player.inv.findIndex((q) => q && q.item === s.item);
        const r = rebind(game2, slot, this.bindSel, b.i);
        this.bindSel = -1;
        if (!r.ok) return this.ui.msg(r.why, '#ffb080');
        this.sel = game2.player.inv.findIndex((q) => q && q.item === r.key);
        this.ui.msg('The marks on it are beaten round: its triggers set off one another\'s now.', '#90c8f8');
      });
      y += 2;
    });
    y++;
    const c = rebindCost(s.item);
    const src = craftSources(game);
    const can = countItem(inv, 'coin') >= c.coin && countFrom(src, c.item) >= c.n;
    g.text(x, y++, `Each change: ¤${c.coin} and ${c.n} ${c.name}${c.n > 1 ? 's' : ''}`.slice(0, 35), can ? C.fg : C.red);
    wrap(!(this.bindSel >= 0) ? 'Pick a trigger, then another: they trade what they set off. Nothing is added or taken away.' : 'Now pick the trigger it\'s to trade with.', 34).forEach((l) => g.text(x, y++, l, C.faint));
    y++;
    const label = ' Back ';
    const hov = this.hovering(x, y, label.length, 1);
    g.text(x, y, label, hov ? C.white : C.hi, hov ? '#4a3a60' : '#2a2230');
    this.hit(x, y, label.length, 1, () => {
      this.view = null;
      this.bindSel = -1;
      this.ui.audio?.play('select');
    });
  }
  // (Round 132) A cast: poured as many times as you like, for its
  // makings and a relic shard each.
  drawCast(g, game, s, x) {
    const it = ITEMS[s.item];
    const of = ITEMS[it.cast];
    const sp = parseStar(it.cast);
    const r = recipeFor(sp ? sp.plain : it.cast);
    g.text(x, 2, it.name.slice(0, 34), C.hi);
    g.text(x, 3, of ? `${starText(of.stars || 0)} ${of.name}`.slice(0, 34) : '?', '#ffd060');
    let y = 4;
    for (const m of (of && of.mods) || []) {
      const d = modOf(of.gear, m);
      if (d) g.text(x, y++, `◆ ${d.name}`.slice(0, 34), d.flaw ? C.red : '#f0c070');
    }
    y++;
    if (!r) {
      g.text(x, y, 'There\'s no knowing how to make it.', C.faint);
      return;
    }
    const src = craftSources(game);
    this.times = Math.max(1, Math.min(99, this.times || 1));
    const n = this.times;
    g.text(x, y++, 'Each pour takes:', C.dim);
    const need = { ...r.in, relic_shard: 1 };
    let ok = true;
    for (const [k, c] of Object.entries(need)) {
      const have = countFrom(src, k);
      const good = have >= c * n;
      ok &&= good;
      g.text(x + 1, y++, `${c * n} ${ITEMS[k] ? ITEMS[k].name : k} (${have})`.slice(0, 33), good ? C.green : C.red);
    }
    y++;
    const lbl = (t) => `[${t}]`;
    g.text(x, y, 'Copies:', C.dim);
    const bx = x + 8;
    for (const [t, d, xx] of [['-', -1, bx], ['+', 1, bx + 8], ['+5', 5, bx + 12]]) {
      const hov = this.hovering(xx, y, lbl(t).length, 1);
      g.text(xx, y, lbl(t), hov ? C.white : C.hi, hov ? '#4a3a60' : undefined);
      this.hit(xx, y, lbl(t).length, 1, () => {
        this.times = Math.max(1, Math.min(99, this.times + d));
        this.ui.audio?.play('select');
      });
    }
    g.text(bx + 4, y, String(n).padStart(2), C.white);
    y += 2;
    const label = ` Pour ${n} at the forge `;
    const hov = this.hovering(x, y, label.length, 1);
    g.text(x, y, label, ok ? (hov ? C.white : C.hi) : C.faint, ok ? (hov ? '#4a3a60' : '#2a2230') : undefined);
    if (ok) this.hit(x, y, label.length, 1, (ck, gm) => {
      this.close();
      openForge(this.ui, gm || game, r, { mode: 'cast', cast: s.item, times: n, station: 'anvil' });
    });
    y += 2;
    wrap('Each copy comes out exactly as the piece was, its stars and modifiers and all.', 34).forEach((l) => g.text(x, y++, l, C.faint));
  }
  onWheel(d) {
    this.scroll += d;
  }
  onKey(k) {
    if (k.code === 'Escape' && this.view) {
      this.view = null;
      this.bindSel = -1;
      return true;
    }
    if (k.code === 'Escape') {
      this.close();
      return true;
    }
    return false;
  }
}
