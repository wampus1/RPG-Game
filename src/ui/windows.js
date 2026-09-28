// All UI windows. Each draws itself into a character grid every frame.
import { COLS, ROWS, MAP_W, MAP_H, REGION_W, REGION_D, BELT_SIZE, CHAR_W, CHAR_H, INV_SIZE } from '../config.js';
import { Window, cap, describeActivity } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS, maxStack, WEAR_SLOTS } from '../world/items.js';
import { recipesFor, STATIONS } from '../world/recipes.js';
import { addItem, removeItem, countItem } from '../game/inventory.js';
import { BIOMES } from '../world/biomes.js';
import { openingLine, topicsFor, respond } from '../game/dialogue.js';
import { humanoidSheet, SPR_PAD, SHEET_H } from '../render/sprites.js';
import { STOCK, WANTS, st, mayorOf, alive, stockOf } from '../sim/econ.js';
import { TIERS } from '../sim/growth.js';
import { BUILDING_NAMES } from '../world/settlement.js';
import { repLevel, RENOWN } from '../sim/sim.js';
import { describe, lcFirst } from '../sim/justice.js';
import { SLOTS, agoText, timeText } from '../game/saves.js';

// ---------------------------------------------------------------- slot tables
function slotTable(win, g, x, y, cols, slots, start, count, opts = {}) {
  const rows = Math.ceil(count / cols);
  const ui = win.ui;
  const fg = opts.fg || C.dim;
  for (let r = 0; r <= rows; r++) {
    const yy = y + r * 3;
    let line = r === 0 ? '┌' : r === rows ? '└' : '├';
    for (let c = 0; c < cols; c++) line += '───' + (c < cols - 1 ? (r === 0 ? '┬' : r === rows ? '┴' : '┼') : r === 0 ? '┐' : r === rows ? '┘' : '┤');
    g.text(x, yy, line, fg);
    if (r < rows) for (let c = 0; c <= cols; c++) {
      g.put(x + c * 4, yy + 1, '│', fg);
      g.put(x + c * 4, yy + 2, '│', fg);
    }
  }
  for (let k = 0; k < count; k++) {
    const i = start + k;
    const c = k % cols;
    const r = Math.floor(k / cols);
    const sx = x + 1 + c * 4;
    const sy = y + 1 + r * 3;
    const hover = win.hovering(sx, sy, 3, 2);
    const sel = opts.selected === i;
    g.fill(sx, sy, 3, 2, ' ', C.fg, sel ? C.bgHi : hover ? 'rgba(70,60,90,0.95)' : 'rgba(26,22,34,0.95)');
    const s = slots[i];
    if (s) g.icon(sx, sy, s.item, s.count);
    if (hover && s) ui.itemTooltip(s);
    win.hit(sx, sy, 3, 2, (ck, game) => {
      if (opts.onClick) opts.onClick(i, ck, game);
      else slotClick(ui, slots, i, ck, opts.quick ? opts.quick() : null);
    });
  }
  return rows * 3 + 1;
}

export function slotClick(ui, slots, i, ck, quickTarget) {
  const s = slots[i];
  const cs = ui.cursorStack;
  if (ck.shift && s && quickTarget) {
    const left = addItem(quickTarget, s.item, s.count);
    if (left) s.count = left;
    else slots[i] = null;
    ui.audio?.play('select');
    return;
  }
  if (ck.button === 0) {
    if (!cs) {
      if (!s) return;
      ui.cursorStack = s;
      slots[i] = null;
    } else if (!s) {
      slots[i] = cs;
      ui.cursorStack = null;
    } else if (s.item === cs.item) {
      const room = maxStack(s.item) - s.count;
      const mv = Math.min(room, cs.count);
      s.count += mv;
      cs.count -= mv;
      if (cs.count <= 0) ui.cursorStack = null;
    } else {
      slots[i] = cs;
      ui.cursorStack = s;
    }
  } else if (ck.button === 2) {
    if (!cs && s) {
      const half = Math.ceil(s.count / 2);
      ui.cursorStack = { item: s.item, count: half };
      s.count -= half;
      if (s.count <= 0) slots[i] = null;
    } else if (cs && (!s || (s.item === cs.item && s.count < maxStack(s.item)))) {
      if (!s) slots[i] = { item: cs.item, count: 1 };
      else s.count++;
      cs.count--;
      if (cs.count <= 0) ui.cursorStack = null;
    }
  }
  ui.audio?.play('select');
}

// ---------------------------------------------------------------- inventory
export class InventoryWindow extends Window {
  constructor(ui) {
    super(ui, 76, 20, { kind: 'inventory' });
  }
  draw(g, game) {
    const p = game.player;
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'INVENTORY' });
    g.text(2, 1, 'Belt (1-9)', C.dim);
    slotTable(this, g, 1, 2, 9, p.inv, 0, BELT_SIZE, { selected: p.selected, quick: () => p.inv.slice(BELT_SIZE), onClick: (i, ck) => this.click(p, i, ck) });
    g.text(2, 6, 'Backpack', C.dim);
    slotTable(this, g, 1, 7, 9, p.inv, BELT_SIZE, INV_SIZE - BELT_SIZE, { onClick: (i, ck) => this.click(p, i, ck) });
    // What you're wearing: drop armour or clothes on a place to put it on,
    // click it to take it off.
    g.text(40, 1, 'Worn', C.dim);
    WEAR_SLOTS.forEach((k, j) => {
      const sx = 40;
      const sy = 2 + j * 4;
      const hov = this.hovering(sx, sy, 3, 2);
      g.box(sx - 1, sy - 1, 5, 4, { fg: C.faint });
      g.fill(sx, sy, 3, 2, ' ', C.fg, hov ? 'rgba(70,60,90,0.95)' : 'rgba(26,22,34,0.95)');
      const it = p.equip[k] && ITEMS[p.equip[k]];
      if (it) {
        g.icon(sx, sy, p.equip[k], 0);
        if (hov) this.ui.itemTooltip({ item: p.equip[k], count: 1 });
      } else g.text(sx + 1, sy, '·', C.faint);
      g.text(sx + 5, sy, cap(k), it ? C.fg : C.faint);
      g.text(sx + 5, sy + 1, it ? (it.armor ? `-${Math.round(it.armor * 100)}%` : 'worn') : '', C.dim);
      this.hit(sx, sy, 3, 2, () => this.wearClick(p, k));
    });
    g.text(40, 18, `Armour ${Math.round(p.armorValue() * 100)}%`, C.cyan);
    // Stats panel.
    const x = 53;
    g.box(x - 1, 1, 23, 17, { fg: C.faint });
    const pr = playerProfile(game);
    g.text(x + 1, 2, pr.name.toUpperCase().slice(0, 20), C.hi);
    wrap(pr.title, 20).slice(0, 2).forEach((l, i) => g.text(x + 1, 3 + i, l, pr.citizen ? C.green : C.cyan));
    if (pr.job) g.text(x + 1, 5, pr.job.slice(0, 20), C.purple);
    if (pr.renown) g.text(x + 1, pr.job ? 6 : 5, pr.renown.title.slice(0, 20), C.hi);
    g.text(x + 1, 7, `HP     ${Math.ceil(p.hp)}/${p.maxHp}`, C.red);
    g.text(x + 1, 8, `Coins  ¤${countItem(p.inv, 'coin')}`, C.hi);
    g.text(x + 1, 9, `Day    ${game.day}`, C.fg);
    g.text(x + 1, 10, `Mined ${game.stats.mined} · Kills ${game.stats.kills}`.slice(0, 20), C.dim);
    g.text(x + 1, 11, `Fish ${game.stats.fish || 0} · Saved ${game.stats.rescues || 0}`.slice(0, 20), C.dim);
    const held = p.heldDef();
    g.text(x + 1, 12, 'Holding:', C.dim);
    g.text(x + 1, 13, held ? held.name.slice(0, 20) : '(empty hand)', C.fg);
    g.text(x + 1, 14, 'SHIFT+click: move', C.faint);
    g.text(x + 1, 15, 'Right-click armour:', C.faint);
    g.text(x + 1, 16, 'wear · C craft · J', C.faint);
    g.text(2, 19, ' Drag outside to drop ', C.faint);
  }
  // A worn place clicked: put on what's on the cursor, or take off what's there.
  wearClick(p, k) {
    const ui = this.ui;
    const cs = ui.cursorStack;
    if (cs) {
      const it = ITEMS[cs.item];
      if (!it || it.kind !== 'armor' || it.slot !== k) {
        ui.audio?.play('error');
        return;
      }
      const old = p.equip[k];
      p.equip[k] = cs.item;
      ui.cursorStack = old ? { item: old, count: 1 } : cs.count > 1 ? { item: cs.item, count: cs.count - 1 } : null;
      ui.audio?.play('equip');
      return;
    }
    if (p.equip[k]) {
      ui.cursorStack = { item: p.equip[k], count: 1 };
      p.equip[k] = null;
      ui.audio?.play('select');
    }
  }
  click(p, i, ck) {
    const other = i < BELT_SIZE ? [...Array(INV_SIZE - BELT_SIZE).keys()].map((k) => k + BELT_SIZE) : [...Array(BELT_SIZE).keys()];
    // Right-click (or shift-click) armour to put it on.
    if ((ck.button === 2 || ck.shift) && p.inv[i] && ITEMS[p.inv[i].item]?.kind === 'armor' && !this.ui.cursorStack) {
      if (p.wear(i)) this.ui.audio?.play('equip');
      return;
    }
    if (ck.shift && p.inv[i]) {
      const s = p.inv[i];
      p.inv[i] = null;
      const left = addItem(p.inv, s.item, s.count, other);
      if (left) p.inv[i] = { item: s.item, count: left };
      return;
    }
    slotClick(this.ui, p.inv, i, ck, null);
  }
}

