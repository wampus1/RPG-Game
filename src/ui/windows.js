// All UI windows. Each draws itself into a character grid every frame.
import { COLS, ROWS, MAP_W, MAP_H, REGION_W, REGION_D, BELT_SIZE, CHAR_W, CHAR_H, INV_SIZE } from '../config.js';
import { Window, cap, describeActivity } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS, maxStack } from '../world/items.js';
import { recipesFor, STATIONS } from '../world/recipes.js';
import { addItem, removeItem, countItem } from '../game/inventory.js';
import { BIOMES } from '../world/biomes.js';
import { JOBS, HOBBIES } from '../entities/npcgen.js';
import { conversation } from '../game/dialogue.js';
import { humanoidSheet } from '../render/sprites.js';

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
    super(ui, 63, 20, { kind: 'inventory' });
  }
  draw(g, game) {
    const p = game.player;
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'INVENTORY' });
    g.text(2, 1, 'Belt (1-9)', C.dim);
    slotTable(this, g, 1, 2, 9, p.inv, 0, BELT_SIZE, { selected: p.selected, quick: () => p.inv.slice(BELT_SIZE), onClick: (i, ck) => this.click(p, i, ck) });
    g.text(2, 6, 'Backpack', C.dim);
    slotTable(this, g, 1, 7, 9, p.inv, BELT_SIZE, INV_SIZE - BELT_SIZE, { onClick: (i, ck) => this.click(p, i, ck) });
    // Stats panel.
    const x = 40;
    g.box(x - 1, 1, 23, 17, { fg: C.faint });
    g.text(x + 1, 2, 'ADVENTURER', C.hi);
    g.text(x + 1, 4, `HP     ${Math.ceil(p.hp)}/${p.maxHp}`, C.red);
    g.text(x + 1, 5, `Coins  ¤${countItem(p.inv, 'coin')}`, C.hi);
    g.text(x + 1, 6, `Day    ${game.day}`, C.fg);
    g.text(x + 1, 7, `Mined  ${game.stats.mined}`, C.dim);
    g.text(x + 1, 8, `Placed ${game.stats.placed}`, C.dim);
    g.text(x + 1, 9, `Kills  ${game.stats.kills}`, C.dim);
    const held = p.heldDef();
    g.text(x + 1, 11, 'Holding:', C.dim);
    g.text(x + 1, 12, held ? held.name.slice(0, 20) : '(empty hand)', C.fg);
    g.text(x + 1, 14, 'SHIFT+click: move', C.faint);
    g.text(x + 1, 15, 'RMB: split/place 1', C.faint);
    g.text(x + 1, 16, 'C: crafting', C.faint);
    g.text(2, 19, ' Drag outside to drop ', C.faint);
  }
  click(p, i, ck) {
    const other = i < BELT_SIZE ? [...Array(INV_SIZE - BELT_SIZE).keys()].map((k) => k + BELT_SIZE) : [...Array(BELT_SIZE).keys()];
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
  constructor(ui, npc) {
    super(ui, 72, 13, { kind: 'dialogue', y: ROWS - 18 });
    this.npc = npc;
    this.lines = null;
    this.i = 0;
    this.chars = 0;
  }
  draw(g, game) {
    const n = this.npc;
    if (!this.lines) this.lines = conversation(n, game);
    const rec = n.rec;
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true });
    g.box(1, 1, 5, 5, { fg: C.faint });
    this.portraitPos = { x: (this.x + 2) * CHAR_W + 1, y: (this.y + 2) * CHAR_H - 4 };
    g.text(7, 1, n.name, C.hi);
    const title = `${n.title}${rec.age === 'child' ? ' · child' : rec.age === 'elder' ? ' · elder' : ''} of ${n.settlement.name}`;
    g.text(7, 2, title.slice(0, 60), C.cyan);
    g.text(7, 3, rec.traits.join(', ').slice(0, 60), C.purple);
    const hobbies = rec.hobbies.map((h) => HOBBIES[h]?.label || h).join(', ');
    g.text(7, 4, `Likes: ${hobbies}`.slice(0, 62), C.dim);
    if (n.activity) g.text(7, 5, `Now: ${describeActivity(n.activity.entry)}`, C.faint);
    const line = this.lines[this.i] || '...';
    const shown = line.slice(0, Math.floor(this.chars));
    const wl = wrap(shown, this.w - 6);
    wl.slice(0, 3).forEach((l, k) => g.text(3, 7 + k, (k === 0 ? '"' : ' ') + l + (k === wl.length - 1 && this.chars >= line.length ? '"' : ''), C.white));
    const trader = JOBS[rec.job]?.trader && !game.isWanted(n.settlement.id);
    const opts = [['SPACE', this.i < this.lines.length - 1 ? 'Next' : 'Again'], ...(trader ? [['T', 'Trade']] : []), ['ESC', 'Farewell']];
    let x = 3;
    for (const [k, label] of opts) {
      const t = `[${k}] ${label}`;
      const hov = this.hovering(x, this.h - 2, t.length, 1);
      g.text(x, this.h - 2, t, hov ? C.hi : C.fg);
      this.hit(x, this.h - 2, t.length, 1, (ck, gm) => this.act(k, gm));
      x += t.length + 3;
    }
    g.text(this.w - 8, this.h - 1, ` ${this.i + 1}/${this.lines.length} `, C.faint);
  }
  drawPixels(ctx) {
    const sheet = humanoidSheet(this.npc.look);
    ctx.drawImage(sheet, 0, 0, 16, 24, this.portraitPos.x, this.portraitPos.y, 16, 24);
  }
  update(dt, game) {
    this.chars += dt * 60;
    if (this.npc.dead || this.npc.distTo(game.player) > 6 || this.npc.state === 'flee' || this.npc.state === 'fight') this.close();
  }
  act(k, game) {
    if (k === 'SPACE') {
      const line = this.lines[this.i] || '';
      if (this.chars < line.length) this.chars = line.length;
      else {
        this.i = (this.i + 1) % this.lines.length;
        this.chars = 0;
      }
    } else if (k === 'T') this.ui.openTrade(this.npc);
    else if (k === 'ESC') this.close();
  }
  onKey(k, game) {
    if (k.code === 'Space' || k.code === 'Enter' || k.code === 'KeyE') this.act('SPACE', game);
    else if (k.code === 'KeyT' && JOBS[this.npc.rec.job]?.trader) this.act('T', game);
    else return false;
    return true;
  }
}

