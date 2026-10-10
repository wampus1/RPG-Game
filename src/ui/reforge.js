// (Round 78) The anvil's other work (see game/reforge.js): a piece of gear
// from your pack reforged, or a modifier moved off one piece onto another
// of the same kind. Pick the piece on the left; what can be done with it,
// and what it costs, on the right.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS } from '../world/items.js';
import { parseStar, modOf, gearClass, starText } from '../world/quality.js';
import { countItem } from '../game/inventory.js';
import { workable, reforgeCost, moveCost, reforge, movable, moveMod } from '../game/reforge.js';

export class ReforgeWindow extends Window {
  constructor(ui) {
    super(ui, 70, 26, { kind: 'reforge' });
    this.sel = -1;
    this.target = -1;
    this.mod = null;
    this.scroll = 0;
  }
  pieces(game) {
    const inv = game.player.inv;
    const out = [];
    inv.forEach((s, i) => {
      if (s && workable(s.item)) out.push(i);
    });
    return out;
  }
  draw(g, game) {
    const inv = game.player.inv;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, C.bg);
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'THE ANVIL · REFORGE · MOVE A MODIFIER' });
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
        }
        this.ui.audio?.play('select');
      });
    });
    const x = 34;
    if (this.sel < 0) {
      wrap('Pick a piece on the left to reforge it: beaten out afresh, its make and modifiers rolled again, its stars kept (now and then one more), any far land\'s mark kept.', 33).forEach((l, k) => g.text(x, 2 + k, l, C.dim));
      wrap('Or pick the piece a modifier\'s on, then the piece of the same kind it\'s to go onto: the first is used up in the doing.', 33).forEach((l, k) => g.text(x, 8 + k, l, C.dim));
      return;
    }
    const s = inv[this.sel];
    const it = ITEMS[s.item];
    const p = parseStar(s.item);
    const cls = gearClass(it.stars ? ITEMS[it.plain] : it);
    g.text(x, 2, it.name.slice(0, 34), C.hi);
    g.text(x, 3, p ? starText(p.stars) : 'No stars yet', p ? '#ffd060' : C.faint);
    let y = 4;
    for (const m of p ? p.mods : []) {
      const d = modOf(cls, m);
      for (const [j, l] of wrap(`${d.land ? '✦' : '◆'} ${d.name}: ${d.about}`, 34).entries()) g.text(x, y++, j ? `  ${l}` : l, d.land ? '#80e8d0' : '#f0c070');
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
      const c = reforgeCost(s.item);
      g.text(x, y++, `Reforge: ${costLine(c)}`, ok(c) ? C.fg : C.red);
      button(y++, ' Reforge it ', ok(c), (gm) => {
        const r = reforge(gm, this.sel);
        if (!r.ok) return this.ui.msg(r.why, '#ffb080');
        this.ui.msg(`Reforged: ${ITEMS[r.key].name} ${starText(ITEMS[r.key].stars)}${ITEMS[r.key].mods.length ? ` (${ITEMS[r.key].mods.map((m) => modOf(ITEMS[r.key].gear, m).name).join(', ')})` : ''}.`, '#ffd060');
        this.sel = gm.player.inv.findIndex((q) => q && q.item === r.key);
      });
      y++;
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
  onWheel(d) {
    this.scroll += d;
  }
  onKey(k) {
    if (k.code === 'Escape') {
      this.close();
      return true;
    }
    return false;
  }
}