// ---------------------------------------------------------------- container
export class ContainerWindow extends Window {
  constructor(ui, title, slots, pos) {
    const rows = Math.ceil(slots.length / 9);
    super(ui, 39, 3 + rows * 3 + 1 + 2 + 13 + 1, { kind: 'container' });
    this.title = title;
    this.slots = slots;
    this.pos = pos;
    this.snap = this.counts();
    this.inside = this.counts(false);
  }
  counts(held = true) {
    const m = {};
    for (const s of this.slots) if (s) m[s.item] = (m[s.item] || 0) + s.count;
    // An item picked up with the cursor hasn't left the chest yet.
    const cs = this.ui.cursorStack;
    if (held && cs) m[cs.item] = (m[cs.item] || 0) + cs.count;
    return m;
  }
  onClose(game) {
    if (game && this.pos.owner) this.checkTaken(game, false);
  }
  // Notice items leaving someone else's container (possible theft).
  checkTaken(game, held = true) {
    const now = this.counts(held);
    const taken = [];
    const added = [];
    for (const [k, n] of Object.entries(this.snap)) {
      const d = n - (now[k] || 0);
      if (d > 0) taken.push({ item: k, count: d });
    }
    // What landed in the container itself since last time (drag or shift-click).
    const settled = this.counts(false);
    for (const [k, n] of Object.entries(settled)) {
      const d = n - (this.inside[k] || 0);
      if (d > 0) added.push({ item: k, count: d });
    }
    this.inside = settled;
    this.snap = now;
    if (added.length && game.onContainerPut && game.onContainerPut(this.pos, added)) {
      this.snap = this.counts(held);
      this.inside = this.counts(false);
    }
    if (taken.length && game.onContainerTake(this.pos, taken) && held) this.close();
  }
  draw(g, game) {
    const p = game.player;
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: this.title.toUpperCase() });
    const h = slotTable(this, g, 1, 1, 9, this.slots, 0, this.slots.length, { quick: () => p.inv });
    g.text(2, 1 + h, 'Your inventory', C.dim);
    slotTable(this, g, 1, 2 + h, 9, p.inv, 0, INV_SIZE, { quick: () => this.slots, selected: p.selected });
    g.text(2, this.h - 1, ' SHIFT+click to transfer ', C.faint);
  }
  update(dt, game) {
    // Walking away closes the chest.
    const p = game.player;
    if (this.pos.owner) this.checkTaken(game);
    if (Math.max(Math.abs(p.x - this.pos.x), Math.abs(p.z - this.pos.z)) > 6) this.close();
  }
}

// ---------------------------------------------------------------- crafting
export class CraftWindow extends Window {
  constructor(ui, station) {
    super(ui, 64, 30, { kind: 'craft' });
    this.station = station;
    this.scroll = 0;
    this.recipes = recipesFor(station);
  }
  canCraft(inv, r) {
    for (const [k, n] of Object.entries(r.in)) if (countItem(inv, k) < n) return false;
    return true;
  }
  draw(g, game) {
    const inv = game.player.inv;
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: `CRAFTING · ${STATIONS[this.station].toUpperCase()}` });
    const list = [...this.recipes].sort((a, b) => (this.canCraft(inv, b) ? 1 : 0) - (this.canCraft(inv, a) ? 1 : 0));
    this.sorted = list;
    const perPage = 12;
    const maxScroll = Math.max(0, list.length - perPage);
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    for (let k = 0; k < perPage && k + this.scroll < list.length; k++) {
      const r = list[k + this.scroll];
      const y = 1 + k * 2;
      const ok = this.canCraft(inv, r);
      const hover = this.hovering(1, y, this.w - 2, 2);
      g.fill(1, y, this.w - 2, 2, ' ', C.fg, hover ? (ok ? 'rgba(60,80,40,0.95)' : 'rgba(60,40,40,0.9)') : k % 2 ? 'rgba(22,18,28,0.9)' : undefined);
      g.icon(2, y, r.out, r.n);
      const name = ITEMS[r.out]?.name || r.out;
      g.text(6, y, name, ok ? C.hi : C.dim);
      g.text(6 + name.length + 1, y, r.n > 1 ? `x${r.n}` : '', C.dim);
      const ing = Object.entries(r.in).map(([key, n]) => {
        const have = countItem(inv, key);
        return { text: `${n} ${ITEMS[key]?.name || key}`, ok: have >= n };
      });
      let xx = 6;
      for (const it of ing) {
        g.text(xx, y + 1, it.text, it.ok ? C.green : C.red);
        xx += it.text.length + 2;
      }
      if (ok) g.text(this.w - 10, y, '[craft]', hover ? C.hi : C.faint);
      this.hit(1, y, this.w - 2, 2, (ck, gm) => this.craft(r, gm, ck.shift ? 5 : 1));
    }
    if (list.length > perPage) g.text(this.w - 14, this.h - 1, ` ${this.scroll + 1}-${Math.min(list.length, this.scroll + perPage)}/${list.length} `, C.dim);
    g.text(2, this.h - 1, ' click craft · SHIFT x5 · wheel scroll ', C.faint);
  }
  craft(r, game, times) {
    const inv = game.player.inv;
    let made = 0;
    for (let t = 0; t < times; t++) {
      if (!this.canCraft(inv, r)) break;
      for (const [k, n] of Object.entries(r.in)) removeItem(inv, k, n);
      const left = addItem(inv, r.out, r.n);
      if (left) game.spawnDrop(r.out, left, game.player.x, game.player.y, game.player.z, true);
      made++;
    }
    if (made) {
      game.audio?.play('craft');
      game.stats.crafted += made;
      this.ui.msg(`Crafted ${ITEMS[r.out].name} x${r.n * made}`, C.green);
    } else game.audio?.play('error');
  }
  onWheel(d) {
    this.scroll += d;
  }
}