// ---------------------------------------------------------------- trading
const STOCK = {
  general: ['torch', 'bread', 'apple', 'planks', 'cloth', 'string', 'fishing_rod', 'lantern', 'glass', 'chest', 'bed', 'seeds'],
  smith: ['iron_ingot', 'coal', 'stone_pickaxe', 'stone_axe', 'stone_sword', 'iron_sword', 'iron_pickaxe', 'iron_axe', 'spear', 'hammer', 'anvil', 'lantern'],
  baker: ['bread', 'pie', 'wheat', 'apple', 'berries'],
  inn: ['stew', 'cooked_meat', 'bread', 'apple', 'cooked_fish', 'dice'],
  tailor: ['cloth', 'string', 'leather', 'rug_red', 'rug_blue', 'rug_green', 'bed'],
  carpenter: ['planks', 'planks_dark', 'chest', 'door', 'table', 'chair', 'bench', 'bookshelf', 'fence', 'workbench', 'barrel', 'crate'],
  herbalist: ['herb', 'mushroom', 'berries', 'seeds', 'sapling', 'flower_red', 'flower_blue'],
  fisher: ['fish', 'cooked_fish', 'fishing_rod', 'reeds', 'string'],
  farmer: ['wheat', 'carrot', 'cabbage', 'seeds', 'hay_bale', 'pumpkin', 'apple'],
  scholar: ['book', 'scroll', 'sketchbook', 'bookshelf', 'lantern'],
};

