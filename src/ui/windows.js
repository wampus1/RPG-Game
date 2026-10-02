// All UI windows. Each draws itself into a character grid every frame.
import { COLS, ROWS, MAP_W, MAP_H, REGION_W, REGION_D, BELT_SIZE, CHAR_W, CHAR_H, INV_SIZE } from '../config.js';
import { Window, cap, describeActivity } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS, maxStack, WEAR_SLOTS, GEMS, canSocket, socketed, twoHanded, offhandable } from '../world/items.js';
import { recipesFor, STATIONS } from '../world/recipes.js';
import { addItem, removeItem, countItem, countAny, removeAny, anyName } from '../game/inventory.js';
import { has as heroHas } from '../game/hero.js';
import { BIOMES } from '../world/biomes.js';
import { openingLine, topicsFor, respond } from '../game/dialogue.js';
import { TechWindow } from './research.js';
import { humanoidSheet, SPR_PAD, SHEET_H } from '../render/sprites.js';
import { STOCK, WANTS, st, mayorOf, alive, stockOf, freshRumours, rumourAge } from '../sim/econ.js';
import { TIERS } from '../sim/growth.js';
import { BUILDING_NAMES } from '../world/settlement.js';
import { repLevel, RENOWN } from '../sim/sim.js';
import { describe, lcFirst } from '../sim/justice.js';
import { SLOTS, agoText, timeText } from '../game/saves.js';
import { LAWS, lawList, byDecree } from '../sim/laws.js';
import { SETTING_ROWS, changeSetting } from '../game/settings.js';
import { runCommand, complete, teleportTo } from '../game/commands.js';
import { gemText } from '../game/gems.js';

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
      const sy = 2 + j * 3;
      const hov = this.hovering(sx, sy, 3, 2);
      g.box(sx - 1, sy - 1, 5, 4, { fg: C.faint });
      g.fill(sx, sy, 3, 2, ' ', C.fg, hov ? 'rgba(70,60,90,0.95)' : 'rgba(26,22,34,0.95)');
      const it = p.equip[k] && ITEMS[p.equip[k]];
      if (it) {
        g.icon(sx, sy, p.equip[k], 0);
        if (hov) this.ui.itemTooltip({ item: p.equip[k], count: 1 });
      } else g.text(sx + 1, sy, '·', C.faint);
      // (The shield arm: a shield, or a second blade to fight with.)
      const slung = k === 'shield' && it && twoHanded(p.heldItem());
      g.text(sx + 5, sy, k === 'shield' ? (it && it.kind === 'weapon' ? 'Off hand' : 'Shield') : cap(k), it ? C.fg : C.faint);
      g.text(sx + 5, sy + 1, slung ? 'slung (2-hand)' : it ? (it.kind === 'weapon' ? `dmg ${it.damage}` : it.block ? `blocks ${Math.round(it.block * 100)}%` : it.armor ? `-${Math.round(it.armor * 100)}%` : 'worn') : '', slung ? C.orange : C.dim);
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
      const fits = it && ((it.kind === 'armor' && it.slot === k) || (k === 'shield' && offhandable(cs.item)));
      if (!fits) {
        ui.audio?.play('error');
        if (it && it.kind === 'weapon' && k === 'shield') ui.msg(it.hands === 2 ? 'That takes both hands.' : 'That\'s no weapon for the off hand.', '#c8c8c8', true);
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
    // Right-click a one-handed blade: into the off hand, to fight with two.
    if (ck.button === 2 && p.inv[i] && offhandable(p.inv[i].item) && !this.ui.cursorStack) {
      if (p.wear(i)) {
        this.ui.audio?.play('equip');
        this.ui.msg(`${ITEMS[p.equip.shield].name} in your off hand.`, '#c8e0ff', true);
      }
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
    for (const [k, n] of Object.entries(r.in)) if (countAny(inv, k) < n) return false;
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
        const have = countAny(inv, key);
        return { text: `${n} ${anyName(key) || ITEMS[key]?.name || key}`, ok: have >= n };
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
    // The scribe's desk prints; the jeweller's bench sets stones.
    const extra = this.station === 'scribe' ? ' [P] print a newspaper ' : this.station === 'jeweller' ? ' [S] set a gem ' : null;
    if (extra) {
      const ey = this.h - 3;
      const hov = this.hovering(this.w - extra.length - 2, ey, extra.length, 1);
      g.text(this.w - extra.length - 2, ey, extra, hov ? C.white : C.hi, '#2a2230');
      this.hit(this.w - extra.length - 2, ey, extra.length, 1, () => this.extra());
    }
  }
  extra() {
    const game = this.ui.game;
    if (this.station === 'scribe') {
      const s = game.currentSettlement;
      if (!s) {
        this.ui.msg('There\'s no town here to write about.', C.dim);
        return;
      }
      this.ui.open(new PrintWindow(this.ui, game, game.world.getLayout(s)));
    } else if (this.station === 'jeweller') this.ui.open(new SettingWindow(this.ui, game));
  }
  onKey(k) {
    if ((this.station === 'scribe' && k.code === 'KeyP') || (this.station === 'jeweller' && k.code === 'KeyS')) {
      this.extra();
      return true;
    }
    return false;
  }
  craft(r, game, times) {
    const inv = game.player.inv;
    let made = 0;
    const saved = [];
    for (let t = 0; t < times; t++) {
      if (!this.canCraft(inv, r)) break;
      const used = [];
      for (const [k, n] of Object.entries(r.in)) used.push(...removeAny(inv, k, n));
      // A cook gets more out of the pot; a tinker wastes less.
      const food = ITEMS[r.out]?.kind === 'food';
      const extra = food && heroHas(game.hero, 'cook') && Math.random() < 0.35 ? 1 : 0;
      const left = addItem(inv, r.out, r.n + extra);
      if (left) game.spawnDrop(r.out, left, game.player.x, game.player.y, game.player.z, true);
      if (extra) saved.push(`an extra ${ITEMS[r.out].name}`);
      if (!food && heroHas(game.hero, 'tinker') && Math.random() < 0.25) {
        const back = used.length ? used[Math.floor(Math.random() * used.length)][0] : null;
        if (back && ITEMS[back] && !addItem(inv, back, 1)) saved.push(`a ${ITEMS[back].name}`);
      }
      made++;
    }
    if (made) {
      game.audio?.play('craft');
      game.stats.crafted += made;
      this.ui.msg(`Crafted ${ITEMS[r.out].name} x${r.n * made}`, C.green);
      if (saved.length) this.ui.msg(`(And ${saved.length > 1 ? `${saved.length} things` : saved[0]} to spare.)`, '#a8e090');
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
    if (r.open === 'tech') {
      this.ui.open(new TechWindow(this.ui, game, n.settlement));
      return;
    }
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
    // Back to the conversation you were having (not a second one on top).
    const reply = [...lines, `(${repLevel(game.sim.opinion(n)).label})`];
    const talk = this.ui.find('dialogue');
    if (talk && talk.npc === n) talk.say(reply);
    else {
      if (talk) talk.close();
      this.ui.open(new DialogueWindow(this.ui, n, game, reply));
    }
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
    return game.sim.buyPrice(this.npc, k);
  }
  basePrice(k, game) {
    return game.sim.buyPrice(this.npc, k, false);
  }
  sellPrice(k, game) {
    return game.sim.sellPrice(this.npc, k);
  }
  wants(k, game) {
    const sh = this.shop(game);
    if (!sh || k === 'coin' || ITEMS[k].noSell) return false;
    const w = WANTS[sh.kind];
    // An adventurer will look at any weapon, armour or food you have.
    if (sh.kind === 'adventurer') {
      const it = ITEMS[k];
      if (it && (it.socket || it.kind === 'weapon' || it.kind === 'armor' || it.kind === 'food')) return true;
    }
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
      const pr = this.wants(k, game) ? this.sellPrice(k, game) : 0;
      const glut = game.sim.sellGlut(this.npc, k);
      g.text(40, 16, !this.wants(k, game) ? 'They don\'t want that.' : pr <= 0 ? 'They have all they want of that.' : `They'll pay ¤${pr}${glut < 1 ? ' for the next one' : ' each'}`, this.wants(k, game) && pr > 0 ? C.green : C.red);
      const mf = game.sim.market.factor(this.npc.layout, k);
      if (this.wants(k, game) && pr > 0 && glut < 1) g.text(40, 17, '(they have plenty: less each)', C.orange);
      else if (this.wants(k, game) && pr > 0 && mf < 0.9) g.text(40, 17, '(plenty about round here: cheap)', C.orange);
      else if (this.wants(k, game) && pr > 0 && mf > 1.1) g.text(40, 17, '(short round here: a good price)', C.green);
      else if (this.wants(k, game) && game.sim.careers.sellFactor(this.npc, k) > 1) g.text(40, 17, '(licensed seller\'s premium)', C.cyan);
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
      game.sim.market.trade(this.npc.layout, k, -bought, 'player');
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
    // One at a time: each one they take makes the next worth a little less
    // (unless it's what their trade runs on), until they want no more.
    const item = s.item;
    const want = all ? s.count : 1;
    let n = 0;
    let paid = 0;
    let why = null;
    while (n < want) {
      const pr = this.sellPrice(item, game);
      if (pr <= 0) {
        why = 'full';
        break;
      }
      if (sh.purse.get() < pr) {
        why = 'money';
        break;
      }
      sh.purse.add(-pr);
      st.add(sh.store, item, 1);
      paid += pr;
      n++;
    }
    if (n <= 0) {
      this.npc.say(why === 'full' ? this.npc.rng.pick(['I\'ve got more of those than I can use.', 'No more of those, thanks. I\'m full up.', 'I couldn\'t sell another one.']) : 'I can\'t afford that right now.', 2.5);
      game.audio?.play('error');
      return;
    }
    s.count -= n;
    if (s.count <= 0) p.inv[i] = null;
    const left = p.give('coin', paid);
    if (left) game.spawnDrop('coin', left, p.x, p.y, p.z, true);
    game.sim.noteTrade(this.npc, Math.ceil(paid / 2));
    game.sim.market.trade(this.npc.layout, item, n, 'player');
    game.audio?.play('coin');
    if (why === 'full') this.npc.say('That\'s all of those I can take.', 2.5);
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
    // A deserter: one line for the whole realm, not a line a town.
    const flee = sim.war.deserters || {};
    const realmOf = (sid) => game.world.ow.settlements[sid]?.civ;
    for (const [cid, d] of Object.entries(flee)) {
      const civ = game.world.ow.civs.find((c) => String(c.id) === cid) || sim.realms.extraCivs?.find((c) => String(c.id) === cid);
      any = true;
      para(`DESERTER of the ${civ ? civ.name.replace(/^The /, '') : 'realm'} (${d.battle}): wanted in all its towns!`, C.red);
    }
    for (const sid of game.wanted.keys()) {
      if (!game.isWanted(sid)) continue;
      const civ = realmOf(sid);
      if (civ && flee[civ.id] && !sim.justice.pendingIn(sid).some((c) => c.type !== 'desertion')) continue;
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
    // Two sides to the board: the town's own business, and its news.
    this.tab = 'town';
    this.scrolls = { town: 0, news: 0 };
  }
  setTab(t) {
    if (t === this.tab) return;
    this.scrolls[this.tab] = this.scroll || 0;
    this.tab = t;
    this.scroll = this.scrolls[t] || 0;
    this.ui.audio?.play('select');
  }
  // The town's business: who runs it, its money, laws and realm.
  townLines(game) {
    const { s, L } = this;
    const e = L.econ;
    const out = [];
    const row = (k, v, col = '#f0e0c0') => out.push({ k, t: v, c: col });
    const m = mayorOf(L);
    const living = L.npcs.filter(alive);
    const you = game.sim.playerCount(s.id);
    const pop = living.length + you;
    const coffers = e.treasury > pop * 35 ? 'overflowing' : e.treasury > pop * 15 ? 'healthy' : e.treasury > pop * 5 ? 'thin' : 'nearly empty';
    row(s.type === 'village' ? 'Elder' : 'Mayor', m ? `${m.name.first} ${m.name.last}` : '(none: the council governs)');
    row('Population', `${pop}${you ? ' (you among them)' : ''}${game.sim.playerGuard(s.id) ? ', you on the watch' : ''}`);
    row('Treasury', `¤${e.treasury} (${coffers})`, coffers === 'nearly empty' ? C.orange : '#f0e0c0');
    row('Taxes', `${Math.round(e.tax * 100)}% of earnings${e.taxY ? ` (¤${e.taxY} collected)` : ''}`);
    row('Fines', e.fineScale > 1.05 ? `harsh (×${e.fineScale})` : e.fineScale < 0.95 ? `lenient (×${e.fineScale})` : 'standard');
    const laws = lawList(L);
    if (!laws.length) row('Laws', 'No special laws');
    laws.forEach((id, i) => row(i ? '' : 'Laws', LAWS[id].name + (byDecree(L, id) && !L.econ.laws[id] ? ' (realm)' : '')));
    // The realm: who rules it and from where, what they've decreed, what
    // this town sends the capital (or gets from it), and the neighbours.
    const civ = s.civ;
    const R = civ ? game.sim.realms.realm(civ) : null;
    if (R) {
      const capS = game.world.ow.settlements[R.capital];
      const rn = game.sim.realms.rulerName(civ);
      row('Realm', R.capital === s.id ? `Capital: ${rn || 'no ruler yet'}` : `${rn || 'Ruled'} from ${capS ? capS.name : '?'}`);
      const d = R.decrees;
      const dec = [d.taxFloor ? `tax at least ${Math.round(d.taxFloor * 100)}%` : null, d.armsBan ? 'no weapons' : null,
        ...d.tariffOn.map((id) => `tariff on the ${game.world.ow.civs[id]?.name.replace(/^The /, '') || '?'}`)].filter(Boolean);
      if (d.watch && d.watch !== 'standard') dec.push(d.watch === 'heavy' ? 'a heavy watch' : 'a light watch');
      if (d.draft && d.draft !== 'none') dec.push(d.draft === 'all' ? 'elders and children drafted' : 'elders drafted');
      row('Decrees', dec.length ? dec.join(', ') : 'none');
      // Allies, lords and vassals; a war, and how it goes.
      game.sim.politics.summary(civ).forEach((t, i) => row(i ? '' : 'Pacts', t, C.green));
      game.sim.war.summary(civ).forEach((t, i) => row(i ? '' : 'War', t, i ? '#f0e0c0' : C.orange));
      if (R.capital !== s.id && (e.independence ?? -1) > 0) row('Unrest', `${Math.round(Math.min(1, (e.independence + 1) / 2) * 100)}% for breaking away${e.secedeVotes ? ': talk of it everywhere' : ''}`, e.secedeVotes ? C.orange : '#f0e0c0');
      if (civ.freed) row('Freedom', `free of the ${game.world.ow.civs[civ.freed.from]?.name.replace(/^The /, '') || '?'} since day ${Math.max(1, civ.freed.day)}`, C.green);
      const aid = (e.royalAid || []).slice(-1)[0];
      if (R.capital !== s.id) row('Tribute', `${Math.round(R.share * 100)}% of taxes to the capital${e.tributeY ? ` (¤${e.tributeY})` : ''}${aid ? `; help: ${aid.kind === 'guard' ? 'a guard' : aid.kind === 'road' ? 'a road' : aid.kind === 'wall' ? 'a wall' : '¤' + aid.amount}` : ''}`);
      else row('Tribute', `¤${R.tribute} received from the realm`);
      game.world.ow.civs.filter((o) => o !== civ).forEach((o, i) => {
        const st = game.sim.realms.standing(civ, o);
        row(i ? '' : 'Relations', `${st}: ${o.name.replace(/^The /, '')}`, st === 'hostile' ? C.orange : st === 'friendly' ? C.green : '#f0e0c0');
      });
    }
    if ((e.raidAlert || 0) > game.sim.abs) row('Warning', 'Raiders have been seen nearby. Merchants are keeping off the roads.', C.orange);
    const hungry = living.filter((r) => r.hungry >= 1).length;
    row('Food', hungry ? `${hungry} going hungry` : 'Everyone is fed', hungry ? C.orange : C.green);
    const visits = (game.sim.visits.get(s.id) || []).filter((v) => game.sim.abs >= v.arrive && game.sim.abs < v.leave);
    const advs = game.sim.adventurers.here(s.id);
    if (visits.length || advs.length) row('Visitors', [visits.length ? `Merchant from ${visits[0].fromName}` : null, advs.length ? `${advs.length === 1 ? `${advs[0].name.first} ${advs[0].name.last}, adventurer` : `${advs.length} adventurers`}` : null].filter(Boolean).join('; '));
    const k = stockOf(L);
    const mk = game.sim.market.notes(L, 3);
    if (mk.length) row('Market', mk.map((q) => q.text).join('; '), '#f0e0c0');
    row('Stores', `${k.wood} timber, ${k.stone} stone${e.short ? ` (short for a ${BUILDING_NAMES[e.short]?.toLowerCase() || e.short})` : ''}`, e.short ? C.orange : '#f0e0c0');
    const t = TIERS[s.type];
    if (t) row('Growth', `${pop}/${t.pop} people to become a ${t.next}`);
    // (Long values wrap onto the lines below.)
    const lines = [];
    for (const r of out) wrap(r.t, this.w - 23).forEach((l, i) => lines.push({ k: i ? '' : r.k, t: l, c: r.c }));
    return lines;
  }
  // The town's news: what's happened here, newest first, and news from
  // other towns (which comes down after two days, fading as it goes).
  newsLines(game) {
    const e = this.L.econ;
    const lines = [];
    const now = game.sim.now();
    const far = freshRumours(e, now).reverse();
    // Wanted: the bands the council has put a price on.
    const wanted = game.sim.bandits ? game.sim.bandits.bountiesIn(this.L) : [];
    if (wanted.length) {
      lines.push({ t: 'WANTED', c: C.orange });
      for (const b of wanted) {
        const band = game.sim.bandits.get(b.band);
        const at = band && band.camp ? `, camped ${game.sim.bandits.where(band, this.L.settlement)}` : '';
        // (Read it here: the camp goes on your map.)
        if (band && band.camp) game.sim.bandits.learnOf(band, `the notice board in ${this.L.settlement.name}`);
        for (const l of wrap(`${b.name[0].toUpperCase()}${b.name.slice(1)} (${band ? band.members.length : '?'})${at}. ¤${b.perHead} a head, paid at the town hall.`, this.w - 7)) lines.push({ t: l, c: '#f0c090' });
      }
      lines.push({ t: '', c: C.fg });
    }
    lines.push({ t: 'NOTICES', c: C.hi });
    const notes = e.ledger.map((n, i) => ({ n, i })).sort((a, b) => b.n.day - a.n.day || b.i - a.i).map((q) => q.n);
    if (!notes.length) lines.push({ t: 'Nothing posted yet.', c: C.dim });
    // A rule between the days; the everyday comings and goings fainter
    // than the news that matters.
    let lastDay = null;
    for (const n of notes) {
      const d = Math.max(1, n.day);
      if (d !== lastDay) {
        const label = ` Day ${d}${d === game.day ? ' (today)' : d === game.day - 1 ? ' (yesterday)' : ''} `;
        const side = Math.max(2, Math.floor((this.w - 7 - label.length) / 2));
        if (lastDay !== null) lines.push({ t: '', c: C.fg });
        lines.push({ t: `${'─'.repeat(side)}${label}${'─'.repeat(side)}`, c: '#8a7a5a' });
        lastDay = d;
      }
      const minor = newsWeight(n.text) < 1;
      for (const l of wrap(n.text, this.w - 7)) lines.push({ t: l, c: minor ? '#8e826c' : '#e8d8b8' });
    }
    if (far.length) {
      lines.push({ t: '', c: C.fg });
      lines.push({ t: 'NEWS FROM AFAR', c: C.hi });
      for (const r of far) {
        const c = mixHex(C.cyan, '#3a4a4a', Math.min(0.85, rumourAge(r, now) * 1.1));
        for (const l of wrap(`${r.from}: ${r.text}`, this.w - 7)) lines.push({ t: l, c });
      }
    }
    return lines;
  }
  draw(g, game) {
    const { s } = this;
    g.box(0, 0, this.w, this.h, { bg: 'rgba(40,30,20,0.96)', double: true, title: 'NOTICE BOARD' });
    g.center(1, `${s.name.toUpperCase()} · ${cap(s.type)} of the ${s.civ ? s.civ.name.replace(/^The /, '') : 'free folk'}`, '#f0e0c0');
    // The tabs.
    const tabs = [['town', ' TOWN '], ['news', ' NEWS ']];
    let tx = Math.floor(this.w / 2) - 8;
    for (const [id, label] of tabs) {
      const on = this.tab === id;
      const hov = this.hovering(tx, 3, label.length, 1);
      g.fill(tx, 3, label.length, 1, ' ', C.fg, on ? '#6a5030' : hov ? '#4a3a26' : '#2e2418');
      g.text(tx, 3, label, on ? C.hi : hov ? '#f0e0c0' : C.dim);
      this.hit(tx, 3, label.length, 1, () => this.setTab(id));
      tx += label.length + 3;
    }
    for (let x = 2; x < this.w - 2; x++) g.put(x, 4, '─', '#5a4a3a');
    const y = 5;
    const lines = this.tab === 'town' ? this.townLines(game) : this.newsLines(game);
    const room = this.h - 1 - y;
    this.maxScroll = Math.max(0, lines.length - room);
    this.scroll = Math.max(0, Math.min(this.scroll || 0, this.maxScroll));
    lines.slice(this.scroll, this.scroll + room).forEach((l, i) => {
      if (l.k !== undefined) {
        g.text(3, y + i, l.k, C.dim);
        g.text(18, y + i, l.t, l.c);
      } else g.text(3, y + i, l.t, l.c);
    });
    if (this.maxScroll) {
      const bar = Math.max(1, Math.floor(room * room / lines.length));
      const pos = Math.round((room - bar) * this.scroll / this.maxScroll);
      for (let i = 0; i < room; i++) g.put(this.w - 3, y + i, i >= pos && i < pos + bar ? '█' : '│', i >= pos && i < pos + bar ? '#c8a878' : '#5a4a3a');
    }
    g.text(3, this.h - 1, ` ←→ / TAB switch${this.maxScroll ? ' · ↑↓ scroll' : ''} `, C.faint);
    g.text(this.w - 12, this.h - 1, ' [ESC] ok ', C.faint);
  }
  onWheel(d) {
    this.scroll = Math.max(0, Math.min(this.maxScroll || 0, (this.scroll || 0) + Math.sign(d) * 3));
  }
  onKey(k) {
    if (k.code === 'ArrowDown' || k.code === 'KeyS') this.scroll = Math.min(this.maxScroll || 0, (this.scroll || 0) + 1);
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.scroll = Math.max(0, (this.scroll || 0) - 1);
    else if (k.code === 'PageDown') this.scroll = Math.min(this.maxScroll || 0, (this.scroll || 0) + 10);
    else if (k.code === 'PageUp') this.scroll = Math.max(0, (this.scroll || 0) - 10);
    else if (k.code === 'ArrowLeft' || k.code === 'KeyA' || k.code === 'Digit1') this.setTab('town');
    else if (k.code === 'ArrowRight' || k.code === 'KeyD' || k.code === 'Digit2') this.setTab('news');
    else if (k.code === 'Tab') this.setTab(this.tab === 'town' ? 'news' : 'town');
    else if (k.code === 'Enter' || k.code === 'Space' || k.code === 'KeyE') this.close();
    else return false;
    return true;
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
    const icons = settlementIcons(game);
    this.icons = icons;
    for (let cz = 0; cz < MAP_H; cz++) {
      for (let cx = 0; cx < MAP_W; cx++) {
        const cell = ow.cell(cx, cz);
        const x = 2 + cx * 2;
        const y = 1 + cz;
        const known = ow.explored[cz * MAP_W + cx] || game.revealMap;
        const icon = icons.get(cz * 10000 + cx);
        if (this.hovering(x, y, 2, 1)) hover = { cell, known, icon };
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
          g.put(x + hf, y, ch, fg, bg);
        }
        if (icon) {
          const s = icon.s;
          const col = s.civ ? s.civ.color.hex : '#e8e8e8';
          g.text(x, y, icon.glyph, '#fff4d0', shadeHex(col, icon.shade));
          if (s.condition === 'abandoned' || s.deserted) g.text(x, y, ' †', '#a0a0a0', '#302830');
        }
        if (cx === pcx && cz === pcz && blink) g.put(x + ((p.x % REGION_W) >= REGION_W / 2 ? 1 : 0), y, '@', '#ffffff', '#c02020');
      }
    }
    // Wars and raids: tomorrow's battlefield, the fields fought over
    // lately, and towns expecting raiders.
    let mark = null;
    const seen = (cx, cz) => cx >= 0 && cz >= 0 && cx < MAP_W && cz < MAP_H && (ow.explored[cz * MAP_W + cx] || game.revealMap);
    this.armies = [];
    for (const m of game.sim.war.markers()) {
      const cx = Math.floor(m.x / REGION_W);
      const cz = Math.floor(m.z / REGION_D);
      if (!seen(cx, cz)) continue;
      // (Armies on the march are drawn finer, below.)
      if (m.kind === 'army') {
        this.armies.push(m);
        if (this.hovering(2 + cx * 2, 1 + cz, 2, 1)) mark = m;
        continue;
      }
      const x = 2 + cx * 2 + (m.kind === 'raid' ? 0 : (m.x % REGION_W) >= REGION_W / 2 ? 1 : 0);
      const y = 1 + cz;
      if (m.kind !== 'raid' && icons.has(cz * 10000 + cx)) continue;
      if (m.kind === 'raid') {
        if (blink) g.put(x, y, '!', '#ffffff', '#c03020');
      } else g.put(x, y, 'X', m.kind === 'battle' ? '#ffffff' : '#ff9080', m.kind === 'battle' ? (blink ? '#c02020' : '#801818') : '#3a1a1a');
      if (this.hovering(x, y, 1, 1)) mark = m;
    }
    // Bandit camps you've heard of (or seen the smoke of).
    for (const c of game.sim.bandits ? game.sim.bandits.knownCamps() : []) {
      const cx = Math.floor(c.x / REGION_W);
      const cz = Math.floor(c.z / REGION_D);
      if (cx < 0 || cz < 0 || cx >= MAP_W || cz >= MAP_H || icons.has(cz * 10000 + cx)) continue;
      const x = 2 + cx * 2 + ((c.x % REGION_W) >= REGION_W / 2 ? 1 : 0);
      g.put(x, 1 + cz, '▲', c.hired ? '#ffd080' : '#f0a060', '#3a1a10');
      if (this.hovering(x, 1 + cz, 1, 1)) mark = { label: `Camp of ${c.name} (${c.n} of them${c.hired ? ', hired swords' : ''})${c.from ? `: heard of from ${c.from}` : ''}` };
    }
    const y0 = MAP_H + 2;
    if (hover && hover.known) {
      const c = hover.cell;
      let info = `${BIOMES[c.biome].name}`;
      if (c.river) info += ' · river';
      if (c.lake) info += ' · lake';
      if (hover.icon) {
        const s = hover.icon.s;
        info = `${s.name} · ${cap(s.type)} · ${s.condition} · ${BIOMES[s.biome].name}`;
        const L = game.world.layouts.get(s.id);
        const rd = L && L.econ && L.econ.raidedDay;
        if (rd !== undefined && rd !== null && game.day - rd <= 3) info += game.day === rd ? ' · raided today' : ` · raided ${game.day - rd} day${game.day - rd === 1 ? '' : 's'} ago`;
        g.text(2, y0 + 1, s.civ ? `${s.civ.name} (${s.civ.people}; ${s.civ.values.join(', ')})` : 'Independent', s.civ ? s.civ.color.hex : C.dim);
      } else if (c.civ !== null && ow.civs[c.civ]) g.text(2, y0 + 1, `Territory of the ${ow.civs[c.civ].name}`, ow.civs[c.civ].color.hex);
      g.text(2, y0, info.slice(0, this.w - 4), C.hi);
      if (mark) g.text(2, y0 + 1, mark.label.slice(0, this.w - 4).padEnd(this.w - 4), '#ff9080');
    } else if (hover) g.text(2, y0, 'Unexplored', C.dim);
    if (mark && !(hover && hover.known)) g.text(2, y0 + 1, mark.label.slice(0, this.w - 4).padEnd(this.w - 4), '#ff9080');
    else g.text(2, y0, 'Each square = 2x2 screens. Hover for details.', C.dim);
    g.text(2, y0 + 2, '⌂ village [■] town ┌┐ city ─ road † ruin X battle ! raid ▲ bandits', C.faint);
    const t = ` ${game.cheats?.mapTeleport ? '[CLICK] teleport  ' : ''}[V] ${this.civView ? 'biomes' : 'civilizations'}  [M/ESC] close `;
    g.text(this.w - t.length - 2, this.h - 1, t, game.cheats?.mapTeleport ? C.hi : C.dim);
  }
  // The roads between towns, drawn over the land as a line through each
  // map square they pass: straight across, straight up, or round a corner
  // (as the road really runs). Only what's built, and only where you've
  // been; town squares keep their icons, the road running up to them.
  drawPixels(ctx, game) {
    if (!game) return;
    const ow = game.world.ow;
    const icons = this.icons || settlementIcons(game);
    const ox = this.x * CHAR_W;
    const oy = this.y * CHAR_H;
    const known = (cx, cz) => cx >= 0 && cz >= 0 && cx < MAP_W && cz < MAP_H && (ow.explored[cz * MAP_W + cx] || game.revealMap);
    const links = roadCellLinks(game.sim.diplomacy.roads);
    const w = CHAR_W * 2;
    const h = CHAR_H;
    ctx.save();
    for (const [k, dirs] of links) {
      const cx = k % 10000;
      const cz = Math.floor(k / 10000);
      if (!known(cx, cz) || icons.has(k)) continue;
      const mx = Math.round(ox + (2 + cx * 2) * CHAR_W + w / 2);
      const my = Math.round(oy + (1 + cz) * CHAR_H + h / 2);
      // A dark edge under a pale line, so it reads on any ground.
      for (const [col, t] of [['rgba(40,28,16,0.55)', 4], ['rgba(238,212,160,0.9)', 2]]) {
        ctx.fillStyle = col;
        for (const d of dirs) {
          // From the middle of the square out to the edge it leaves by.
          if (d === 'E') ctx.fillRect(mx - t / 2, my - t / 2, w / 2 + t / 2, t);
          else if (d === 'W') ctx.fillRect(mx - w / 2, my - t / 2, w / 2 + t / 2, t);
          else if (d === 'S') ctx.fillRect(mx - t / 2, my - t / 2, t, h / 2 + t / 2);
          else ctx.fillRect(mx - t / 2, my - h / 2, t, h / 2 + t / 2);
        }
        if (dirs.size === 1) {
          // A road that stops here (still being built): a dot at the end.
          ctx.fillRect(mx - t / 2, my - t / 2, t, t);
        }
      }
    }
    // Where something on the map is, in pixels.
    const at = (x, z) => ({ x: ox + (2 + (x / REGION_W) * 2) * CHAR_W, y: oy + (1 + z / REGION_D) * CHAR_H });
    const time = this.ui.time;
    // Smoke still rising over a town raided these last days.
    for (const s of ow.settlements) {
      const L = game.world.layouts.get(s.id);
      const rd = L && L.econ ? L.econ.raidedDay : undefined;
      if (rd === undefined || rd === null || game.day - rd > 3 || !known(s.cx, s.cz)) continue;
      const fresh = 1 - (game.day - rd) / 4;
      const mx = ox + (2 + s.cx * 2) * CHAR_W + w / 2;
      const my = oy + (1 + s.cz) * CHAR_H + 2;
      if (game.day - rd <= 1) {
        ctx.fillStyle = `rgba(255,140,40,${0.35 + 0.25 * Math.sin(time * 9)})`;
        ctx.fillRect(mx - 2, my - 1, 4, 2);
      }
      for (let i = 0; i < 4; i++) {
        const ph = (time * 0.45 + i / 4 + s.id * 0.13) % 1;
        const r = 1.5 + ph * 3.5;
        ctx.fillStyle = `rgba(${game.day === rd ? '70,66,62' : '130,126,120'},${(1 - ph) * 0.55 * fresh})`;
        ctx.beginPath();
        ctx.arc(mx + Math.sin(ph * 5 + i) * 2 + ph * 3, my - ph * 16, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Goods on the move: merchants and caravans along the roads (a few).
    this.tradeT = (this.tradeT || 0) - 1;
    if (this.tradeT <= 0 || !this.trade) {
      this.tradeT = 20;
      // (Where they really are, when they're out on the road near you; one
      // mark for a whole company, at its lead wagon.)
      const ents = game.caravans || new Map();
      const marks = new Map();
      const add = (k, x, z, live) => {
        const m = marks.get(k);
        if (!m || (live && !m.live)) marks.set(k, { x, z, live });
      };
      for (const tr of game.sim.travellers()) {
        if (!tr.pos || !(tr.company || (tr.rec && (tr.rec.traveler || tr.rec.job === 'merchant')))) continue;
        const n = ents.get(tr.key);
        const live = n && !n.dead;
        add(tr.company ? `g${tr.company.id}` : tr.key, live ? n.x : tr.pos.x, live ? n.z : tr.pos.z, live);
      }
      // (And those still riding in, whose journey's reckoning has them there.)
      for (const [k, n] of ents) {
        if (n.dead || !n.tr || !(n.tr.company || n.tr.rec.traveler || n.tr.rec.job === 'merchant')) continue;
        add(n.tr.company ? `g${n.tr.company.id}` : k, n.x, n.z, true);
      }
      this.trade = [...marks.values()].sort((a, b) => b.live - a.live).slice(0, 14);
    }
    for (const t of this.trade) {
      const cx = Math.floor(t.x / REGION_W);
      const cz = Math.floor(t.z / REGION_D);
      if (!known(cx, cz) || icons.has(cz * 10000 + cx)) continue;
      const q = at(t.x, t.z);
      ctx.fillStyle = 'rgba(40,24,8,0.8)';
      ctx.fillRect(Math.round(q.x) - 2, Math.round(q.y) - 2, 4, 4);
      ctx.fillStyle = Math.floor(time * 2 + t.x) % 2 ? '#ffe080' : '#f0c040';
      ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2);
    }
    // Armies on the march: a banner in their colours, a column behind.
    for (const m of this.armies || []) {
      const q = at(m.x, m.z);
      const bx = Math.round(q.x);
      const by = Math.round(q.y);
      ctx.fillStyle = 'rgba(30,20,20,0.85)';
      for (let i = 1; i <= 3; i++) ctx.fillRect(bx - i * 3, by + 1, 2, 2);
      ctx.fillRect(bx, by - 8, 1, 10);
      ctx.fillStyle = m.color || '#c03030';
      const wave = Math.round(Math.sin(time * 6) * 0.6);
      ctx.fillRect(bx + 1, by - 8 + wave, 5, 3);
    }
    ctx.restore();
  }
  // With map teleport on (the command console), a click takes you there.
  onClick(ck, cx, cy, game) {
    if (!game || !game.cheats?.mapTeleport || ck.button !== 0) return super.onClick(ck, cx, cy, game);
    const mx = Math.floor((cx - 2) / 2);
    const mz = cy - 1;
    if (mx < 0 || mz < 0 || mx >= MAP_W || mz >= MAP_H) return true;
    const ow = game.world.ow;
    if (!ow.explored[mz * MAP_W + mx] && !game.revealMap) {
      this.ui.msg('You can only teleport to places you have seen (or "reveal" the map).', '#ff9060');
      return true;
    }
    const cell = ow.cell(mx, mz);
    if (cell && cell.biome === 'ocean') {
      this.ui.msg('That\'s the open sea.', '#ff9060');
      return true;
    }
    // (To the square of a town, or the half of the square you clicked.)
    const icon = settlementIcons(game).get(mz * 10000 + mx);
    const s = icon ? icon.s : null;
    const L = s ? game.sim.layoutOf(s.id) : null;
    const x = L && L.plaza ? L.plaza.cx : mx * REGION_W + ((cx - 2) % 2 ? REGION_W * 0.75 : REGION_W * 0.25);
    const z = L && L.plaza ? L.plaza.cz + 3 : mz * REGION_D + REGION_D / 2;
    teleportTo(game, x, z);
    this.ui.msg(s ? `Teleported to ${s.name}.` : 'Teleported.', '#c8d8ff');
    this.close();
    return true;
  }
  onKey(k) {
    if (k.code === 'KeyV') {
      this.civView = !this.civView;
      return true;
    }
    return false;
  }
}

// Where each place shows on the map, and how: a village is one square, a
// town two, a city a block of four (with a double line once it has walls).
// A place that has grown spreads into the squares next to it, but only once
// its streets have actually reached them.
const ICON_SIZE = { village: [1, 1], town: [2, 1], city: [2, 2] };
// Each road as runs of points along one lane of it (built stretches only,
// broken wherever \`open\` says the map doesn't show it).
export function roadLines(roads, open = () => true, every = 6) {
  const out = [];
  for (const r of roads) {
    const n = r.tiles.length;
    const fa = r.fromA ?? r.built ?? 0;
    const fb = r.fromB || 0;
    const built = (i) => r.done || i < fa || i >= n - fb;
    let run = [];
    const flush = () => {
      if (run.length > 1) out.push(run);
      run = [];
    };
    for (let i = 0; i < n; i += 2) {
      const [x, , z] = r.tiles[i];
      if (!built(i) || !open(x, z)) {
        flush();
        continue;
      }
      if (!run.length || i % every === 0 || i + 2 >= n) run.push([x, z]);
    }
    flush();
  }
  return out;
}

// Which way out of each map square the built roads go (N, S, E, W), from
// the order the road's tiles run in. A step across a corner goes round it.
export function roadCellLinks(roads) {
  const out = new Map();
  const link = (a, b) => {
    const ax = a % 10000;
    const az = Math.floor(a / 10000);
    const bx = b % 10000;
    const bz = Math.floor(b / 10000);
    const d = bx > ax ? 'E' : bx < ax ? 'W' : bz > az ? 'S' : 'N';
    const back = { E: 'W', W: 'E', S: 'N', N: 'S' }[d];
    if (!out.has(a)) out.set(a, new Set());
    if (!out.has(b)) out.set(b, new Set());
    out.get(a).add(d);
    out.get(b).add(back);
  };
  for (const r of roads) {
    const n = r.tiles.length;
    const fa = r.fromA ?? r.built ?? 0;
    const fb = r.fromB || 0;
    const built = (i) => r.done || i < fa || i >= n - fb;
    let prev = null;
    for (let i = 0; i < n; i += 2) {
      if (!built(i)) {
        prev = null;
        continue;
      }
      const [x, , z] = r.tiles[i];
      const k = Math.floor(z / REGION_D) * 10000 + Math.floor(x / REGION_W);
      if (prev !== null && prev !== k) {
        const px = prev % 10000;
        const pz = Math.floor(prev / 10000);
        const cx = k % 10000;
        const cz = Math.floor(k / 10000);
        if (Math.abs(cx - px) + Math.abs(cz - pz) === 1) link(prev, k);
        else if (Math.abs(cx - px) <= 1 && Math.abs(cz - pz) <= 1) {
          const mid = pz * 10000 + cx;
          link(prev, mid);
          link(mid, k);
        }
      }
      if (prev === null && !out.has(k)) out.set(k, new Set());
      prev = k;
    }
  }
  return out;
}

export function reachedCells(s) {
  const out = new Set();
  for (let cz = s.cz; cz < s.cz + (s.cd || 1); cz++) for (let cx = s.cx; cx < s.cx + (s.cw || 1); cx++) out.add(cz * 10000 + cx);
  for (const k of s.reach || []) out.add(k);
  return out;
}
export function settlementIcons(game) {
  const ow = game.world.ow;
  const out = new Map();
  let reach = null;
  const taken = (cx, cz, s) => {
    const c = ow.cell(cx, cz);
    if (!c || !reach.has(cz * 10000 + cx)) return true;
    const o = out.get(cz * 10000 + cx);
    return (c.settlement !== null && c.settlement !== s.id) || (o && o.s !== s) || c.biome === 'ocean';
  };
  const list = [...ow.settlements].sort((a, b) => (ICON_SIZE[b.type] || [1, 1])[0] * (ICON_SIZE[b.type] || [1, 1])[1] - (ICON_SIZE[a.type] || [1, 1])[0] * (ICON_SIZE[a.type] || [1, 1])[1]);
  for (const s of list) {
    const [w, h] = ICON_SIZE[s.type] || [1, 1];
    reach = reachedCells(s);
    // Start from the squares it was founded on, then grow sideways and down
    // (or up and left if there's no room).
    let x0 = s.cx;
    let z0 = s.cz;
    let cw = Math.min(w, s.cw || 1);
    let ch = Math.min(h, s.cd || 1);
    while (cw < w) {
      if (!taken(x0 + cw, z0, s)) cw++;
      else if (!taken(x0 - 1, z0, s)) {
        x0--;
        cw++;
      } else break;
    }
    while (ch < h) {
      let down = true;
      let up = true;
      for (let i = 0; i < cw; i++) {
        if (taken(x0 + i, z0 + ch, s)) down = false;
        if (taken(x0 + i, z0 - 1, s)) up = false;
      }
      if (down) ch++;
      else if (up) {
        z0--;
        ch++;
      } else break;
    }
    const L = game.world.layouts && game.world.layouts.get(s.id);
    const walled = L ? L.walled : s.type === 'city' && !s.baseType;
    for (let dz = 0; dz < ch; dz++) {
      for (let dx = 0; dx < cw; dx++) {
        let glyph;
        let shade = 0.35;
        if (cw === 1 && ch === 1) glyph = s.type === 'village' ? ' ⌂' : s.type === 'town' ? '[]' : '▓▓';
        else if (ch === 1) {
          glyph = dx === 0 ? '[■' : '■]';
          shade = 0.5;
        } else {
          const [tl, tr, bl, br] = walled ? ['╔═', '═╗', '╚═', '═╝'] : ['┌─', '─┐', '└─', '─┘'];
          glyph = dz === 0 ? (dx === 0 ? tl : tr) : dx === 0 ? bl : br;
          shade = 0.6;
        }
        out.set((z0 + dz) * 10000 + x0 + dx, { s, glyph, shade });
      }
    }
  }
  return out;
}

// A colour part way (t, 0..1) from one to another.
function mixHex(a, b, t) {
  const p = parseInt(a.slice(1), 16);
  const q = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((p >> sh) & 255) * (1 - t) + ((q >> sh) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
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
    super(ui, 76, 36, { kind: 'help' });
    this.closeOnOutside = true;
  }
  draw(g) {
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'HOW TO PLAY' });
    const rows = [
      ['MOVE', 'WASD / Arrows (tile by tile) · SHIFT sprint'],
      ['CAMERA', 'Q / E turn the view a quarter turn either way'],
      ['BELT', '1-9 or mouse wheel to select'],
      ['INTERACT', 'Click doors, chests, benches, beds, signs, snares...'],
      ['', 'F: use what you point at / face · RMB also works'],
      ['MINE', 'Hold LMB on a block with a tool or empty hand'],
      ['PLACE', 'Select a block, then click (hold to paint)'],
      ['ROTATE', 'R cycles facing for chairs, beds, doors, roofs...'],
      ['LAYER', 'Z/X lock the mining/placing layer · V auto'],
      ['ATTACK', 'Click a creature or person (bows need arrows)'],
      ['TALK', 'Right-click a villager, pick topics with 1-9'],
      ['SIT', 'Click a chair, bench or stool · move to stand'],
      ['SLEEP', 'Click a bed at night (yours, or your host\'s)'],
      ['TOSS', 'G throws one item · CTRL+G the whole stack'],
      ['SET DOWN', 'B sets one down · CTRL+B the stack · mine it back up'],
      ['EAT', 'F (or RMB) while holding food'],
      ['FISH', 'Hold a fishing rod and right-click water'],
      ['RIDE', 'Feed a wild horse, saddle it, RMB to ride · F gets down'],
      ['LEAD', 'Hold a lead, RMB an animal · RMB a fence to tie it up'],
      ['STUDY', 'Researcher at a desk: A/D turn rings · W/S pick · SPACE'],
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
    tips.forEach((t, i) => g.text(3, 3 + rows.length + i, t, C.dim));
    g.text(3, this.h - 3, 'Every world is generated from its seed: biomes, rivers,', C.faint);
    g.text(3, this.h - 2, 'civilizations, towns and every villager\'s life story.', C.faint);
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
      ['O', 'Settings', () => this.ui.hooks.settings && this.ui.hooks.settings()],
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

// ---------------------------------------------------------------- waiting
export class WaitWindow extends Window {
  constructor(ui, game) {
    super(ui, 34, 9, { kind: 'wait' });
    this.game = game;
    this.hours = 1;
  }
  draw(g, game) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#100c18');
    g.box(0, 0, this.w, this.h, { bg: '#100c18', double: true, title: 'WAIT' });
    const m = Math.floor((game.minute + this.hours * 60) % 1440);
    g.center(2, 'Wait for how long?', C.fg);
    g.text(8, 4, '◄', C.hi);
    g.center(4, `${this.hours} hour${this.hours > 1 ? 's' : ''}`, C.white);
    g.text(this.w - 9, 4, '►', C.hi);
    g.center(5, `(until ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')})`, C.dim);
    this.hit(6, 4, 4, 1, () => this.change(-1));
    this.hit(this.w - 10, 4, 4, 1, () => this.change(1));
    const hov = this.hovering(9, 7, 16, 1);
    g.fill(9, 7, 16, 1, ' ', C.fg, hov ? C.bgHi : '#1a1622');
    g.center(7, '[ENTER] Wait', hov ? C.white : C.hi);
    this.hit(9, 7, 16, 1, () => this.go());
  }
  change(d) {
    this.hours = Math.max(1, Math.min(24, this.hours + d));
    this.ui.audio?.play('select');
  }
  go() {
    this.close();
    this.game.startWait(this.hours);
  }
  onKey(k) {
    if (k.code === 'Escape') this.close();
    else if (k.code === 'ArrowLeft' || k.code === 'KeyA') this.change(-1);
    else if (k.code === 'ArrowRight' || k.code === 'KeyD') this.change(1);
    else if (k.code === 'Enter' || k.code === 'Space') this.go();
    else {
      const d = /^Digit([1-9])$/.exec(k.code);
      if (d) this.hours = Number(d[1]);
    }
    return true;
  }
}

// ---------------------------------------------------------------- settings
export class SettingsWindow extends Window {
  constructor(ui, settings) {
    super(ui, 46, SETTING_ROWS.length * 2 + 6, { kind: 'settings' });
    this.s = settings;
    this.sel = 0;
  }
  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#100c18');
    g.box(0, 0, this.w, this.h, { bg: '#100c18', double: true, title: 'SETTINGS' });
    SETTING_ROWS.forEach((r, i) => {
      const y = 2 + i * 2;
      const hov = this.hovering(2, y, this.w - 4, 1);
      g.fill(2, y, this.w - 4, 1, ' ', C.fg, this.sel === i ? C.bgHi : hov ? '#3a3250' : undefined);
      g.text(3, y, r.label, this.sel === i ? C.white : C.fg);
      const v = this.s[r.key];
      g.text(24, y, '◄', C.hi);
      if (r.kind === 'bool') g.text(26, y, v ? 'On' : 'Off', v ? C.green : C.faint);
      else g.text(26, y, `${'■'.repeat(v)}${'□'.repeat(r.max - v)}`, C.cyan);
      g.text(this.w - 5, y, '►', C.hi);
      this.hit(24, y, 2, 1, () => this.change(i, -1));
      this.hit(this.w - 6, y, 3, 1, () => this.change(i, 1));
      this.hit(2, y, 21, 1, () => {
        this.sel = i;
      });
    });
    g.center(this.h - 2, '↑↓ choose · ←→ change · ESC close', C.faint);
  }
  change(i, d) {
    this.sel = i;
    changeSetting(this.s, SETTING_ROWS[i].key, d);
    this.ui.hooks.settingsChanged && this.ui.hooks.settingsChanged(this.s);
    this.ui.audio?.play('select');
  }
  onKey(k) {
    const n = SETTING_ROWS.length;
    if (k.code === 'Escape') this.close();
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.sel = (this.sel + n - 1) % n;
    else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.sel = (this.sel + 1) % n;
    else if (k.code === 'ArrowLeft' || k.code === 'KeyA') this.change(this.sel, -1);
    else if (k.code === 'ArrowRight' || k.code === 'KeyD' || k.code === 'Enter' || k.code === 'Space') this.change(this.sel, 1);
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
      ['O', 'Settings'],
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
    const ctx = this.ui.audio && this.ui.audio.ctx;
    if (!ctx || ctx.state !== 'running') g.center(this.h - 4, '♪ click anywhere for music and sound', C.dim);
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
    if (k === 'O' && h.settings) h.settings();
  }
  onKey(k) {
    const map = { KeyN: 'N', KeyC: 'C', KeyL: 'L', KeyS: 'S', KeyH: 'H', KeyO: 'O', Enter: this.hasSave ? 'C' : 'N', Space: this.hasSave ? 'C' : 'N' };
    if (this.ui.find('help') || this.ui.find('saves') || this.ui.find('create') || this.ui.find('settings')) return false;
    if (map[k.code]) this.choose(map[k.code]);
    return true;
  }
}

export { slotTable };

// ---------------------------------------------------------------- the press
// At a scribe's desk: pick the stories for an edition, then print it.
export class PrintWindow extends Window {
  constructor(ui, game, L) {
    super(ui, 70, 24, { kind: 'print' });
    this.game = game;
    this.L = L;
    this.stories = game.sim.press.stories(L);
    this.picked = new Set(this.stories.slice(0, Math.min(3, this.stories.length)).map((_, i) => i));
    this.sel = 0;
    this.copies = 4;
  }
  draw(g, game) {
    const press = game.sim.press;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#14100c');
    g.box(0, 0, this.w, this.h, { bg: '#14100c', double: true, title: 'PRINT A NEWSPAPER' });
    g.center(1, press.mastheadFor(this.L.settlement).toUpperCase(), '#f0e0c0');
    g.center(2, `Day ${game.day} · pick up to ${4} stories you've recorded`, C.dim);
    if (!this.stories.length) g.center(6, 'Nothing on record yet: nothing has happened here lately.', C.faint);
    this.stories.slice(0, 12).forEach((st, i) => {
      const y = 4 + i;
      const on = this.picked.has(i);
      const hov = this.hovering(2, y, this.w - 4, 1);
      g.fill(2, y, this.w - 4, 1, ' ', C.fg, i === this.sel ? C.bgHi : hov ? '#3a3250' : undefined);
      g.text(3, y, on ? '[x]' : '[ ]', on ? C.green : C.faint);
      const tag = st.afar ? `(${st.from}) ` : '';
      g.text(7, y, `${tag}${st.text}`.slice(0, this.w - 10), on ? C.white : C.fg);
      this.hit(2, y, this.w - 4, 1, () => {
        this.sel = i;
        this.toggle(i);
      });
    });
    const inv = game.player.inv;
    const runs = Math.ceil(this.copies / 4);
    const y2 = this.h - 5;
    g.text(3, y2, `Copies: ◄ ${this.copies} ►   needs ${runs} paper and ${runs} ink (you have ${countItem(inv, 'paper')} and ${countItem(inv, 'ink')})`, press.canPrint(this.copies) ? C.fg : C.orange);
    const ok = this.picked.size && press.canPrint(this.copies);
    const hov = this.hovering(3, y2 + 2, 22, 1);
    g.fill(3, y2 + 2, 22, 1, ' ', C.fg, ok ? (hov ? C.bgHi : '#2a2230') : '#1a1418');
    g.text(4, y2 + 2, '[ENTER] Print edition', ok ? C.hi : C.faint);
    this.hit(3, y2 + 2, 22, 1, () => this.print());
    g.text(this.w - 36, this.h - 1, ' ↑↓ story · SPACE pick · ←→ copies ', C.faint);
  }
  toggle(i) {
    if (this.picked.has(i)) this.picked.delete(i);
    else if (this.picked.size < 4) this.picked.add(i);
    this.ui.audio?.play('select');
  }
  print() {
    const picks = [...this.picked].sort((a, b) => a - b).map((i) => this.stories[i]);
    const ed = this.game.sim.press.print(this.L, picks, this.copies);
    if (!ed) {
      this.ui.audio?.play('error');
      return;
    }
    this.ui.msg(`Printed ${this.copies} copies of ${ed.title}. Hand them out to people!`, C.green);
    this.ui.audio?.play('craft');
    this.close();
  }
  onKey(k) {
    const n = Math.min(12, this.stories.length);
    if (k.code === 'Escape') this.close();
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.sel = (this.sel + n - 1) % Math.max(1, n);
    else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.sel = (this.sel + 1) % Math.max(1, n);
    else if (k.code === 'Space') this.toggle(this.sel);
    else if (k.code === 'ArrowLeft' || k.code === 'KeyA') this.copies = Math.max(4, this.copies - 4);
    else if (k.code === 'ArrowRight' || k.code === 'KeyD') this.copies = Math.min(16, this.copies + 4);
    else if (k.code === 'Enter') this.print();
    return true;
  }
}

// Reading the latest edition.
// How much a line of a town's news matters: everyday comings and goings
// (merchants in and out, the treasury, the taxes, who's moved house) are
// shown fainter than raids, wars, crimes, deaths and the like.
const MINOR_NEWS = /arrived in town|set out for|came back from|merchant|in its coffers|taxes stand|stand at \d+%|wages|moved into|is coming from|set the scholars|is selling|bought|sold|has gone to start again|by order of|delivered|letter/i;
const MAJOR_NEWS = /war|raid|battle|killed|murder|died|fire|famine|exiled|bandit|statue|crowned|rules|sacked|plague|holy|pilgrim|revolt|riot|founded|settlers|siege|surrender/i;
export function newsWeight(text) {
  if (MAJOR_NEWS.test(text)) return 2;
  return MINOR_NEWS.test(text) ? 0 : 1;
}

// ---------------------------------------------------------------- console
// Typed commands (see commands.js): teleporting, revealing the map,
// making things happen. What it said, and what you typed, stay for next time.
export class ConsoleWindow extends Window {
  constructor(ui) {
    super(ui, 76, 17, { kind: 'console', y: ROWS - 18 });
    ui.consoleLog ||= ['Type a command and press [ENTER]. "help" lists them.'];
    ui.consoleHistory ||= [];
    this.text = '';
    this.back = -1;
    this.scroll = 0;
  }
  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, 'rgba(8,10,14,0.95)');
    g.box(0, 0, this.w, this.h, { bg: 'rgba(8,10,14,0.95)', double: true, title: 'COMMANDS' });
    const lines = [];
    for (const l of this.ui.consoleLog) for (const w of wrap(l.text ?? l, this.w - 4)) lines.push({ t: w, c: l.c || (String(l).startsWith('> ') ? C.hi : '#b8e0c0') });
    const room = this.h - 4;
    this.maxScroll = Math.max(0, lines.length - room);
    this.scroll = Math.max(0, Math.min(this.scroll, this.maxScroll));
    const end = lines.length - this.scroll;
    lines.slice(Math.max(0, end - room), end).forEach((l, i) => g.text(2, 1 + i, l.t, l.c));
    const blink = Math.floor(this.ui.time * 2) % 2 ? '█' : ' ';
    const shown = `> ${this.text}`.slice(-(this.w - 5));
    g.fill(1, this.h - 2, this.w - 2, 1, ' ', C.fg, '#141a22');
    g.text(2, this.h - 2, shown + blink, C.white, '#141a22');
    const foot = ' [TAB] complete  [↑↓] history  [ESC] close ';
    g.text(this.w - foot.length - 2, this.h - 1, foot, C.faint);
  }
  run() {
    const t = this.text.trim();
    this.text = '';
    this.back = -1;
    this.scroll = 0;
    if (!t) return;
    const H = this.ui.consoleHistory;
    if (H[H.length - 1] !== t) H.push(t);
    if (H.length > 40) H.shift();
    const log = this.ui.consoleLog;
    log.push(`> ${t}`);
    let out;
    try {
      out = runCommand(this.ui.game, t);
    } catch (err) {
      out = [{ text: `That went wrong: ${err.message}`, c: C.orange }];
    }
    log.push(...out);
    while (log.length > 200) log.shift();
    this.ui.audio?.play('select');
    // Off to somewhere else: out of the way, to see it.
    if (/^\/?tp\b/i.test(t) && out.some((l) => /^Teleported/.test(l))) this.close();
    if (/^\/?(skip|ff)\b/i.test(t) && out.some((l) => /^Fast-forwarding/.test(l))) this.close();
  }
  onWheel(d) {
    this.scroll = Math.max(0, Math.min(this.maxScroll || 0, this.scroll - Math.sign(d) * 3));
  }
  onKey(k) {
    const H = this.ui.consoleHistory;
    if (k.code === 'Escape' || (k.code === 'Backquote' && !this.text)) this.close();
    else if (k.code === 'Enter' || k.code === 'NumpadEnter') this.run();
    else if (k.code === 'Backspace') this.text = this.text.slice(0, -1);
    else if (k.code === 'Tab') {
      const c = complete(this.text);
      if (c) this.text = c;
    } else if (k.code === 'ArrowUp' && H.length) {
      this.back = this.back < 0 ? H.length - 1 : Math.max(0, this.back - 1);
      this.text = H[this.back];
    } else if (k.code === 'ArrowDown' && this.back >= 0) {
      this.back++;
      if (this.back >= H.length) {
        this.back = -1;
        this.text = '';
      } else this.text = H[this.back];
    } else if (k.code === 'PageUp') this.onWheel(-1);
    else if (k.code === 'PageDown') this.onWheel(1);
    else if (k.key && k.key.length === 1 && !k.ctrl && this.text.length < 120) this.text += k.key;
    return true;
  }
}