// ---------------------------------------------------------------- dialogue
export class DialogueWindow extends Window {
  constructor(ui, npc, game, reply = null) {
    super(ui, 76, 21, { kind: 'dialogue', y: ROWS - 22 });
    this.npc = npc;
    this.queue = reply ? [...reply] : null;
    this.line = '';
    this.chars = 0;
    this.page = 0;
    this.choices = null; // follow-up options offered by the last answer
    this.back = null;
    this.game = game;
    // They stop what they're doing to listen.
    if (game) game.talkingTo = npc;
  }
  say(lines) {
    this.queue = [...lines];
    this.next();
  }
  next() {
    this.line = this.queue && this.queue.length ? this.queue.shift() : this.line;
    this.chars = 0;
  }
  allOptions(game) {
    if (this.choices) return this.back === null ? this.choices : [...this.choices, { id: 'back', label: this.back || '(Never mind)' }];
    return topicsFor(this.npc, game);
  }
  // Long option labels get the full width (one column of seven).
  isWide(all) {
    return all.some((o) => o.label.length > Math.floor((this.w - 4) / 2) - 4);
  }
  options(game) {
    const all = this.allOptions(game);
    const wide = this.isWide(all);
    if (all.length <= (wide ? 7 : 10)) return all;
    const per = wide ? 6 : 9;
    const pages = Math.ceil(all.length / per);
    if (this.page >= pages) this.page = 0;
    const page = all.slice(this.page * per, this.page * per + per);
    page.push({ id: 'more', label: `More... (${this.page + 1}/${pages})` });
    return page;
  }
  choose(o, game) {
    const n = this.npc;
    if (this.closing !== undefined) return;
    if (o.id === 'more') {
      this.page++;
      return;
    }
    if (o.id === 'back') {
      this.choices = null;
      this.back = null;
      this.page = 0;
      return;
    }
    const r = respond(n, game, o.id, o.arg);
    game.audio?.play('select');
    if (r.open === 'trade') return this.ui.openTrade(n);
    if (r.open === 'gift') return this.ui.open(new GiftWindow(this.ui, n));
    this.choices = r.choices && r.choices.length ? r.choices : null;
    this.back = this.choices ? (r.back === undefined ? '(Never mind)' : r.back) : null;
    this.page = 0;
    if (r.lines && r.lines.length) this.say(r.lines);
    if (r.close) {
      this.closing = 1.6;
      this.after = r.after || null;
    }
  }
  draw(g, game) {
    const n = this.npc;
    if (this.queue === null) this.say([openingLine(n, game)]);
    const rec = n.rec;
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true });
    g.box(1, 1, 5, 5, { fg: C.faint });
    this.portraitPos = { x: (this.x + 2) * CHAR_W + 1, y: (this.y + 2) * CHAR_H - 4 };
    g.text(7, 1, n.name, C.hi);
    const title = `${n.title}${rec.age === 'child' && n.title !== 'Child' ? ' · child' : rec.age === 'elder' && n.title !== 'Retiree' ? ' · elder' : ''} of ${n.homeName}`;
    g.text(7, 2, title.slice(0, 62), C.cyan);
    g.text(7, 3, rec.traits.join(', ').slice(0, 62), C.purple);
    const op = game.sim.opinion(n);
    const lvl = repLevel(op);
    const bars = Math.round((op + 100) / 20);
    g.text(7, 4, 'Opinion', C.dim);
    g.text(15, 4, '■'.repeat(bars) + '□'.repeat(10 - bars), lvl.color);
    g.text(26, 4, `${lvl.label} (${op > 0 ? '+' : ''}${op})`, lvl.color);
    const mood = rec.mood ?? 0.5;
    g.text(46, 4, mood > 0.7 ? 'Mood: cheerful' : mood < 0.3 ? 'Mood: miserable' : mood < 0.45 ? 'Mood: low' : 'Mood: fine', C.faint);
    if (n.activity) g.text(7, 5, `Now: ${describeActivity(n.activity.entry)}`.slice(0, 40), C.faint);
    if (rec.hungry >= 1) g.text(46, 5, rec.hungry >= 2 ? 'Starving' : 'Hungry', C.orange);
    // Current line, typed out.
    const line = this.line || '...';
    const shown = line.slice(0, Math.floor(this.chars));
    const wl = wrap(shown, this.w - 6);
    wl.slice(0, 3).forEach((l, k) => g.text(3, 7 + k, (k === 0 ? '"' : ' ') + l + (k === wl.length - 1 && this.chars >= line.length ? '"' : ''), C.white));
    if (this.queue && this.queue.length && this.chars >= line.length) g.text(this.w - 12, 10, '[SPACE] ►', Math.floor(this.ui.time * 3) % 2 ? C.hi : C.dim);
    g.text(2, 11, '─'.repeat(this.w - 4), C.faint);
    // Options: two columns, numbered.
    const opts = this.options(game);
    this.opts = opts;
    const wide = this.isWide(opts);
    const colW = wide ? this.w - 4 : Math.floor((this.w - 4) / 2);
    opts.forEach((o, i) => {
      const col = wide ? 0 : i < 5 ? 0 : 1;
      const row = wide ? i : i % 5;
      const x = 2 + col * colW;
      const y = 12 + row;
      const key = i === 9 ? '0' : String(i + 1);
      const hov = this.hovering(x, y, colW - 1, 1);
      g.fill(x, y, colW - 1, 1, ' ', C.fg, hov ? C.bgHi : undefined);
      g.text(x, y, `${key}`, C.hi);
      g.text(x + 2, y, o.label.slice(0, colW - 4), hov ? C.white : o.id === 'rude' ? C.orange : o.id === 'bye' ? C.dim : C.fg);
      this.hit(x, y, colW - 1, 1, (ck, gm) => this.choose(o, gm));
    });
    g.text(2, this.h - 2, '1-9 choose · SPACE continue · T trade · G gift · ESC leave', C.faint);
  }
  onClose(game) {
    if (game && game.talkingTo === this.npc) game.talkingTo = null;
    // Walking out on the mayor's lecture counts as brushing it off.
    const cf = game && game.sim.confront;
    if (cf && cf.arrived && cf.idx === this.npc.rec.idx && cf.sid === this.npc.settlement.id) game.sim.settleConfront(this.npc, cf.stage === 'expel' ? 'expel' : 'defy');
  }
  drawPixels(ctx) {
    const sheet = humanoidSheet(this.npc.look);
    ctx.drawImage(sheet, 0, 0, 16, SHEET_H, this.portraitPos.x, this.portraitPos.y - SPR_PAD, 16, SHEET_H);
  }
  update(dt, game) {
    this.chars += dt * 60;
    if (this.closing !== undefined) {
      this.closing -= dt;
      if (this.closing <= 0) {
        this.close();
        if (this.after) this.after();
        return;
      }
    }
    const n = this.npc;
    if (n.dead || n.distTo(game.player) > 6 || n.state === 'flee' || n.state === 'fight') this.close();
  }
  onKey(k, game) {
    if (k.code === 'Space' || k.code === 'Enter') {
      if (this.chars < this.line.length) this.chars = this.line.length;
      else if (this.queue && this.queue.length) this.next();
      return true;
    }
    const m = /^Digit(\d)$/.exec(k.code) || /^Numpad(\d)$/.exec(k.code);
    if (m) {
      const i = m[1] === '0' ? 9 : +m[1] - 1;
      const o = this.opts && this.opts[i];
      if (o) this.choose(o, game);
      return true;
    }
    if (k.code === 'KeyT') {
      const o = (this.opts || []).find((q) => q.id === 'trade');
      if (o) this.choose(o, game);
      return true;
    }
    if (k.code === 'KeyG') {
      const o = (this.opts || []).find((q) => q.id === 'gift');
      if (o) this.choose(o, game);
      return true;
    }
    return false;
  }
}

// Pick something from your inventory to give.
export class GiftWindow extends Window {
  constructor(ui, npc) {
    super(ui, 39, 18, { kind: 'gift' });
    this.npc = npc;
  }
  draw(g, game) {
    const p = game.player;
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: `GIFT FOR ${this.npc.rec.name.first.toUpperCase()}` });
    g.text(2, 1, 'Click an item to give one.', C.dim);
    slotTable(this, g, 1, 2, 9, p.inv, 0, INV_SIZE, { onClick: (i, ck, gm) => this.give(i, gm) });
    g.text(2, this.h - 1, ' ESC cancel ', C.faint);
  }
  give(i, game) {
    const p = game.player;
    const s = p.inv[i];
    if (!s) return;
    const item = s.item;
    s.count--;
    if (s.count <= 0) p.inv[i] = null;
    const r = game.sim.giveGift(this.npc, item);
    const n = this.npc;
    const nm = ITEMS[item].name.toLowerCase();
    const lines = {
      hungry: [`Food! Oh, thank you, I haven't eaten properly in days.`],
      hobby: [`A ${nm}? How did you know? I love it!`],
      love: [`For me? This ${nm} is beautiful. Thank you!`],
      junk: [`...A ${nm}. Thanks, I guess?`],
      coin: ['A coin? Well, I won\'t say no.'],
      fine: [n.rec.personality.kindness > 0.6 ? `How thoughtful! Thank you for the ${nm}.` : `Hm. A ${nm}. Thanks.`],
    }[r.reaction];
    game.audio?.play('pickup');
    this.close();
    this.ui.open(new DialogueWindow(this.ui, n, game, [...lines, `(${repLevel(game.sim.opinion(n)).label})`]));
  }
}