export class TradeWindow extends Window {
  constructor(ui, npc) {
    super(ui, 76, 24, { kind: 'trade' });
    this.npc = npc;
    const t = JOBS[npc.rec.job]?.trader || 'general';
    this.stock = (STOCK[t] || STOCK.general).filter((k) => ITEMS[k]);
    const cond = npc.settlement.condition;
    this.markup = (cond === 'prosperous' ? 1.6 : cond === 'poor' ? 1.25 : 1.4) * (npc.rec.personality.kindness > 0.7 ? 0.9 : npc.rec.personality.kindness < 0.3 ? 1.2 : 1);
  }
  price(k) {
    return Math.max(1, Math.round(ITEMS[k].value * this.markup));
  }
  sellPrice(k) {
    return Math.max(k === 'coin' ? 0 : 1, Math.floor(ITEMS[k].value * 0.5));
  }
  draw(g, game) {
    const p = game.player;
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: `TRADE · ${this.npc.name.toUpperCase()}` });
    const coins = countItem(p.inv, 'coin');
    g.text(2, 1, 'BUY', C.hi);
    g.text(24, 1, `Your coins: ¤${coins}`, C.hi);
    this.stock.forEach((k, i) => {
      const y = 2 + i * 2;
      if (y + 1 >= this.h - 1) return;
      const pr = this.price(k);
      const can = coins >= pr;
      const hov = this.hovering(1, y, 34, 2);
      g.fill(1, y, 34, 2, ' ', C.fg, hov ? 'rgba(60,70,40,0.95)' : i % 2 ? 'rgba(22,18,28,0.9)' : undefined);
      g.icon(2, y, k, 1);
      g.text(6, y, ITEMS[k].name.slice(0, 20), can ? C.fg : C.dim);
      g.text(28, y, `¤${pr}`, can ? C.hi : C.red);
      if (hov) this.ui.itemTooltip({ item: k, count: 1 });
      this.hit(1, y, 34, 2, (ck, gm) => this.buy(k, gm, ck.shift ? 5 : 1));
    });
    g.text(38, 1, 'SELL (click your items)', C.hi);
    slotTable(this, g, 37, 2, 9, p.inv, 0, INV_SIZE, {
      onClick: (i, ck, gm) => this.sell(i, gm, ck.shift),
    });
    const hs = p.inv.findIndex((s, i) => s && this.hovering(38 + (i % 9) * 4, 3 + Math.floor(i / 9) * 3, 3, 2));
    if (hs >= 0 && p.inv[hs].item !== 'coin') g.text(38, 16, `Sells for ¤${this.sellPrice(p.inv[hs].item)} each`, C.green);
    g.text(2, this.h - 1, ' click buy/sell · SHIFT x5 / whole stack ', C.faint);
  }
  buy(k, game, n) {
    const p = game.player;
    let bought = 0;
    for (let i = 0; i < n; i++) {
      const pr = this.price(k);
      if (countItem(p.inv, 'coin') < pr) break;
      removeItem(p.inv, 'coin', pr);
      const left = p.give(k, 1);
      if (left) game.spawnDrop(k, left, p.x, p.y, p.z, true);
      bought++;
    }
    if (bought) {
      game.audio?.play('coin');
      this.npc.say(this.npc.rng.pick(['Pleasure doing business!', 'Thank you kindly.', 'Enjoy!', 'Come again!']), 2);
    } else game.audio?.play('error');
  }
  sell(i, game, all) {
    const p = game.player;
    const s = p.inv[i];
    if (!s || s.item === 'coin') return;
    const n = all ? s.count : 1;
    const pr = this.sellPrice(s.item) * n;
    s.count -= n;
    if (s.count <= 0) p.inv[i] = null;
    const left = p.give('coin', pr);
    if (left) game.spawnDrop('coin', left, p.x, p.y, p.z, true);
    game.audio?.play('coin');
  }
  update(dt, game) {
    if (this.npc.dead || this.npc.distTo(game.player) > 6) this.close();
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
          if (s.condition === 'abandoned') g.text(x, y, ' †', '#a0a0a0', '#302830');
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
    g.text(2, y0 + 2, '⌂ village  [■] town  ╔╗ city  ~ river  † ruins  @ you', C.faint);
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
    const sub = `${cap(s.condition === 'abandoned' ? 'abandoned ' + s.type : s.type)}${s.civ ? ' · ' + s.civ.name : ''}`;
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
    super(ui, 70, 31, { kind: 'help' });
    this.closeOnOutside = true;
  }
  draw(g) {
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'HOW TO PLAY' });
    const rows = [
      ['MOVE', 'WASD / Arrows (tile by tile) · SHIFT sprint'],
      ['BELT', '1-9 or mouse wheel to select'],
      ['INTERACT', 'Click doors, chests, workbenches, torches, beds...'],
      ['', 'E: use what you point at / face · RMB also works'],
      ['MINE', 'Hold LMB on a block with a tool or empty hand'],
      ['PLACE', 'Select a block, then click (hold to paint)'],
      ['ROTATE', 'R cycles facing for chairs, beds, doors, roofs...'],
      ['LAYER', 'Z/X lock the mining/placing layer · V auto'],
      ['', 'SHIFT+wheel also changes the layer'],
      ['ATTACK', 'Click a creature or person with fists/weapon'],
      ['TALK', 'Right-click a villager (T in chat to trade)'],
      ['TOSS', 'Q throws one item · CTRL+Q the whole stack'],
      ['EAT', 'F (or RMB) while holding food'],
      ['WINDOWS', 'TAB bag · C craft · M map · ESC menu'],
      ['OPTIONS', 'F2 toggle CRT · F3 debug info'],
    ];
    rows.forEach(([k, v], i) => {
      g.text(3, 2 + i, k, C.hi);
      g.text(13, 2 + i, v, C.fg);
    });
    const tips = [
      'Villagers follow daily schedules: work, meals, hobbies, sleep.',
      'Hurt someone and they may fight back, flee, or call the guards.',
      'Chop trees for logs -> planks -> a workbench. Smelt ore in a',
      'furnace, forge metal at an anvil. Beds set your respawn point.',
      'Explore to fill in the world map. Night brings monsters.',
    ];
    tips.forEach((t, i) => g.text(3, 19 + i, t, C.dim));
    g.text(3, 26, 'Every world is generated from its seed: biomes, rivers,', C.faint);
    g.text(3, 27, 'civilizations, towns and every villager\'s life story.', C.faint);
    g.text(this.w - 16, this.h - 1, ' [H/ESC] close ', C.faint);
  }
}