export class NewsWindow extends Window {
  constructor(ui, game) {
    super(ui, 60, 22, { kind: 'news' });
    this.closeOnOutside = true;
    this.ed = game.sim.press.latest();
  }
  draw(g, game) {
    const ed = this.ed;
    g.fill(0, 0, this.w, this.h, ' ', '#2a2620', '#ece6d4');
    g.box(0, 0, this.w, this.h, { bg: '#ece6d4', fg: '#2a2620', double: true });
    if (!ed) {
      g.center(8, 'The pages are blank.', '#5a5448');
      return;
    }
    g.center(1, ed.title.toUpperCase(), '#1a1612');
    g.center(2, '═'.repeat(this.w - 6), '#5a5448');
    g.center(3, `Edition ${ed.id} · Day ${ed.day} · printed by ${ed.by}`, '#5a5448');
    let y = 5;
    for (const h of ed.headlines) {
      const lines = wrap(`${h.afar ? `FROM ${h.from.toUpperCase()}: ` : ''}${h.text}`, this.w - 8);
      lines.forEach((l, i) => g.text(4, y + i, l, i === 0 ? '#1a1612' : '#3a342c'));
      y += lines.length + 1;
      if (y > this.h - 3) break;
    }
    if (game.day - ed.day > 2) g.center(this.h - 2, '(yesterday\'s news by now)', '#8a8478');
  }
  onKey(k) {
    if (k.code === 'Escape' || k.code === 'KeyF' || k.code === 'Enter') this.close();
    return true;
  }
}