// ---------------------------------------------------------------- trading
export class TradeWindow extends Window {
  constructor(ui, npc) {
    super(ui, 78, 26, { kind: 'trade' });
    this.npc = npc;
    this.scroll = 0;
    if (ui.game) ui.game.talkingTo = npc;
  }
  shop(game) {
    if (!this.shopData) this.shopData = game.sim.shopOf(this.npc);
    return this.shopData;
  }
  list(game) {
    const sh = this.shop(game);
    if (!sh) return [];
    const order = STOCK[sh.kind] || [];
    const keys = Object.keys(sh.store).filter((k) => sh.store[k] > 0 && ITEMS[k]);
    keys.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
    return keys;
  }
  price(k, game) {
    return Math.max(1, Math.round(ITEMS[k].value * game.sim.priceFactor(this.npc)));
  }
  basePrice(k, game) {
    return Math.max(1, Math.round(ITEMS[k].value * game.sim.priceParts(this.npc).base));
  }
  sellPrice(k, game) {
    return game.sim.sellPrice(this.npc, k);
  }
  wants(k, game) {
    const sh = this.shop(game);
    if (!sh || k === 'coin' || ITEMS[k].noSell) return false;
    const w = WANTS[sh.kind];
    return w === null || w === undefined ? true : w.includes(k);
  }
  draw(g, game) {
    const p = game.player;
    const sh = this.shop(game);
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: `TRADE · ${this.npc.name.toUpperCase()}` });
    const coins = countItem(p.inv, 'coin');
    g.text(2, 1, 'BUY', C.hi);
    const list = this.list(game);
    const per = 10;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, list.length - per)));
    if (!list.length) g.text(3, 3, 'Nothing for sale right now.', C.dim);
    this.strikes = [];
    list.slice(this.scroll, this.scroll + per).forEach((k, i) => {
      const y = 2 + i * 2;
      const pr = this.price(k, game);
      const base = this.basePrice(k, game);
      const can = coins >= pr;
      const hov = this.hovering(1, y, 36, 2);
      g.fill(1, y, 36, 2, ' ', C.fg, hov ? 'rgba(60,70,40,0.95)' : i % 2 ? 'rgba(22,18,28,0.9)' : undefined);
      g.icon(2, y, k, sh.store[k]);
      g.text(6, y, ITEMS[k].name.slice(0, base > pr ? 16 : 20), can ? C.fg : C.dim);
      if (ITEMS[k].quality) g.text(6, y + 1, ITEMS[k].quality, ITEMS[k].quality === 'terrible' ? C.orange : ITEMS[k].quality === 'delightful' ? C.hi : C.green);
      // A discount shows the old price struck through in red.
      if (base > pr) {
        const old = `¤${base}`;
        g.text(28 - old.length, y, old, C.red);
        this.strikes.push({ x: 28 - old.length, y, len: old.length });
      }
      g.text(29, y, `¤${pr}`, can ? (base > pr ? C.green : C.hi) : C.red);
      if (hov) this.ui.itemTooltip({ item: k, count: sh.store[k] });
      this.hit(1, y, 36, 2, (ck, gm) => this.buy(k, gm, ck.shift ? 5 : 1));
    });
    if (list.length > per) g.text(2, 22, `${this.scroll + 1}-${Math.min(list.length, this.scroll + per)} of ${list.length} (wheel)`, C.faint);
    g.text(40, 1, 'SELL (click your items)', C.hi);
    slotTable(this, g, 39, 2, 9, p.inv, 0, INV_SIZE, { onClick: (i, ck, gm) => this.sell(i, gm, ck.shift) });
    const hs = p.inv.findIndex((q, i) => q && this.hovering(40 + (i % 9) * 4, 3 + Math.floor(i / 9) * 3, 3, 2));
    if (hs >= 0 && p.inv[hs].item !== 'coin') {
      const k = p.inv[hs].item;
      g.text(40, 16, this.wants(k, game) ? `They'll pay ¤${this.sellPrice(k, game)} each` : 'They don\'t want that.', this.wants(k, game) ? C.green : C.red);
      if (this.wants(k, game) && game.sim.careers.sellFactor(this.npc, k) > 1) g.text(40, 17, '(licensed seller\'s premium)', C.cyan);
    }
    const purse = sh ? sh.purse.get() : 0;
    g.text(40, 18, `Your coins: ¤${coins}`, C.hi);
    g.text(40, 19, `Their purse: ¤${purse}`, purse < 10 ? C.orange : C.dim);
    const e = this.npc.layout.econ;
    if (e && !this.npc.visit) g.text(40, 20, `Sales tax ${Math.round(e.tax * 50)}% · ${repLevel(game.sim.opinion(this.npc)).label} prices`, C.faint);
    const parts = game.sim.priceParts(this.npc);
    if (parts.discount < 1) g.text(40, 21, `Discount ${Math.round((1 - parts.discount) * 100)}%: ${parts.reasons.join(', ')}`.slice(0, 37), C.green);
    g.text(2, this.h - 1, ' click buy/sell · SHIFT x5 / whole stack · ESC close ', C.faint);
  }
  buy(k, game, n) {
    const p = game.player;
    const sh = this.shop(game);
    const e = this.npc.layout.econ;
    let bought = 0;
    let spent = 0;
    for (let i = 0; i < n; i++) {
      const pr = this.price(k, game);
      if (countItem(p.inv, 'coin') < pr || !sh.store[k]) break;
      removeItem(p.inv, 'coin', pr);
      st.take(sh.store, k, 1);
      const tax = e && !this.npc.visit ? Math.floor(pr * e.tax * 0.5) : 0;
      if (tax) e.treasury += tax;
      sh.purse.add(pr - tax);
      const left = p.give(k, 1);
      if (left) game.spawnDrop(k, left, p.x, p.y, p.z, true);
      bought++;
      spent += pr;
    }
    if (bought) {
      game.audio?.play('coin');
      game.sim.noteTrade(this.npc, spent);
      this.npc.say(this.npc.rng.pick(['Pleasure doing business!', 'Thank you kindly.', 'Enjoy!', 'Come again!']), 2);
    } else game.audio?.play('error');
  }
  sell(i, game, all) {
    const p = game.player;
    const s = p.inv[i];
    const sh = this.shop(game);
    if (!s || s.item === 'coin' || !sh) return;
    if (!this.wants(s.item, game)) {
      this.npc.say(this.npc.rng.pick(['I\'ve no use for that.', 'Not interested, sorry.']), 2);
      game.audio?.play('error');
      return;
    }
    const pr = this.sellPrice(s.item, game);
    let n = all ? s.count : 1;
    n = Math.min(n, pr > 0 ? Math.floor(sh.purse.get() / pr) : n);
    if (n <= 0) {
      this.npc.say('I can\'t afford that right now.', 2);
      game.audio?.play('error');
      return;
    }
    const item = s.item;
    s.count -= n;
    if (s.count <= 0) p.inv[i] = null;
    st.add(sh.store, item, n);
    sh.purse.add(-pr * n);
    const left = p.give('coin', pr * n);
    if (left) game.spawnDrop('coin', left, p.x, p.y, p.z, true);
    game.sim.noteTrade(this.npc, Math.ceil((pr * n) / 2));
    game.audio?.play('coin');
  }
  onWheel(d) {
    this.scroll += Math.sign(d);
  }
  drawPixels(ctx) {
    ctx.fillStyle = '#ff4040';
    for (const st of this.strikes || []) ctx.fillRect((this.x + st.x) * CHAR_W, (this.y + st.y) * CHAR_H + Math.floor(CHAR_H / 2), st.len * CHAR_W, 1);
  }
  onClose(game) {
    if (game && game.talkingTo === this.npc) game.talkingTo = null;
    if (game) game.sim.closeShop(this.npc);
  }
  update(dt, game) {
    if (this.npc.dead || this.npc.distTo(game.player) > 6) this.close();
  }
}

// ---------------------------------------------------------------- justice
export class HaltWindow extends Window {
  constructor(ui, guard, crimes) {
    super(ui, 60, 13, { kind: 'halt' });
    this.guard = guard;
    this.crimes = crimes;
  }
  draw(g, game) {
    g.box(0, 0, this.w, this.h, { bg: 'rgba(40,24,8,0.96)', double: true, fg: C.hi, title: 'HALT!' });
    g.text(2, 1, `${this.guard.name}, ${this.guard.title}:`, C.cyan);
    const what = this.crimes.slice(-3).map((c) => lcFirst(describe(c)));
    const suspect = this.crimes.length && this.crimes.every((c) => c.suspected);
    const lines = wrap(suspect
      ? `"You were seen near ${what.length ? 'the scene of ' + what.join(', ') : 'trouble'}. You're coming with us to answer some questions. Come quietly."`
      : `"You're under arrest${what.length ? ' for ' + what.join(', ') : ''}. Come quietly to the ${this.guard.settlement.type === 'village' ? 'village' : 'town'} jail, or we do this the hard way."`, this.w - 4);
    lines.slice(0, 4).forEach((l, i) => g.text(2, 3 + i, l, C.white));
    const opts = [['1', 'Come quietly (go to jail and face a hearing)', () => this.answer(game, true)], ['2', 'Resist! (the guards will fight to subdue you)', () => this.answer(game, false)]];
    opts.forEach(([k, label, fn], i) => {
      const y = 8 + i;
      const hov = this.hovering(2, y, this.w - 4, 1);
      g.fill(2, y, this.w - 4, 1, ' ', C.fg, hov ? C.bgHi : undefined);
      g.text(3, y, `[${k}] ${label}`, hov ? C.white : C.fg);
      this.hit(2, y, this.w - 4, 1, fn);
    });
    g.text(2, this.h - 1, ' 1/2 choose ', C.faint);
  }
  answer(game, quiet) {
    this.answered = true;
    this.close();
    const sid = this.guard.settlement.id;
    if (quiet) game.sim.justice.surrender(sid, this.guard);
    else game.sim.justice.resist(sid, this.guard);
  }
  onKey(k, game) {
    if (k.code === 'Digit1' || k.code === 'Enter') this.answer(game, true);
    else if (k.code === 'Digit2' || k.code === 'Escape') this.answer(game, false);
    return true;
  }
  update(dt, game) {
    if (this.guard.dead) this.close();
    // The guards wait for an answer.
    else for (const g of game.guardsOf(this.guard.settlement.id)) g.haltT = Math.max(g.haltT, 2);
  }
}