// ---------------------------------------------------------------- pause
export class PauseWindow extends Window {
  constructor(ui) {
    super(ui, 34, 15, { kind: 'pause' });
    this.items = [
      ['ESC', 'Resume', (g) => this.close()],
      ['S', 'Save game', (g) => this.ui.hooks.save && this.ui.hooks.save()],
      ['L', 'Load game', (g) => this.ui.hooks.load && this.ui.hooks.load()],
      ['H', 'How to play', (g) => {
        this.close();
        this.ui.open(new HelpWindow(this.ui));
      }],
      ['G', 'Toggle CRT effect', () => this.ui.hooks.toggleCrt && this.ui.hooks.toggleCrt()],
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
  constructor(ui, hasSave) {
    super(ui, COLS, ROWS, { kind: 'title', x: 0, y: 0 });
    this.hasSave = hasSave;
    this.t = 0;
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
    const opts = [['N', 'New world (random seed)'], ...(this.hasSave ? [['C', 'Continue saved game']] : []), ['S', 'New world from seed...'], ['H', 'How to play']];
    opts.forEach(([k, label], i) => {
      const y = 13 + i * 2;
      const text = `[${k}]  ${label}`;
      const x = Math.floor((this.w - 30) / 2);
      const hov = this.hovering(x - 1, y, 32, 1);
      g.fill(x - 1, y, 32, 1, ' ', C.fg, hov ? C.bgHi : 'rgba(20,16,28,0.9)');
      g.text(x, y, text, hov ? C.hi : C.fg);
      this.hit(x - 1, y, 32, 1, () => this.choose(k));
    });
    if (Math.floor(t * 2) % 2) g.center(this.h - 2, 'PRESS A KEY', C.faint);
  }
  update(dt) {
    this.t += dt;
  }
  choose(k) {
    const h = this.ui.hooks;
    if (k === 'N') h.start && h.start(null);
    if (k === 'C' && this.hasSave) h.load && h.load();
    if (k === 'S' && h.askSeed) h.askSeed();
    if (k === 'H') this.ui.open(new HelpWindow(this.ui));
  }
  onKey(k) {
    const map = { KeyN: 'N', KeyC: 'C', KeyS: 'S', KeyH: 'H', Enter: 'N', Space: 'N' };
    if (this.ui.find('help')) return false;
    if (map[k.code]) this.choose(map[k.code]);
    return true;
  }
}

export { slotTable };