// ---------------------------------------------------------------- setting gems
// At a jeweller's bench: choose a piece and a stone, then set it. The needle
// runs round the setting; press SPACE as it passes each prong to press it
// down over the stone. Three slips and the stone cracks.
const RING = 24;
const PRONGS = [3, 9, 15, 21];
export class SettingWindow extends Window {
  constructor(ui, game) {
    super(ui, 52, 22, { kind: 'setting' });
    this.game = game;
    this.phase = 'choose';
    this.piece = 0;
    this.gem = 0;
  }
  pieces() {
    const p = this.game.player;
    const out = [];
    p.inv.forEach((s, i) => {
      if (s && canSocket(s.item)) out.push({ ref: { kind: 'inv', i }, key: s.item });
    });
    for (const slot of WEAR_SLOTS) if (p.equip[slot] && canSocket(p.equip[slot])) out.push({ ref: { kind: 'equip', slot }, key: p.equip[slot] });
    return out;
  }
  gems() {
    const inv = this.game.player.inv;
    return Object.keys(GEMS).filter((k) => countItem(inv, k) > 0);
  }
  draw(g, game) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#100c18');
    g.box(0, 0, this.w, this.h, { bg: '#100c18', double: true, title: 'SET A GEM' });
    if (this.phase === 'choose') return this.drawChoose(g);
    this.drawRing(g);
  }
  drawChoose(g) {
    const pieces = this.pieces();
    const gems = this.gems();
    if (!pieces.length || !gems.length) {
      g.center(6, !pieces.length ? 'You have nothing to set a stone in.' : 'You have no cut stones.', C.dim);
      g.center(8, !gems.length ? 'Cut a rough gem at this bench first.' : 'Weapons and armour can take a gem.', C.faint);
      return;
    }
    this.piece = Math.min(this.piece, pieces.length - 1);
    this.gem = Math.min(this.gem, gems.length - 1);
    const pc = pieces[this.piece];
    const gk = gems[this.gem];
    g.text(3, 2, 'Piece (↑↓):', C.dim);
    g.text(16, 2, `${ITEMS[pc.key].name}${pc.ref.kind === 'equip' ? ' (worn)' : ''}`, C.white);
    g.text(3, 4, 'Stone (←→):', C.dim);
    g.text(16, 4, `${GEMS[gk].name} ×${countItem(this.game.player.inv, gk)}`, GEMS[gk].color);
    const res = ITEMS[socketed(pc.key, gk)];
    // What this stone does in this piece (a blade, a bow or armour).
    const said = res ? wrap(gemText(socketed(pc.key, gk)).replace(/^Set with an? \w+: /, ''), this.w - 6) : [GEMS[gk].about];
    said.slice(0, 2).forEach((l, i) => g.text(3, 6 + i, l, C.fg));
    if (res) g.text(3, 8, `Makes: ${res.name}`, C.green);
    g.text(3, 10, 'Press SPACE as the needle passes each prong.', C.faint);
    g.text(3, 11, 'Three slips and the stone cracks.', C.faint);
    const hov = this.hovering(3, 14, 22, 1);
    g.fill(3, 14, 22, 1, ' ', C.fg, hov ? C.bgHi : '#2a2230');
    g.text(4, 14, '[ENTER] Begin setting', C.hi);
    this.hit(3, 14, 22, 1, () => this.begin());
  }
  // (The bench itself is drawn in pixels: see drawPixels.)
  drawRing(g) {
    const cy = 9;
    g.center(1, `${ITEMS[this.set.piece.key].name} · ${GEMS[this.set.gem].name}`, C.dim);
    g.center(cy + 9, this.phase === 'done' ? 'Set! The stone sits true.' : this.phase === 'fail' ? 'Crack! The stone splits.' : `Slips: ${'×'.repeat(this.slips)}${'·'.repeat(3 - this.slips)}`, this.phase === 'fail' ? C.red : this.phase === 'done' ? C.green : C.fg);
    g.center(cy + 11, this.phase === 'set' ? 'SPACE as the gleam crosses a claw' : '[ENTER] close', C.faint);
  }
  // Under the loupe: the stone in its gold collet, four claws standing up
  // round it, and a gleam of light running round the rim. Press as it
  // crosses a claw and the pusher bends it down over the stone; miss, and
  // a crack runs through the stone.
  drawPixels(ctx) {
    if (this.phase === 'choose' || !this.set) return;
    const W = this.w * CHAR_W;
    const ox = this.x * CHAR_W;
    const oy = this.y * CHAR_H;
    const cx = ox + Math.floor(W / 2);
    const cy = oy + 9 * CHAR_H + 2;
    const t = this.t || 0;
    const px = (x, y, c, w = 1, h = 1) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const gem = GEMS[this.set.gem];
    const col = gem.color;
    const shade = (hex, f) => {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
      const gg = Math.min(255, Math.round(((n >> 8) & 255) * f));
      const b = Math.min(255, Math.round((n & 255) * f));
      return `rgb(${r},${gg},${b})`;
    };
    // The loupe: a round pool of light on dark velvet, a brass rim.
    const R = 54;
    for (let y = -R; y <= R; y++) {
      const half = Math.floor(Math.sqrt(R * R - y * y));
      const d = Math.abs(y) / R;
      ctx.fillStyle = `rgb(${Math.round(40 - d * 18)},${Math.round(30 - d * 14)},${Math.round(48 - d * 20)})`;
      ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
    }
    for (let a = 0; a < Math.PI * 2; a += 0.012) {
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      px(x, y, a > Math.PI ? '#c8a050' : '#8a6a30', 2, 2);
    }
    // Gold collet round the stone.
    const ring = 24;
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const lit = Math.cos(a + 2.2) * 0.5 + 0.5;
      for (let r = ring - 3; r <= ring; r++) px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, shade('#d8a838', 0.6 + lit * 0.7));
    }
    // The stone: a faceted octagon, lighter to the top left.
    const crackT = this.phase === 'fail' ? Math.min(1, (t - (this.failAt || 0)) * 2) : 0;
    if (crackT < 1) {
      const S = 17;
      for (let y = -S; y <= S; y++) {
        for (let x = -S; x <= S; x++) {
          if (Math.abs(x) + Math.abs(y) > S * 1.45 || Math.abs(x) > S || Math.abs(y) > S) continue;
          const facet = (x < 0 ? 0 : 1) + (y < 0 ? 0 : 2) + (Math.abs(x) + Math.abs(y) < S * 0.55 ? 4 : 0);
          const f = [1.35, 1.05, 0.9, 0.65, 1.55, 1.2, 1.1, 0.85][facet];
          px(cx + x, cy + y, shade(col, f));
        }
      }
      // Glints turning slowly on the facets.
      for (let i = 0; i < 3; i++) {
        const a = t * 0.8 + i * 2.1;
        const gx = cx + Math.cos(a) * 8 - 3;
        const gy = cy + Math.sin(a) * 6 - 4;
        const k = 0.5 + 0.5 * Math.sin(t * 3 + i);
        ctx.globalAlpha = 0.5 + 0.5 * k;
        px(gx, gy, '#ffffff');
        px(gx - 1, gy, '#ffffff', 1, 1);
        px(gx + 1, gy, '#ffffff', 1, 1);
        px(gx, gy - 1, '#ffffff', 1, 1);
        px(gx, gy + 1, '#ffffff', 1, 1);
        ctx.globalAlpha = 1;
      }
      // Cracks from each slip.
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      (this.cracks || []).forEach((c) => {
        let x = cx + c.x0;
        let y = cy + c.y0;
        for (let k = 0; k < c.len; k++) {
          x += c.dx + (Math.sin(k * 1.7 + c.x0) > 0.6 ? 1 : 0);
          y += c.dy;
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      });
    }
    // Claws, standing up (pale), or bent down over the stone (bright).
    const at = (i, r) => {
      const a = (i / RING) * Math.PI * 2 - Math.PI / 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, a];
    };
    PRONGS.forEach((q, k) => {
      const near = this.phase === 'set' && !this.pressed[k] && Math.min(Math.abs(this.pos - q), RING - Math.abs(this.pos - q)) <= 0.9;
      const bend = this.pressed[k] ? Math.min(1, (t - (this.pressAt?.[k] ?? -9)) * 6) : 0;
      const [ax, ay, a] = at(q, ring - 2);
      const len = 9;
      // Out from the rim when standing; folded in over the stone's edge.
      const dir = 1 - bend * 2;
      for (let s2 = 0; s2 < len; s2++) {
        const r = s2 * dir;
        const w = s2 < 3 ? 3 : 2;
        px(ax + Math.cos(a) * r - 1, ay + Math.sin(a) * r - 1, near ? '#fff4b0' : bend ? '#f0c848' : '#b89040', w, w);
      }
      if (near) {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 20);
        px(ax - 4, ay - 4, '#fff0a0', 8, 8);
        ctx.globalAlpha = 1;
      }
    });
    // The gleam running round the rim, with its tail.
    if (this.phase === 'set') {
      for (let k = 0; k < 10; k++) {
        const [gx, gy] = at(this.pos - k * 0.12, ring + 4);
        ctx.globalAlpha = (1 - k / 10) * 0.9;
        px(gx - 1, gy - 1, k === 0 ? '#ffffff' : '#ffe890', k === 0 ? 3 : 2, k === 0 ? 3 : 2);
      }
      ctx.globalAlpha = 1;
      // The pusher, following the gleam from outside, thrusting on a press.
      const thrust = Math.max(0, (this.pushT || 0) / 0.15);
      const [tx, ty, ta] = at(this.pos, ring + 20 - thrust * 8);
      for (let s2 = 0; s2 < 14; s2++) px(tx + Math.cos(ta) * s2 - 1, ty + Math.sin(ta) * s2 - 1, s2 < 3 ? '#d8d8e0' : '#6a4a2a', 2, 2);
    }
    // Sparks from each claw pressed home, and the stone's pieces if it split.
    for (const f of this.fx || []) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      px(cx + f.x, cy + f.y, f.c, f.s || 1, f.s || 1);
    }
    ctx.globalAlpha = 1;
    // Done: the stone glows in its setting.
    if (this.phase === 'done') {
      const k = 0.4 + 0.3 * Math.sin(t * 4);
      ctx.globalAlpha = k * 0.5;
      for (let r = 18; r < 30; r += 2) {
        for (let a = 0; a < Math.PI * 2; a += 0.08) px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, col);
      }
      ctx.globalAlpha = 1;
    }
  }
  burst(x, y, colors, n = 10, speed = 40) {
    this.fx ||= [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: 0.5 + Math.random() * 0.4, max: 0.9, c: colors[i % colors.length], s: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  begin() {
    const pieces = this.pieces();
    const gems = this.gems();
    if (!pieces.length || !gems.length) return;
    this.set = { piece: pieces[this.piece], gem: gems[this.gem] };
    this.phase = 'set';
    this.pos = 0;
    this.speed = 7;
    this.slips = 0;
    this.pressed = PRONGS.map(() => false);
    this.ui.audio?.play('select');
  }
  update(dt) {
    this.t = (this.t || 0) + dt;
    if (this.pushT > 0) this.pushT -= dt;
    for (const f of this.fx || []) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 60 * dt;
    }
    if (this.fx) this.fx = this.fx.filter((f) => f.life > 0);
    if (this.phase !== 'set') return;
    this.pos = (this.pos + dt * this.speed) % RING;
  }
  press() {
    // The nearest unpressed prong within reach of the needle.
    let best = -1;
    let bd = 99;
    PRONGS.forEach((q, k) => {
      if (this.pressed[k]) return;
      const d = Math.min(Math.abs(this.pos - q), RING - Math.abs(this.pos - q));
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    this.pushT = 0.15;
    const claw = (k) => {
      const a = (PRONGS[k] / RING) * Math.PI * 2 - Math.PI / 2;
      return [Math.cos(a) * 22, Math.sin(a) * 22];
    };
    if (best >= 0 && bd <= 0.9) {
      this.pressed[best] = true;
      (this.pressAt ||= [])[best] = this.t || 0;
      this.speed += 2.5;
      this.ui.audio?.play('clang');
      const [x, y] = claw(best);
      this.burst(x, y, ['#fff4b0', '#ffd040', '#ffffff'], 12, 45);
      if (this.pressed.every(Boolean)) {
        this.phase = 'done';
        this.endAt = this.t || 0;
        this.burst(0, 0, [GEMS[this.set.gem].color, '#ffffff', '#fff4b0'], 30, 70);
        this.game.setGem(this.set.piece.ref, this.set.gem);
      }
      return;
    }
    this.slips++;
    this.ui.audio?.play('error');
    // A crack runs through the stone.
    (this.cracks ||= []).push({ x0: Math.round(Math.random() * 10 - 5), y0: -12 + Math.round(Math.random() * 6), dx: Math.random() < 0.5 ? 0.5 : -0.5, dy: 1, len: 14 + Math.round(Math.random() * 8) });
    this.burst(0, 0, ['#ffffff', '#c8c8d0'], 5, 25);
    if (this.slips >= 3) {
      this.phase = 'fail';
      this.failAt = this.t || 0;
      this.endAt = this.failAt;
      this.burst(0, 0, [GEMS[this.set.gem].color, '#ffffff', GEMS[this.set.gem].color], 40, 80);
      removeItem(this.game.player.inv, this.set.gem, 1);
      this.ui.msg(`The ${GEMS[this.set.gem].name.toLowerCase()} cracked in the setting.`, C.red);
    }
  }
  onKey(k) {
    if (k.code === 'Escape') this.close();
    else if (this.phase === 'choose') {
      const n = this.pieces().length;
      const m = this.gems().length;
      if (k.code === 'ArrowUp' || k.code === 'KeyW') this.piece = (this.piece + Math.max(1, n) - 1) % Math.max(1, n);
      else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.piece = (this.piece + 1) % Math.max(1, n);
      else if (k.code === 'ArrowLeft' || k.code === 'KeyA') this.gem = (this.gem + Math.max(1, m) - 1) % Math.max(1, m);
      else if (k.code === 'ArrowRight' || k.code === 'KeyD') this.gem = (this.gem + 1) % Math.max(1, m);
      else if (k.code === 'Enter') this.begin();
    } else if (this.phase === 'set') {
      if (k.code === 'Space') this.press();
    } else if ((k.code === 'Enter' || k.code === 'Space') && (this.t || 0) - (this.endAt || 0) > 0.6) this.close();
    return true;
  }
}