export class TrialWindow extends Window {
  constructor(ui, v) {
    super(ui, 70, 26, { kind: 'trial' });
    this.v = v;
  }
  draw(g, game) {
    const v = this.v;
    g.box(0, 0, this.w, this.h, { bg: 'rgba(24,18,12,0.97)', double: true, fg: C.hi, title: `HEARING · ${v.town.toUpperCase()}` });
    g.text(2, 1, `Presiding: ${v.judgeTitle} ${v.judgeName}`, C.cyan);
    g.text(2, 3, 'CHARGES', C.hi);
    let y = 4;
    if (!v.charges.length) g.text(3, y++, 'None.', C.dim);
    for (const c of v.charges.slice(0, 6)) {
      g.text(3, y, c.proven ? '■' : '□', c.proven ? C.red : C.green);
      g.text(5, y, c.text.slice(0, 46), c.proven ? C.fg : C.dim);
      g.text(52, y, c.proven ? 'PROVEN' : 'NOT PROVEN', c.proven ? C.red : C.green);
      y++;
      const who = c.guardSaw ? ['a guard', ...c.names] : c.names;
      if (who.length) g.text(7, y++, `Witness: ${who.slice(0, 3).join(', ')}`.slice(0, 60), C.faint);
      else if (c.seenNames && c.seenNames.length) g.text(7, y++, `Seen nearby: ${c.seenNames.slice(0, 3).join(', ')}${c.found ? ' · goods found on you' : ''}`.slice(0, 60), C.faint);
      else g.text(7, y++, c.found ? 'Stolen goods found on you, but no witness' : 'No living witness', C.faint);
    }
    y++;
    const opts = [];
    if (!v.proven.length) {
      g.text(2, y++, '"Nothing can be proven. You are free to go."', C.green);
      opts.push(['1', 'Leave', 'free']);
    } else if (v.sentence === 'exile' || v.sentence === 'death') {
      g.text(2, y++, `Previous serious convictions here: ${v.prior}.`, C.orange);
      const t = v.sentence === 'exile' ? `"You are a menace. You are BANISHED from ${v.town}, never to return."` : '"Your crimes are beyond forgiveness. The sentence is DEATH."';
      for (const l of wrap(t, this.w - 4)) g.text(2, y++, l, C.red);
      if (!v.pleaded) opts.push(['2', 'Plead for mercy', 'plead']);
      opts.unshift(['1', 'Accept your fate', 'accept']);
    } else {
      g.text(2, y, `Fine: ¤${v.fine}`, C.hi);
      if (v.fineScale !== 1) g.text(16, y, `(local fines ×${v.fineScale})`, C.faint);
      g.text(44, y++, `Your coins: ¤${v.coins}`, v.canPay ? C.green : C.red);
      if (!v.canPay) g.text(2, y++, `You can't pay: that's ${v.hours} hours in the cell.`, C.orange);
      if (v.mercy === true) g.text(2, y++, '"Very well, I will show some mercy."', C.green);
      else if (v.mercy === false) g.text(2, y++, '"Your pleas do not move me."', C.orange);
      if (v.canPay) opts.push(['1', `Pay ¤${v.fine} and go free`, 'pay']);
      opts.push([String(opts.length + 1), `Serve ${v.hours} hours in the cell`, 'serve']);
      if (!v.pleaded) opts.push([String(opts.length + 1), 'Plead for mercy', 'plead']);
    }
    if (v.citizen && v.proven.length) g.text(2, y++, 'Your citizenship will be revoked.', C.red);
    if (v.weapons === 'returned' && v.sentence !== 'death') g.text(2, y++, 'Your weapons will be returned when you are released.', C.dim);
    else if (v.weapons === 'forfeit') g.text(2, y++, 'Your weapons are forfeit.', C.orange);
    if (v.stripped) g.text(2, y++, 'You are dismissed from the watch: your badge and kit are taken.', C.orange);
    y = Math.max(y + 1, this.h - 2 - opts.length);
    this.opts = opts;
    opts.forEach(([k, label, choice], i) => {
      const yy = y + i;
      const hov = this.hovering(2, yy, this.w - 4, 1);
      g.fill(2, yy, this.w - 4, 1, ' ', C.fg, hov ? C.bgHi : undefined);
      g.text(3, yy, `[${k}] ${label}`, hov ? C.white : C.fg);
      this.hit(2, yy, this.w - 4, 1, (ck, gm) => this.pick(choice, gm));
    });
  }
  pick(choice, game) {
    const r = game.sim.justice.resolve(choice);
    if (choice === 'plead' && r) {
      this.v = r;
      return;
    }
    this.close();
  }
  onKey(k, game) {
    const m = /^Digit(\d)$/.exec(k.code);
    if (m && this.opts) {
      const o = this.opts.find((q) => q[0] === m[1]);
      if (o) this.pick(o[2], game);
    }
    return true;
  }
}

// Who you are: citizenship, work, the escort you hired, open requests and
// your standing with the law.
export function playerProfile(game) {
  const sim = game.sim;
  const cz = sim.citizen;
  const town = cz ? game.world.ow.settlements[cz.sid] : null;
  return {
    name: game.playerName,
    citizen: !!town,
    title: town ? `Citizen of ${town.name}` : 'Adventurer',
    job: sim.careers.title(),
    renown: sim.bestRenown(),
  };
}

export class JournalWindow extends Window {
  constructor(ui) {
    super(ui, 70, 32, { kind: 'journal' });
    this.closeOnOutside = true;
  }
  draw(g, game) {
    const sim = game.sim;
    const car = sim.careers;
    const pr = playerProfile(game);
    g.box(0, 0, this.w, this.h, { bg: 'rgba(28,22,16,0.96)', double: true, title: 'JOURNAL' });
    g.text(3, 1, pr.name, C.hi);
    g.text(4 + pr.name.length, 1, `· ${pr.title}`, pr.citizen ? C.green : C.cyan);
    if (pr.renown) g.text(3, 2, `The ${pr.renown.title}`, C.hi);
    let y = 3;
    const head = (t) => {
      y++;
      g.text(2, y++, t, C.hi);
    };
    const para = (t, col = '#e0d0b0', ind = 3) => {
      for (const l of wrap(t, this.w - ind - 3)) {
        if (y >= this.h - 2) return;
        g.text(ind, y++, l, col);
      }
    };
    head('WORK');
    if (pr.job) {
      para(pr.job, C.purple);
      for (const l of car.jobDetails()) para(l, C.dim, 5);
    } else para('No trade of your own. Ask a mayor about an official profession, or a shopkeeper for work.', C.dim);
    if (car.escort) {
      head('ESCORT');
      para(`${car.escort.name}, a guard of ${car.townName(car.escort.sid)}, is with you for another ${Math.ceil(car.hoursLeft())} hours.`);
    }
    head('REQUESTS');
    const fav = sim.favors.list;
    const mail = sim.diplomacy.letters.filter((q) => q.status === 'player');
    if (!fav.length && !mail.length) para('Nobody is waiting on you. Ask around: "Need a hand with anything?"', C.dim);
    for (const q of mail) para(`• Carry the mayor's dispatch from ${car.townName(q.from)} to the mayor of ${car.townName(q.to)}${q.where ? `, ${q.where} of ${car.townName(q.from)}` : ''} (¤${q.pay || 10})`, C.cyan);
    for (const f of fav) {
      const left = f.due - game.day;
      para(`• ${sim.favors.describe(f)}`, f.kind === 'slay' && f.kills >= f.count ? C.green : '#e0d0b0');
      g.text(this.w - 16, y - 1, left <= 0 ? 'due today' : `due in ${left}d`, left <= 0 ? C.orange : C.faint);
    }
    const cz = sim.citizen;
    if (cz) {
      const T = sim.layoutOf(cz.sid);
      if (T) {
        head('TAXES');
        const lt = cz.lastTax;
        para(`${car.townName(cz.sid)} taxes ${Math.round(T.econ.tax * 100)}% of what you earn there, plus a small head tax, each morning.${lt ? ` Last paid: ¤${lt.tax} on day ${lt.day}${lt.share ? ` (¤${lt.share} on ¤${lt.earned} earned, ¤${lt.poll} head tax)` : ''}.` : ''}${cz.owed ? ` You owe ${cz.owed} day${cz.owed > 1 ? 's' : ''}!` : ''}`, cz.owed ? C.orange : '#e0d0b0');
      }
    }
    head('STANDING');
    let any = false;
    for (const [sid, r] of sim.justice.record) {
      if (!r.convictions) continue;
      any = true;
      para(`${car.townName(sid)}: ${r.convictions} conviction${r.convictions > 1 ? 's' : ''}${sim.justice.exiled.has(sid) ? ' · BANISHED' : ''}`, C.orange);
    }
    for (const sid of game.wanted.keys()) {
      if (!game.isWanted(sid)) continue;
      any = true;
      para(`Wanted in ${car.townName(sid)}!`, C.red);
    }
    if (!any) para('No crimes on record. Keep it that way.', C.dim);
    const deeds = [...sim.renown].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (deeds.length) {
      head('RENOWN');
      para(deeds.slice(0, 4).map(([sid, v]) => {
        const t = sim.renownTitle(sid);
        const need = t === 'Hero' ? '' : ` (${(t ? RENOWN.hero : RENOWN.friend) - v} to ${t ? 'Hero' : 'Friend'})`;
        return `${car.townName(sid)}: ${t ? `${t} · ` : ''}${v} deeds${need}`;
      }).join(' · '), C.hi);
    }
    g.text(this.w - 14, this.h - 1, ' [J/ESC] ok ', C.faint);
  }
  onKey(k) {
    if (k.code === 'KeyJ' || k.code === 'Enter') {
      this.close();
      return true;
    }
    return false;
  }
}

