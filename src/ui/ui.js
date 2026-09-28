// UI manager: routes input to windows, animates their dissolve/reform
// transitions, and draws the HUD.
import { COLS, ROWS, CHAR_W, CHAR_H, VIEW_W, VIEW_H, BELT_SIZE, TILE, LH } from '../config.js';
import { Grid, drawGrid, C, wrap } from './ascii.js';
import { ITEMS, maxStack } from '../world/items.js';
import { BLOCKS, B } from '../world/blocks.js';
import { TEX } from '../render/textures.js';
import { itemIcon } from '../render/sprites.js';
import { drawText } from '../render/font.js';
import { addItem } from '../game/inventory.js';
import { BIOMES } from '../world/biomes.js';
import * as W from './windows.js';
import { ZONE } from '../game/fishing.js';
import { Window, cap, describeActivity } from './window.js';
import { repLevel } from '../sim/sim.js';

export { Window, cap, describeActivity };

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.windows = [];
    this.messages = [];
    this.fade = 0;
    this.cursorStack = null;
    this.mouse = { x: 0, y: 0 };
    this.mouseCell = { x: -1, y: -1 };
    this.time = 0;
    this.hudGrid = new Grid(COLS, ROWS);
    this.hudP = 0;
    this.showHud = false;
    this.tooltip = null;
    this.debug = false;
    this.minimap = document.createElement('canvas');
    this.minimap.width = 84;
    this.minimap.height = 40;
    this.minimapT = 0;
    this.lastSettlement = null;
    this.game = null;
    this.hooks = {};
  }

  get modal() {
    return this.windows.some((w) => w.modal && w.state !== 'closing');
  }

  top() {
    for (let i = this.windows.length - 1; i >= 0; i--) if (this.windows[i].state !== 'closing') return this.windows[i];
    return null;
  }

  find(kind) {
    return this.windows.find((w) => w.kind === kind && w.state !== 'closing');
  }

  open(w) {
    this.windows.push(w);
    this.audio?.play('ui_open');
    return w;
  }

  close(w) {
    if (!w || w.state === 'closing') return;
    w.state = 'closing';
    if (w.onClose) w.onClose(this.game);
    if (w.modal) this.audio?.play('ui_close');
    if (this.cursorStack && !this.modal && this.game) {
      const left = this.game.player.give(this.cursorStack.item, this.cursorStack.count);
      if (left) this.game.tossItem(this.cursorStack.item, left, 0, 1);
      this.cursorStack = null;
    }
  }

  closeAll() {
    for (const w of this.windows) this.close(w);
  }

  toggle(kind, make) {
    const w = this.find(kind);
    if (w) this.close(w);
    else if (!this.modal || this.top()?.kind !== 'title') {
      const t = this.top();
      if (t && t.modal) this.close(t);
      this.open(make());
    }
  }

  msg(text, color = C.fg, merge = false) {
    if (merge && this.messages.length) {
      const last = this.messages[this.messages.length - 1];
      const m = /^\+(\d+) (.*)$/.exec(text);
      const lm = /^\+(\d+) (.*)$/.exec(last.text);
      if (m && lm && m[2] === lm[2] && last.t > 0) {
        last.text = `+${+m[1] + +lm[1]} ${m[2]}`;
        last.t = 5;
        return;
      }
    }
    this.messages.push({ text, color, t: 6 });
    if (this.messages.length > 7) this.messages.shift();
  }

  // ------------------------------------------------------------ input
  handle(ev, input, game) {
    this.game = game;
    this.mouse = input.mouse;
    this.mouseCell = { x: Math.floor(input.mouse.x / CHAR_W), y: Math.floor(input.mouse.y / CHAR_H) };
    const out = { pressed: [], clicks: [], wheel: 0, wheelShift: ev.wheelShift };
    for (const k of ev.pressed) {
      const top = this.top();
      if (top && top.onKey(k, game)) continue;
      if (!game) {
        if ((k.code === 'Escape' || k.code === 'KeyH') && top && top.kind === 'help') this.close(top);
        continue;
      }
      if (top && top.kind === 'title') continue;
      switch (k.code) {
        case 'Escape':
          if (top && top.modal) this.close(top);
          else if (!game.player.dead) this.open(new W.PauseWindow(this));
          continue;
        case 'Tab':
        case 'KeyI':
          if (!game.player.dead) this.toggle('inventory', () => new W.InventoryWindow(this));
          continue;
        case 'KeyM':
          this.toggle('map', () => new W.MapWindow(this));
          continue;
        case 'KeyC':
          if (!game.player.dead) this.toggle('craft', () => new W.CraftWindow(this, 'hand'));
          continue;
        case 'KeyJ':
          if (!game.player.dead) this.toggle('journal', () => new W.JournalWindow(this));
          continue;
        case 'KeyH':
        case 'F1':
          this.toggle('help', () => new W.HelpWindow(this));
          continue;
        case 'F2':
          if (this.hooks.toggleCrt) this.hooks.toggleCrt();
          continue;
        case 'F3':
          this.debug = !this.debug;
          continue;
      }
      if (!this.modal) out.pressed.push(k);
    }
    for (const ck of ev.clicks) {
      const cx = Math.floor(ck.x / CHAR_W);
      const cy = Math.floor(ck.y / CHAR_H);
      let consumed = false;
      for (let i = this.windows.length - 1; i >= 0; i--) {
        const w = this.windows[i];
        if (w.state === 'closing' || !w.contains(cx, cy)) continue;
        if (ck.type === 'down') w.onClick(ck, cx - w.x, cy - w.y, game);
        consumed = true;
        break;
      }
      if (consumed) continue;
      if (this.modal) {
        // Clicking outside an inventory while holding an item throws it.
        if (ck.type === 'down' && this.cursorStack) {
          const dx = ck.x - VIEW_W / 2;
          const dz = ck.y - VIEW_H / 2;
          const l = Math.hypot(dx, dz) || 1;
          game.tossItem(this.cursorStack.item, ck.button === 2 ? 1 : this.cursorStack.count, dx / l, dz / l);
          if (ck.button === 2) {
            this.cursorStack.count--;
            if (this.cursorStack.count <= 0) this.cursorStack = null;
          } else this.cursorStack = null;
        } else if (ck.type === 'down' && this.top() && this.top().closeOnOutside) this.close(this.top());
        continue;
      }
      // HUD belt clicks select slots.
      if (this.showHud && ck.type === 'down' && ck.button === 0) {
        const s = this.beltSlotAt(cx, cy);
        if (s >= 0) {
          game.selectSlot(s);
          continue;
        }
      }
      out.clicks.push(ck);
    }
    if (ev.wheel) {
      const top = this.top();
      if (top && top.modal) top.onWheel(ev.wheel, game);
      else out.wheel = ev.wheel;
    }
    return out;
  }

  hitTest(mx, my) {
    const cx = Math.floor(mx / CHAR_W);
    const cy = Math.floor(my / CHAR_H);
    if (this.windows.some((w) => w.state !== 'closing' && w.contains(cx, cy))) return true;
    if (this.showHud && cy >= BELT_Y && cx >= BELT_X && cx < BELT_X + BELT_W) return true;
    return false;
  }

  beltSlotAt(cx, cy) {
    if (cy < BELT_Y || cy >= BELT_Y + 4 || cx < BELT_X || cx >= BELT_X + BELT_W) return -2;
    const i = Math.floor((cx - BELT_X) / 4);
    return i >= 0 && i < BELT_SIZE ? i : -2;
  }

  update(dt, game) {
    this.time += dt;
    this.game = game;
    for (const w of this.windows) {
      w.update(dt, game);
      if (w.state === 'opening') {
        w.p += dt / 0.24;
        if (w.p >= 1) {
          w.p = 1;
          w.state = 'open';
        }
      } else if (w.state === 'closing') w.p -= dt / 0.17;
    }
    this.windows = this.windows.filter((w) => !(w.state === 'closing' && w.p <= 0));
    if (this.ko) this.ko.t += dt;
    for (const m of this.messages) m.t -= dt;
    this.messages = this.messages.filter((m) => m.t > 0);
    if (this.fade > 0 && !(game && game.sleepFast)) this.fade = Math.max(0, this.fade - dt * 0.8);
    if (this.showHud) this.hudP = Math.min(1, this.hudP + dt / 0.5);
    // Settlement name banner when entering a place.
    if (game && game.player) {
      const s = game.currentSettlement;
      if (s !== this.lastSettlement) {
        this.lastSettlement = s;
        if (s && this.showHud) this.open(new W.BannerWindow(this, s));
      }
    }
  }

  // ------------------------------------------------------------ render
  render(ctx, game, fps) {
    this.tooltip = null;
    if (this.showHud && game && game.player) {
      this.drawHud(game, fps);
      drawGrid(ctx, this.hudGrid, 0, 0, this.hudP, 1234, this.time);
      if (this.hudP > 0.8) this.drawMinimapImage(ctx);
    }
    for (const w of this.windows) {
      w.grid.clear();
      w.hits = [];
      w.draw(w.grid, game);
      const p = w.state === 'open' ? 1 : Math.max(0, Math.min(1, w.p));
      drawGrid(ctx, w.grid, w.x, w.y, easeOut(p), w.seed, this.time);
      if (w.drawPixels && p >= 1) w.drawPixels(ctx, game);
    }
    if (this.tooltip) this.drawTooltip(ctx);
    if (this.cursorStack) {
      const ic = itemIcon(this.cursorStack.item);
      ctx.drawImage(ic, Math.round(this.mouse.x - 8), Math.round(this.mouse.y - 8));
      if (this.cursorStack.count > 1) drawText(ctx, String(this.cursorStack.count), Math.round(this.mouse.x + 2), Math.round(this.mouse.y + 1), C.white, '#000');
    }
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.fade)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (game && game.sleep) this.drawSleep(ctx, game);
    if (this.ko) this.drawKnockout(ctx);
  }

  // Night falls gently: the world dims, a clock races toward dawn, and the
  // sleeper's breath drifts up as Z's.
  drawSleep(ctx, game) {
    const sl = game.sleep;
    let a;
    if (sl.phase === 'in') a = Math.min(1, sl.t / 2.2);
    else if (sl.phase === 'deep') a = 1;
    else a = Math.max(0, 1 - sl.t / 1.4);
    const k = a * a * (3 - 2 * a);
    ctx.fillStyle = `rgba(6,6,22,${0.8 * k})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Vignette bands.
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(0,0,8,${0.06 * k})`;
      ctx.fillRect(0, i * 4, VIEW_W, 4);
      ctx.fillRect(0, VIEW_H - (i + 1) * 4, VIEW_W, 4);
    }
    if (k < 0.3) return;
    const g = new Grid(34, 7);
    g.box(0, 0, 34, 7, { bg: 'rgba(12,12,30,0.9)', fg: '#3a3a6a' });
    const h = Math.floor(game.minute / 60);
    const m = Math.floor(game.minute % 60);
    g.center(1, sl.jail ? 'Dozing on the cot...' : 'Sleeping...', '#c8d8ff');
    g.center(2, `☾ ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}  Day ${game.day}`, '#a0b0e0');
    const now = game.day * 1440 + game.minute;
    const f = Math.max(0, Math.min(1, (now - sl.start) / Math.max(1, sl.wake - sl.start)));
    const n = Math.round(f * 26);
    g.text(4, 4, '▓'.repeat(n) + '░'.repeat(26 - n), '#6a7ac8');
    g.center(5, sl.phase === 'out' ? '' : 'any key: wake up', '#5a5a8a');
    drawGrid(ctx, g, Math.floor((COLS - 34) / 2), ROWS - 12, Math.min(1, (k - 0.3) / 0.4), 77, this.time);
    // Drifting Z's above the bed.
    const r = game.renderer;
    const b = sl.bed;
    const sx = b.x * TILE - r.camX + 10;
    const sy = b.z * TILE - b.y * LH - r.camY;
    for (let i = 0; i < 3; i++) {
      const t = (this.time * 0.6 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(t * Math.PI) * k;
      drawText(ctx, i % 2 ? 'z' : 'Z', Math.round(sx + t * 10 + i * 3), Math.round(sy - t * 22), '#c8d8ff');
    }
    ctx.globalAlpha = 1;
  }

  drawKnockout(ctx) {
    const ko = this.ko;
    const fadeIn = ko.t < 0.3 ? ko.t / 0.3 : 1;
    const fadeOut = ko.t > ko.dur - 1.2 ? Math.max(0, (ko.dur - ko.t) / 1.2) : 1;
    ctx.fillStyle = `rgba(0,0,0,${Math.min(fadeIn, fadeOut)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const g = new Grid(COLS, ko.lines.length * 2 + 1);
    ko.lines.forEach((l, i) => g.center(i * 2, l, i === 0 ? '#ff9080' : '#c8c8d8'));
    drawGrid(ctx, g, 0, Math.floor(ROWS / 2) - ko.lines.length, Math.min(1, ko.t / 0.6) * fadeOut, 99, this.time);
    if (ko.t >= ko.dur) this.ko = null;
  }

  drawTooltip(ctx) {
    const t = this.tooltip;
    const w = Math.max(...t.lines.map((l) => l.text.length)) + 2;
    const h = t.lines.length + 2;
    const g = new Grid(w, h);
    g.box(0, 0, w, h, { bg: C.bg, fg: C.dim });
    t.lines.forEach((l, i) => g.text(1, i + 1, l.text, l.color || C.fg));
    let cx = Math.floor(this.mouse.x / CHAR_W) + 2;
    let cy = Math.floor(this.mouse.y / CHAR_H) + 1;
    if (cx + w > COLS) cx = Math.max(0, Math.floor(this.mouse.x / CHAR_W) - w - 1);
    if (cy + h > ROWS) cy = ROWS - h;
    drawGrid(ctx, g, cx, cy, 1, 0, this.time);
  }

  itemTooltip(slot) {
    if (!slot) return;
    const d = ITEMS[slot.item];
    if (!d) return;
    const lines = [{ text: d.name + (slot.count > 1 ? ` x${slot.count}` : ''), color: C.hi }];
    if (d.kind === 'tool') lines.push({ text: `${cap(d.tool === 'pick' ? 'pickaxe' : d.tool || 'tool')} · speed ${d.speed}`, color: C.cyan });
    if (d.damage) lines.push({ text: `Damage ${d.damage} · reach ${d.reach}`, color: C.orange });
    if (d.kind === 'food') lines.push({ text: `Restores ${d.heal} HP [F/RMB]`, color: C.green });
    if (d.kind === 'armor') lines.push({ text: `Worn: ${d.slot}${d.armor ? ` · blocks ${Math.round(d.armor * 100)}%` : ''} [F/RMB]`, color: C.cyan });
    if (d.kind === 'block') {
      const b = BLOCKS[d.block];
      lines.push({ text: 'Placeable block' + (b.rotatable ? ' · [R] rotate' : ''), color: C.dim });
    }
    if (d.plant) lines.push({ text: 'Plant on farmland', color: C.green });
    lines.push({ text: `Value ¤${d.value}`, color: C.dim });
    this.tooltip = { lines };
  }

  // ------------------------------------------------------------ HUD
  drawHud(game, fps) {
    const g = this.hudGrid;
    g.clear();
    const p = game.player;
    // Hearts & coins.
    g.fill(0, 0, 25, 3, ' ', C.fg, 'rgba(10,8,16,0.55)');
    const hearts = Math.ceil(p.maxHp / 2);
    for (let i = 0; i < hearts; i++) {
      const v = p.hp - i * 2;
      g.put(1 + i, 0, v >= 1 ? '♥' : '♡', v >= 2 ? '#ff4a50' : v >= 1 ? '#a02830' : '#5a3a40');
    }
    g.text(2 + hearts, 0, `${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`, C.dim);
    const coins = p.inv.reduce((n, s) => n + (s && s.item === 'coin' ? s.count : 0), 0);
    g.text(1, 1, `¤ ${coins}`, C.hi);
    const held = p.heldDef();
    if (held) g.text(8, 1, held.name.slice(0, 15), C.fg);
    const s = game.currentSettlement;
    let loc;
    if (s) loc = `${s.name} · ${cap(s.type)}`;
    else {
      const col = game.world.terrain.column(p.x, p.z, game.world.terrain.context(p.x, p.z, p.x, p.z), {});
      loc = BIOMES[col.biome].name;
    }
    g.text(1, 2, loc.slice(0, 22), s ? C.cyan : C.green);
    const sim = game.sim;
    if (sim) {
      const j = sim.justice.jail;
      const cz = sim.citizen;
      let status = null;
      let col = C.dim;
      if (sim.justice.escort) {
        status = 'RESTRAINED · led to jail';
        col = C.orange;
      } else if (j) {
        if (j.phase === 'serving') {
          const left = Math.max(0, j.release - (game.day * 1440 + game.minute));
          status = `JAILED ${Math.floor(left / 60)}h${String(Math.floor(left % 60)).padStart(2, '0')}m left`;
        } else status = 'IN JAIL · hearing soon';
        col = C.orange;
      } else if (s && sim.justice.exiled.has(s.id)) {
        status = 'EXILED FROM HERE';
        col = C.red;
      } else if (cz && s && cz.sid === s.id) {
        status = cz.home !== null && cz.home !== undefined ? 'Citizen · home built' : cz.host !== null ? `Citizen · guest of the ${sim.hostName() || ''}s`.slice(0, 24) : 'Citizen';
        col = C.green;
      } else if (s && game.active.has(s.id)) {
        const L = game.active.get(s.id).layout;
        if (L.econ) status = `Taxes ${Math.round(L.econ.tax * 100)}%${L.econ.laws.armsBan ? ' · no weapons' : ''}`;
      }
      let y = 3;
      if (status) {
        g.fill(0, y, 25, 1, ' ', C.fg, 'rgba(10,8,16,0.55)');
        g.text(1, y++, status.slice(0, 24), col);
      }
      for (const l of sim.careers.hudLines()) {
        g.fill(0, y, 25, 1, ' ', C.fg, 'rgba(10,8,16,0.55)');
        g.text(1, y++, l.text.slice(0, 24), l.color);
      }
    }
    // Clock + minimap panel.
    const bx = COLS - 17;
    g.box(bx, 0, 16, 8, { bg: 'rgba(10,8,16,0.8)', fg: C.dim });
    const h = Math.floor(game.minute / 60);
    const m = Math.floor(game.minute % 60);
    const day = game.isDay();
    g.text(bx + 1, 0, ` Day ${game.day} `, C.hi);
    g.text(bx + 2, 1, `${day ? '☼' : '☾'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, day ? C.hi : C.blue);
    const phase = h < 5 ? 'Night' : h < 8 ? 'Dawn' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 20 ? 'Evening' : 'Night';
    g.text(bx + 9, 1, phase.slice(0, 6), C.dim);
    this.minimapT -= game.dt;
    if (this.minimapT <= 0) {
      this.minimapT = 0.35;
      this.renderMinimap(game);
    }
    this.minimapPos = { x: (bx + 1) * CHAR_W, y: 2 * CHAR_H };
    // Wanted banner: steady near the town, fading out a few seconds after
    // you've left it behind (it comes back if you return).
    if (!this.wantedSeen) this.wantedSeen = new Map();
    for (const [sid, t] of game.wanted) {
      const sb = game.world.ow.settlements[sid].bounds;
      const pl = game.player;
      const near = Math.max(sb.x0 - pl.x, pl.x - sb.x1, sb.z0 - pl.z, pl.z - sb.z1) <= 24;
      if (near || !this.wantedSeen.has(sid)) this.wantedSeen.set(sid, this.time);
      // (a few fixed steps: each text colour gets its own glyph atlas)
      const a = Math.ceil(Math.max(0, Math.min(1, 1 - (this.time - this.wantedSeen.get(sid) - 4) / 1.5)) * 4) / 4;
      if (a <= 0) continue;
      if (Math.floor(this.time * 2) % 2 === 0) {
        const name = game.world.ow.settlements[sid].name;
        const txt = t > 1e6 ? ` !! WANTED IN ${name.toUpperCase()} !! ` : ` !! WANTED IN ${name.toUpperCase()} ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} !! `;
        g.center(1, txt, `rgba(255,255,255,${a.toFixed(2)})`, `rgba(160,20,20,${(0.85 * a).toFixed(2)})`);
      }
      break;
    }
    for (const sid of this.wantedSeen.keys()) if (!game.wanted.has(sid)) this.wantedSeen.delete(sid);
    this.drawFishing(g, game);
    // Belt.
    this.drawBelt(g, p);
    // Messages.
    let y = BELT_Y - 1;
    for (let i = this.messages.length - 1; i >= 0 && y > 12; i--) {
      const msg = this.messages[i];
      const lines = wrap(msg.text, 22);
      for (let j = lines.length - 1; j >= 0 && y > 12; j--) {
        g.text(2, y, lines[j], msg.t < 1 ? C.faint : msg.color, 'rgba(10,8,16,0.5)');
        y--;
      }
    }
    // Layer / rotation / hints.
    const rx = COLS - 24;
    g.fill(rx, BELT_Y, 23, 4, ' ', C.fg, 'rgba(10,8,16,0.55)');
    g.text(rx + 1, BELT_Y, 'LAYER', C.dim);
    g.text(rx + 7, BELT_Y, game.layerLabel(), p.layerMode === null ? C.green : C.cyan);
    g.text(rx + 1, BELT_Y + 1, 'Z/X layer  V auto', C.faint);
    const hd = p.heldDef();
    const rotatable = hd && hd.kind === 'block' && BLOCKS[hd.block].rotatable;
    g.text(rx + 1, BELT_Y + 2, 'ROT', C.dim);
    g.text(rx + 5, BELT_Y + 2, ['↓ S', '← W', '↑ N', '→ E'][p.rot], rotatable ? C.hi : C.faint);
    g.text(rx + 10, BELT_Y + 2, '[R]', C.faint);
    g.text(rx + 1, BELT_Y + 3, 'H help  TAB bag  M map', C.faint);
    // World hover tooltip.
    const c = game.cursor;
    if (c && !this.modal) this.worldTooltip(game, c);
    if (this.debug) {
      g.text(25, 0, `${fps | 0}fps x${p.x} y${p.y} z${p.z} npcs${game.npcs.filter((n) => !n.dead).length} cr${game.creatures.length} reg${game.world.regions.size}`, C.green, 'rgba(0,0,0,0.6)');
    }
  }

  // The reel: keep your catch zone (green) over the fish until the line is in.
  drawFishing(g, game) {
    const f = game.fishing;
    if (!f) return;
    const W = 34;
    const x0 = Math.floor((COLS - W - 4) / 2);
    const y0 = BELT_Y - 6;
    if (f.phase === 'bite') {
      if (Math.floor(this.time * 6) % 2 === 0) g.center(y0 + 2, ' !! A BITE! Press SPACE !! ', '#1a1420', 'rgba(255,224,112,0.95)');
      return;
    }
    if (f.phase !== 'reel') return;
    g.box(x0, y0, W + 4, 5, { bg: 'rgba(10,20,34,0.9)', fg: C.cyan, title: 'REEL IT IN' });
    const zs = Math.round((f.zone - ZONE / 2) * W);
    const ze = Math.round((f.zone + ZONE / 2) * W);
    let bar = '';
    for (let i = 0; i < W; i++) bar += i >= zs && i < ze ? '█' : '░';
    g.text(x0 + 2, y0 + 1, bar, f.inside ? C.green : '#4a7a5a');
    const fx = Math.max(0, Math.min(W - 3, Math.round(f.fish * W) - 1));
    g.text(x0 + 2 + fx, y0 + 1, '><>', f.inside ? C.hi : C.orange);
    const n = Math.round(Math.max(0, Math.min(1, f.progress)) * W);
    g.text(x0 + 2, y0 + 2, '▓'.repeat(n) + '·'.repeat(W - n), f.progress > 0.25 ? C.cyan : C.red);
    g.text(x0 + 2, y0 + 3, 'Hold SPACE to pull right', C.faint);
  }

  drawBelt(g, p) {
    const x = BELT_X;
    const y = BELT_Y;
    g.fill(x, y, BELT_W, 4, ' ', C.fg, 'rgba(10,8,16,0.35)');
    const hz = '───';
    let top = '┌';
    let bot = '└';
    for (let i = 0; i < BELT_SIZE; i++) {
      top += hz + (i < BELT_SIZE - 1 ? '┬' : '┐');
      bot += hz + (i < BELT_SIZE - 1 ? '┴' : '┘');
    }
    g.text(x, y, top, C.dim);
    g.text(x, y + 3, bot, C.dim);
    for (let i = 0; i <= BELT_SIZE; i++) {
      g.put(x + i * 4, y + 1, '│', C.dim);
      g.put(x + i * 4, y + 2, '│', C.dim);
    }
    for (let i = 0; i < BELT_SIZE; i++) {
      const sx = x + 1 + i * 4;
      const sel = p.selected === i;
      g.fill(sx, y + 1, 3, 2, ' ', C.fg, sel ? 'rgba(90,70,30,0.92)' : 'rgba(24,20,30,0.85)');
      g.put(sx + 1, y, String(i + 1), sel ? C.hi : C.faint);
      if (sel) {
        g.text(sx - 1, y, '╔', C.hi);
        g.text(sx, y, '═', C.hi);
        g.put(sx + 1, y, String(i + 1), '#101010', C.hi);
        g.text(sx + 2, y, '═╗', C.hi);
        g.put(sx - 1, y + 1, '║', C.hi);
        g.put(sx - 1, y + 2, '║', C.hi);
        g.put(sx + 3, y + 1, '║', C.hi);
        g.put(sx + 3, y + 2, '║', C.hi);
        g.text(sx - 1, y + 3, '╚═══╝', C.hi);
      }
      const s = p.inv[i];
      if (s) g.icon(sx, y + 1, s.item, s.count);
    }
    // Hover tooltip for belt slots.
    const hs = this.beltSlotAt(this.mouseCell.x, this.mouseCell.y);
    if (hs >= 0 && !this.modal) this.itemTooltip(p.inv[hs]);
  }

  worldTooltip(game, c) {
    const lines = [];
    if (c.entity) {
      const e = c.entity;
      if (e.kind === 'npc') {
        lines.push({ text: e.name, color: C.hi });
        lines.push({ text: `${e.title}${e.rec.age === 'child' ? ' (child)' : e.rec.age === 'elder' ? ' (elder)' : ''}`, color: C.cyan });
        const act = e.sleeping ? 'sleeping' : e.state === 'flee' ? 'fleeing!' : e.state === 'fight' ? 'fighting!' : e.sitting ? `sitting · ${describeActivity(e.activity.entry)}` : e.activity ? describeActivity(e.activity.entry) : '';
        if (act) lines.push({ text: act, color: C.dim });
        if (game.sim) {
          const op = game.sim.opinion(e);
          const lvl = repLevel(op);
          lines.push({ text: `Opinion: ${lvl.label}`, color: lvl.color });
        }
        lines.push({ text: 'RMB talk · LMB attack', color: C.faint });
      } else {
        lines.push({ text: e.name || e.species, color: e.hostileNow ? C.red : C.green });
        lines.push({ text: `${Math.max(0, e.hp)}/${e.maxHp} HP`, color: C.dim });
      }
    } else if (c.block && c.block.id !== B.air) {
      const b = c.block;
      let label = b.label;
      if (b.interact === 'door') label += game.world.getState(c.x, c.y, c.z) ? ' (open)' : ' (closed)';
      if (b.interact === 'torch') label += game.world.getState(c.x, c.y, c.z) ? ' (lit)' : ' (out)';
      lines.push({ text: label, color: c.inReach ? C.hi : C.dim });
      const hints = [];
      if (b.interact) hints.push(`click ${interactVerb(b.interact)}`);
      if (isFinite(b.hardness) && !b.liquid) hints.push('hold mine');
      if (hints.length) lines.push({ text: hints.join(' · '), color: C.faint });
      if (game.mining && game.mining.x === c.x && game.mining.y === c.y && game.mining.z === c.z) {
        const n = Math.floor(game.mining.progress * 10);
        lines.push({ text: '[' + '▓'.repeat(n) + '░'.repeat(10 - n) + ']', color: C.orange });
      }
    }
    if (lines.length) this.tooltip = { lines };
  }

  renderMinimap(game) {
    const cv = this.minimap;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cv.width, cv.height);
    const p = game.player;
    const w = game.world;
    const W2 = cv.width >> 1;
    const H2 = cv.height >> 1;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const wx = p.x - W2 + x;
        const wz = p.z - H2 + y;
        const top = w.topAt(wx, wz);
        const i = (y * cv.width + x) * 4;
        if (top <= 0) {
          img.data[i + 3] = 255;
          continue;
        }
        let id = w.getBlock(wx, top - 1, wz);
        let ty = top - 1;
        if (BLOCKS[id].render === 'plant' || BLOCKS[id].render === 'flat') {
          id = w.getBlock(wx, top - 2, wz);
          ty--;
        }
        const avg = TEX.avg[id] || [80, 80, 80];
        const f = 0.75 + (ty - 5) * 0.06;
        img.data[i] = Math.min(255, avg[0] * f);
        img.data[i + 1] = Math.min(255, avg[1] * f);
        img.data[i + 2] = Math.min(255, avg[2] * f);
        img.data[i + 3] = 255;
      }
    }
    const dot = (wx, wz, col) => {
      const x = wx - p.x + W2;
      const y = wz - p.z + H2;
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return;
      const i = (y * cv.width + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
    };
    for (const n of game.npcs) if (!n.dead) dot(n.x, n.z, n.state === 'fight' ? [255, 60, 60] : [255, 230, 120]);
    for (const c of game.creatures) dot(c.x, c.z, c.hostileNow ? [255, 60, 60] : [200, 200, 200]);
    ctx.putImageData(img, 0, 0);
  }

  drawMinimapImage(ctx) {
    if (!this.minimapPos) return;
    const { x, y } = this.minimapPos;
    ctx.drawImage(this.minimap, x, y);
    const blink = Math.floor(this.time * 3) % 2;
    ctx.fillStyle = blink ? '#ffffff' : '#ff4040';
    ctx.fillRect(x + 42 - 1, y + 20 - 1, 3, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, 84, 1);
  }

  // Convenience window openers used by the game.
  openContainer(title, slots, pos) {
    this.closeAll();
    this.open(new W.ContainerWindow(this, title, slots, pos));
  }
  openCrafting(station) {
    this.closeAll();
    this.open(new W.CraftWindow(this, station));
  }
  openDialogue(npc) {
    this.closeAll();
    this.open(new W.DialogueWindow(this, npc, this.game));
  }
  openHalt(guard, crimes) {
    this.closeAll();
    this.open(new W.HaltWindow(this, guard, crimes));
  }
  openTrial(v) {
    this.closeAll();
    this.open(new W.TrialWindow(this, v));
  }
  openLedger(t) {
    this.closeAll();
    this.open(new W.LedgerWindow(this, this.game, t.s, t.L));
  }
  // Black-out card for being knocked out / marched to jail / escorted out.
  showKnockout(how, town, returned, weapons = 0) {
    const lines = how === 'knockout'
      ? ['You were knocked out...', `You come to in a cell in ${town}.`]
      : how === 'surrender' ? ['The guards march you to the jail...', `A cell in ${town}.`]
        : [`You are escorted out of ${town}...`, 'Never to return.'];
    if (returned) lines.push('Stolen goods were confiscated.');
    if (weapons) lines.push('The guards took your weapons.');
    this.ko = { t: 0, dur: how === 'exile' ? 3 : 4, lines };
    this.closeAll();
  }
  openTrade(npc) {
    this.closeAll();
    this.open(new W.TradeWindow(this, npc));
  }
  openSign(lines, title = 'SIGN') {
    this.closeAll();
    this.open(new W.TextWindow(this, title, lines));
  }
  openBook(lines) {
    this.closeAll();
    this.open(new W.TextWindow(this, lines[0], lines.slice(1), true));
  }
  openDeath(cause) {
    this.closeAll();
    this.open(new W.DeathWindow(this, cause));
  }
}

export const BELT_W = BELT_SIZE * 4 + 1;
export const BELT_X = Math.floor((COLS - BELT_W) / 2);
export const BELT_Y = ROWS - 4;

function easeOut(p) {
  return 1 - (1 - p) * (1 - p);
}


function interactVerb(kind) {
  return { door: 'open/close', container: 'open', workbench: 'craft', furnace: 'smelt', anvil: 'forge', torch: 'light', bed: 'sleep', sign: 'read', bookshelf: 'read', well: 'drink', altar: 'pray', grave: 'read', statue: 'look', sit: 'sit', cell_door: 'open', trap: 'check' }[kind] || 'use';
}


export { maxStack, addItem, TILE, LH };