export class LedgerWindow extends Window {
  constructor(ui, game, s, L) {
    super(ui, 62, 30, { kind: 'text' });
    this.s = s;
    this.L = L;
    this.closeOnOutside = true;
  }
  draw(g, game) {
    const { s, L } = this;
    const e = L.econ;
    g.box(0, 0, this.w, this.h, { bg: 'rgba(40,30,20,0.96)', double: true, title: 'NOTICE BOARD' });
    g.center(1, `${s.name.toUpperCase()} · ${cap(s.type)} of the ${s.civ ? s.civ.name : 'free folk'}`, '#f0e0c0');
    const m = mayorOf(L);
    const living = L.npcs.filter(alive);
    const pop = living.length;
    const coffers = e.treasury > pop * 35 ? 'overflowing' : e.treasury > pop * 15 ? 'healthy' : e.treasury > pop * 5 ? 'thin' : 'nearly empty';
    let y = 3;
    const row = (k, v, col = '#f0e0c0') => {
      g.text(3, y, k, C.dim);
      g.text(18, y++, v.slice(0, 40), col);
    };
    row(s.type === 'village' ? 'Elder' : 'Mayor', m ? `${m.name.first} ${m.name.last}` : '(none: the council governs)');
    row('Population', `${pop}`);
    row('Treasury', `¤${e.treasury} (${coffers})`, coffers === 'nearly empty' ? C.orange : '#f0e0c0');
    row('Taxes', `${Math.round(e.tax * 100)}% of earnings${e.taxY ? ` (¤${e.taxY} collected)` : ''}`);
    row('Fines', e.fineScale > 1.05 ? `harsh (×${e.fineScale})` : e.fineScale < 0.95 ? `lenient (×${e.fineScale})` : 'standard');
    row('Laws', e.laws.armsBan ? 'No drawn weapons in town' : 'No special laws');
    const hungry = living.filter((r) => r.hungry >= 1).length;
    row('Food', hungry ? `${hungry} going hungry` : 'Everyone is fed', hungry ? C.orange : C.green);
    const visits = (game.sim.visits.get(s.id) || []).filter((v) => game.sim.abs >= v.arrive && game.sim.abs < v.leave);
    if (visits.length) row('Visitors', `Merchant from ${visits[0].fromName}`);
    const k = stockOf(L);
    row('Stores', `${k.wood} timber, ${k.stone} stone${e.short ? ` (short for a ${BUILDING_NAMES[e.short]?.toLowerCase() || e.short})` : ''}`, e.short ? C.orange : '#f0e0c0');
    const t = TIERS[s.type];
    if (t) row('Growth', `${pop}/${t.pop} people to become a ${t.next}`);
    y++;
    g.text(3, y++, 'RECENT NOTICES', C.hi);
    const far = (e.rumours || []).slice(-2).reverse();
    const notes = [...e.ledger].reverse().slice(0, far.length ? 9 : 12);
    for (const n of notes) {
      const lines = wrap(`Day ${Math.max(1, n.day)}: ${n.text}`, this.w - 6);
      for (const l of lines) {
        if (y >= this.h - 2) break;
        g.text(3, y++, l, '#e0d0b0');
      }
    }
    // What the merchants brought back from other towns.
    if (far.length && y < this.h - 4) {
      y++;
      g.text(3, y++, 'NEWS FROM AFAR', C.hi);
      for (const r of far) {
        for (const l of wrap(`${r.from}: ${r.text}`, this.w - 6)) {
          if (y >= this.h - 2) break;
          g.text(3, y++, l, C.cyan);
        }
      }
    }
    g.text(this.w - 12, this.h - 1, ' [ESC] ok ', C.faint);
  }
  onKey(k) {
    if (k.code === 'Enter' || k.code === 'Space' || k.code === 'KeyE') {
      this.close();
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------- world map
export class MapWindow extends Window {
  constructor(ui) {
    super(ui, MAP_W * 2 + 4, MAP_H + 6, { kind: 'map' });
    this.civView = false;
  }
  draw(g, game) {
    const ow = game.world.ow;
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'WORLD MAP' });
    const p = game.player;
    const pcx = Math.floor(p.x / REGION_W);
    const pcz = Math.floor(p.z / REGION_D);
    const blink = Math.floor(this.ui.time * 3) % 2;
    let hover = null;
    const roads = game.sim.diplomacy.roadCells();
    for (let cz = 0; cz < MAP_H; cz++) {
      for (let cx = 0; cx < MAP_W; cx++) {
        const cell = ow.cell(cx, cz);
        const x = 2 + cx * 2;
        const y = 1 + cz;
        const known = ow.explored[cz * MAP_W + cx] || game.revealMap;
        if (this.hovering(x, y, 2, 1)) hover = { cell, known };
        if (!known) {
          g.text(x, y, '░░', '#2a2632', '#0e0c14');
          continue;
        }
        for (let hf = 0; hf < 2; hf++) {
          const b = BIOMES[cell.halves[hf]];
          let ch = b.char;
          let fg = b.fg;
          let bg = b.bg;
          if (cell.river && hf === 1 && cell.biome !== 'ocean') {
            ch = '~';
            fg = '#80d0ff';
          }
          if (cell.lake) {
            ch = '≈';
            fg = '#80c8ff';
            bg = '#1a4a8a';
          }
          if (this.civView && cell.civ !== null && ow.civs[cell.civ]) bg = shadeHex(ow.civs[cell.civ].color.hex, 0.45);
          if (roads.has(cz * 10000 + cx) && cell.settlement === null) {
            ch = hf ? '─' : '═';
            fg = '#e8c890';
          }
          g.put(x + hf, y, ch, fg, bg);
        }
        if (cell.settlement !== null) {
          const s = ow.settlements[cell.settlement];
          const col = s.civ ? s.civ.color.hex : '#e8e8e8';
          if (s.type === 'village') g.text(x, y, ' ⌂', '#fff4d0', shadeHex(col, 0.35));
          else if (s.type === 'town') g.text(x, y, cx === s.cx ? '[■' : '■]', '#fff4d0', shadeHex(col, 0.5));
          else {
            const lx = cx - s.cx;
            const lz = cz - s.cz;
            g.text(x, y, lz === 0 ? (lx === 0 ? '╔═' : '═╗') : lx === 0 ? '╚═' : '═╝', '#fff4d0', shadeHex(col, 0.6));
          }
          if (s.condition === 'abandoned' || s.deserted) g.text(x, y, ' †', '#a0a0a0', '#302830');
        }
        if (cx === pcx && cz === pcz && blink) g.put(x + ((p.x % REGION_W) >= REGION_W / 2 ? 1 : 0), y, '@', '#ffffff', '#c02020');
      }
    }
    const y0 = MAP_H + 2;
    if (hover && hover.known) {
      const c = hover.cell;
      let info = `${BIOMES[c.biome].name}`;
      if (c.river) info += ' · river';
      if (c.lake) info += ' · lake';
      if (c.settlement !== null) {
        const s = ow.settlements[c.settlement];
        info = `${s.name} · ${cap(s.type)} · ${s.condition} · ${BIOMES[s.biome].name}`;
        g.text(2, y0 + 1, s.civ ? `${s.civ.name} (${s.civ.people}; ${s.civ.values.join(', ')})` : 'Independent', s.civ ? s.civ.color.hex : C.dim);
      } else if (c.civ !== null && ow.civs[c.civ]) g.text(2, y0 + 1, `Territory of the ${ow.civs[c.civ].name}`, ow.civs[c.civ].color.hex);
      g.text(2, y0, info.slice(0, this.w - 4), C.hi);
    } else if (hover) g.text(2, y0, 'Unexplored', C.dim);
    else g.text(2, y0, 'Each square = 2x2 screens. Hover for details.', C.dim);
    g.text(2, y0 + 2, '⌂ village  [■] town  ╔╗ city  ~ river  ═ road  † ruins  @ you', C.faint);
    const t = ` [V] ${this.civView ? 'biomes' : 'civilizations'}  [M/ESC] close `;
    g.text(this.w - t.length - 2, this.h - 1, t, C.dim);
  }
  onKey(k) {
    if (k.code === 'KeyV') {
      this.civView = !this.civView;
      return true;
    }
    return false;
  }
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------- text / signs
export class TextWindow extends Window {
  constructor(ui, title, lines, book = false) {
    const wrapped = [];
    for (const l of lines) {
      if (!l) wrapped.push('');
      else wrapped.push(...wrap(l, 50));
    }
    super(ui, 56, Math.min(ROWS - 2, wrapped.length + 5), { kind: 'text' });
    this.title = title;
    this.lines = wrapped;
    this.book = book;
    this.closeOnOutside = true;
  }
  draw(g) {
    g.box(0, 0, this.w, this.h, { bg: this.book ? 'rgba(40,30,20,0.96)' : C.bg, double: true, title: this.title });
    this.lines.forEach((l, i) => g.center(2 + i, l, i === 0 && !this.book ? C.hi : this.book ? '#f0e0c0' : C.fg));
    g.text(this.w - 12, this.h - 1, ' [ESC] ok ', C.faint);
  }
  onKey(k) {
    if (k.code === 'Enter' || k.code === 'Space' || k.code === 'KeyE') {
      this.close();
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------- banner
export class BannerWindow extends Window {
  constructor(ui, s) {
    // Only one banner at a time.
    ui.windows = ui.windows.filter((w) => w.kind !== 'banner');
    const sub = `${cap(s.condition === 'abandoned' ? 'abandoned ' + s.type : s.deserted ? 'deserted ' + s.type : s.type)}${s.civ ? ' · ' + s.civ.name : ''}`;
    const w = Math.max(s.name.length + 8, sub.length + 4);
    super(ui, w, 4, { kind: 'banner', modal: false, y: 5 });
    this.s = s;
    this.sub = sub;
    this.t = 3.2;
  }
  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, 'rgba(10,8,16,0.7)');
    g.center(1, `~ ${this.s.name.toUpperCase()} ~`, C.hi);
    g.center(2, this.sub, this.s.civ ? this.s.civ.color.hex : C.dim);
  }
  update(dt) {
    this.t -= dt;
    if (this.t <= 0) this.close();
  }
  contains() {
    return false;
  }
}

// ---------------------------------------------------------------- help
export class HelpWindow extends Window {
  constructor(ui) {
    super(ui, 76, 35, { kind: 'help' });
    this.closeOnOutside = true;
  }
  draw(g) {
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'HOW TO PLAY' });
    const rows = [
      ['MOVE', 'WASD / Arrows (tile by tile) · SHIFT sprint'],
      ['BELT', '1-9 or mouse wheel to select'],
      ['INTERACT', 'Click doors, chests, benches, beds, signs, snares...'],
      ['', 'E: use what you point at / face · RMB also works'],
      ['MINE', 'Hold LMB on a block with a tool or empty hand'],
      ['PLACE', 'Select a block, then click (hold to paint)'],
      ['ROTATE', 'R cycles facing for chairs, beds, doors, roofs...'],
      ['LAYER', 'Z/X lock the mining/placing layer · V auto'],
      ['ATTACK', 'Click a creature or person (bows need arrows)'],
      ['TALK', 'Right-click a villager, pick topics with 1-9'],
      ['SIT', 'Click a chair, bench or stool · move to stand'],
      ['SLEEP', 'Click a bed at night (yours, or your host\'s)'],
      ['TOSS', 'Q throws one item · CTRL+Q the whole stack'],
      ['EAT', 'F (or RMB) while holding food'],
      ['FISH', 'Hold a fishing rod and right-click water'],
      ['WINDOWS', 'TAB bag · C craft · M map · J journal · ESC menu · F2 CRT'],
    ];
    rows.forEach(([k, v], i) => {
      g.text(3, 2 + i, k, C.hi);
      g.text(13, 2 + i, v, C.fg);
    });
    const tips = [
      'Towns live on without you: cooks buy from trappers and fishers and',
      'cook meals (good or awful), mayors set taxes and laws, merchants',
      'travel between towns. Read the notice board on the square.',
      'People remember you: gifts, kind words and fair trade win them over;',
      'stealing and violence do not. Crimes only count if someone SEES',
      'them. Guards arrest you (or knock you out); a hearing decides the',
      'fine or jail time. Repeat offenders are banished or executed.',
      'Talk to the mayor in the town hall to become a citizen: a family',
      'takes you in while builders put up a house of your own.',
    ];
    tips.forEach((t, i) => g.text(3, 19 + i, t, C.dim));
    g.text(3, 30, 'Every world is generated from its seed: biomes, rivers,', C.faint);
    g.text(3, 31, 'civilizations, towns and every villager\'s life story.', C.faint);
    g.text(this.w - 16, this.h - 1, ' [H/ESC] close ', C.faint);
  }
}

// ---------------------------------------------------------------- pause
export class PauseWindow extends Window {
  constructor(ui) {
    super(ui, 34, 16, { kind: 'pause' });
    this.items = [
      ['ESC', 'Resume', (g) => this.close()],
      ['S', 'Save game', (g) => this.ui.hooks.save && this.ui.hooks.save()],
      ['L', 'Load game', (g) => this.ui.hooks.load && this.ui.hooks.load()],
      ['H', 'How to play', (g) => {
        this.close();
        this.ui.open(new HelpWindow(this.ui));
      }],
      ['G', 'Toggle CRT effect', () => this.ui.hooks.toggleCrt && this.ui.hooks.toggleCrt()],
      ['M', 'Music on/off', () => this.ui.hooks.toggleMusic && this.ui.hooks.toggleMusic()],
      ['N', 'New world', () => this.ui.hooks.newWorld && this.ui.hooks.newWorld()],
      ['T', 'Title screen', () => this.ui.hooks.title && this.ui.hooks.title()],
    ];
  }
  draw(g, game) {
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'PAUSED' });
    this.items.forEach(([k, label, fn], i) => {
      const y = 2 + i;
      const hov = this.hovering(2, y, this.w - 4, 1);
      g.fill(2, y, this.w - 4, 1, ' ', C.fg, hov ? C.bgHi : undefined);
      g.text(3, y, `[${k}]`, C.hi);
      g.text(10, y, label, hov ? C.white : C.fg);
      this.hit(2, y, this.w - 4, 1, (ck, gm) => fn(gm));
    });
    if (game) g.text(3, this.h - 3, `Seed ${game.seed}`, C.faint);
    g.text(3, this.h - 2, `Day ${game ? game.day : 1}`, C.faint);
  }
  onKey(k, game) {
    const it = this.items.find(([key]) => `Key${key}` === k.code);
    if (it) {
      it[2](game);
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------- saves
// Save or load: five slots of your own plus the autosave. Click a slot (or
// press its number) to save there or load it; X deletes the one you're on.
export class SaveSlotsWindow extends Window {
  constructor(ui, mode, store) {
    super(ui, 60, 22, { kind: 'saves' });
    this.mode = mode;
    this.store = store;
    this.sel = mode === 'load' ? Math.max(0, store.list().findIndex((q) => q.meta && q.id === store.latest()?.id)) : 1;
    this.confirm = null;
  }
  draw(g, game) {
    const load = this.mode === 'load';
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#100c18');
    g.box(0, 0, this.w, this.h, { bg: '#100c18', double: true, title: load ? 'LOAD GAME' : 'SAVE GAME' });
    const list = this.store.list();
    list.forEach((q, i) => {
      const y = 2 + i * 3;
      const auto = q.id === 'auto';
      const usable = load ? !!q.meta : !auto;
      const hov = this.hovering(2, y, this.w - 4, 2);
      const sel = this.sel === i;
      g.fill(2, y, this.w - 4, 2, ' ', C.fg, sel ? C.bgHi : hov ? '#3a3250' : '#1a1622');
      const key = auto ? 'A' : q.id;
      g.text(3, y, `[${key}]`, usable ? C.hi : C.faint);
      if (q.meta) {
        const m = q.meta;
        g.text(8, y, `${auto ? 'Autosave: ' : ''}${m.name || 'Wanderer'}`.slice(0, 30), usable ? C.white : C.dim);
        g.text(this.w - 4 - 14, y, agoText(m.savedAt).padStart(14), C.faint);
        g.text(8, y + 1, `Day ${m.day}, ${timeText(m.minute)} · ${cap(String(m.place || '?'))} · seed ${m.seed}`.slice(0, this.w - 12), C.dim);
      } else g.text(8, y, auto ? 'Autosave (empty: written every morning at 7:00)' : '- empty -', C.faint);
      this.hit(2, y, this.w - 4, 2, () => {
        this.sel = i;
        this.pick(game);
      });
    });
    const y = this.h - 3;
    if (this.confirm) g.center(y, this.confirm.text, C.orange);
    else g.center(y, load ? 'Click a slot or press its key to load it.' : 'Click a slot or press 1-5 to save there.', C.dim);
    g.center(this.h - 2, '[↑↓] choose  [ENTER] ' + (load ? 'load' : 'save') + '  [X] delete  [ESC] back', C.faint);
  }
  pick(game) {
    const q = this.store.list()[this.sel];
    if (!q) return;
    const h = this.ui.hooks;
    if (this.mode === 'load') {
      if (!q.meta) return;
      h.loadSlot && h.loadSlot(q.id);
      return;
    }
    if (q.id === 'auto' || !game) return;
    // Saving over another game asks first.
    if (q.meta && (q.meta.seed !== game.seed || q.meta.name !== game.playerName) && !(this.confirm && this.confirm.id === q.id && this.confirm.kind === 'save')) {
      this.confirm = { id: q.id, kind: 'save', text: `Slot ${q.id} holds ${q.meta.name}'s game. Choose it again to overwrite.` };
      return;
    }
    this.confirm = null;
    if (h.saveSlot && h.saveSlot(q.id)) this.close();
  }
  remove() {
    const q = this.store.list()[this.sel];
    if (!q || !q.meta) return;
    if (!(this.confirm && this.confirm.id === q.id && this.confirm.kind === 'delete')) {
      this.confirm = { id: q.id, kind: 'delete', text: `Delete ${q.id === 'auto' ? 'the autosave' : `slot ${q.id}`}? Press X again.` };
      return;
    }
    this.store.remove(q.id);
    this.confirm = null;
    this.ui.audio?.play('break');
  }
  onKey(k, game) {
    const n = SLOTS.length;
    if (k.code === 'Escape') {
      this.close();
      return true;
    }
    if (k.code === 'ArrowUp' || k.code === 'KeyW') this.sel = (this.sel + n - 1) % n;
    else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.sel = (this.sel + 1) % n;
    else if (k.code === 'Enter' || k.code === 'Space') this.pick(game);
    else if (k.code === 'KeyX' || k.code === 'Delete') this.remove();
    else if (k.code === 'KeyA') {
      this.sel = 0;
      this.pick(game);
    } else {
      const d = /^Digit([1-5])$/.exec(k.code);
      if (!d) return true;
      this.sel = SLOTS.indexOf(d[1]);
      this.pick(game);
    }
    if (!['Enter', 'Space', 'KeyX', 'Delete'].includes(k.code)) this.confirm = this.confirm && this.confirm.id === this.store.list()[this.sel]?.id ? this.confirm : null;
    return true;
  }
}

// ---------------------------------------------------------------- death
export class DeathWindow extends Window {
  constructor(ui, cause) {
    super(ui, 44, 9, { kind: 'death' });
    this.cause = cause;
  }
  draw(g) {
    g.box(0, 0, this.w, this.h, { bg: 'rgba(40,6,8,0.95)', double: true, fg: C.red });
    g.center(2, 'YOU HAVE FALLEN', C.red);
    g.center(3, `Slain by ${this.cause}`, C.fg);
    g.center(5, 'You dropped half your coins.', C.dim);
    const hov = this.hovering(12, 7, 20, 1);
    g.center(7, '[R] Rise again', hov ? C.hi : C.fg);
    this.hit(0, 7, this.w, 1, (ck, gm) => this.respawn(gm));
  }
  respawn(game) {
    game.respawn();
    this.close();
  }
  onKey(k, game) {
    if (k.code === 'KeyR' || k.code === 'Enter' || k.code === 'Space') {
      this.respawn(game);
      return true;
    }
    return k.code === 'Escape';
  }
}

// ---------------------------------------------------------------- title
const LOGO = [
  '█████ █████ ▄████ ▄████ █████ ████▄ ▄███▄',
  '  █   █     █     █     █     █   █ █   █',
  '  █   ████  ▀███▄ ▀███▄ ████  ████▀ █████',
  '  █   █         █     █ █     █  ▀▄ █   █',
  '  █   █████ ████▀ ████▀ █████ █   █ █   █',
];

export class TitleWindow extends Window {
  constructor(ui, store) {
    super(ui, COLS, ROWS, { kind: 'title', x: 0, y: 0 });
    this.store = store;
    this.t = 0;
  }
  get hasSave() {
    return !!(this.store && this.store.any());
  }
  draw(g) {
    const t = this.t;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#07060b');
    // Drifting ascii landscape.
    for (let y = 22; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = Math.sin((x + t * 4) * 0.13 + y * 0.9) + Math.sin((x - t * 2) * 0.07 - y * 0.4);
        const ch = v > 1.2 ? '▲' : v > 0.6 ? '♣' : v > 0 ? '"' : v > -0.8 ? '·' : '≈';
        const fg = v > 1.2 ? '#6a6a7a' : v > 0.6 ? '#2e6a32' : v > 0 ? '#3a5a2a' : v > -0.8 ? '#2a3020' : '#1e3a6a';
        g.put(x, y, ch, fg);
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = (i * 37 + Math.floor(t * (i % 3 + 1))) % this.w;
      const y = (i * 13) % 20;
      g.put(x, y, i % 5 ? '·' : '*', i % 2 ? '#3a3a58' : '#6a6a8a');
    }
    const lx = Math.floor((this.w - LOGO[0].length) / 2);
    LOGO.forEach((row, i) => {
      for (let k = 0; k < row.length; k++) {
        if (row[k] === ' ') continue;
        const hue = (k + i * 3 + Math.floor(t * 12)) % 40 < 3 ? '#fff4c0' : i < 2 ? '#ffd060' : i < 4 ? '#f0a040' : '#c86a28';
        g.put(lx + k, 4 + i, row[k], hue);
      }
    });
    g.center(10, '~ a tale of tiles, towns and torchlight ~', C.dim);
    const last = this.hasSave ? this.store.latest() : null;
    const opts = [
      ...(last ? [['C', `Continue: ${last.meta.name}, day ${last.meta.day}`.slice(0, 34)]] : []),
      ['N', 'New game (random world)'],
      ['S', 'New game from seed...'],
      ...(this.hasSave ? [['L', 'Load game...']] : []),
      ['H', 'How to play'],
    ];
    opts.forEach(([k, label], i) => {
      const y = 13 + i * 2;
      const text = `[${k}]  ${label}`;
      const x = Math.floor((this.w - 38) / 2);
      const hov = this.hovering(x - 1, y, 40, 1);
      g.fill(x - 1, y, 40, 1, ' ', C.fg, hov ? C.bgHi : 'rgba(20,16,28,0.9)');
      g.text(x, y, text, hov ? C.hi : C.fg);
      this.hit(x - 1, y, 40, 1, () => this.choose(k));
    });
    if (Math.floor(t * 2) % 2) g.center(this.h - 2, 'PRESS A KEY', C.faint);
  }
  update(dt) {
    this.t += dt;
  }
  choose(k) {
    const h = this.ui.hooks;
    if (k === 'N') h.start && h.start(null);
    if (k === 'C' && this.hasSave) h.continue && h.continue();
    if (k === 'L' && this.hasSave) h.load && h.load();
    if (k === 'S' && h.askSeed) h.askSeed();
    if (k === 'H') this.ui.open(new HelpWindow(this.ui));
  }
  onKey(k) {
    const map = { KeyN: 'N', KeyC: 'C', KeyL: 'L', KeyS: 'S', KeyH: 'H', Enter: this.hasSave ? 'C' : 'N', Space: this.hasSave ? 'C' : 'N' };
    if (this.ui.find('help') || this.ui.find('saves') || this.ui.find('create')) return false;
    if (map[k.code]) this.choose(map[k.code]);
    return true;
  }
}

export { slotTable };
