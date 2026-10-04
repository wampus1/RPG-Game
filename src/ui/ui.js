// UI manager: routes input to windows, animates their dissolve/reform
// transitions, and draws the HUD.
import { COLS, ROWS, CHAR_W, CHAR_H, VIEW_W, VIEW_H, BELT_SIZE, TILE, LH } from '../config.js';
import { Grid, drawGrid, C, wrap } from './ascii.js';
import { ITEMS, maxStack, GEMS } from '../world/items.js';
import { gemText } from '../game/gems.js';
import { MODS, STAR_MAX } from '../world/quality.js';
import { combatBuffText } from '../game/combat.js';
import { BLOCKS, B } from '../world/blocks.js';
import { TEX } from '../render/textures.js';
import { itemIcon, drawJewelled } from '../render/sprites.js';
import { drawText, textWidth } from '../render/font.js';
import { addItem, countItem } from '../game/inventory.js';
import { BIOMES } from '../world/biomes.js';
import * as W from './windows.js';
import { ZONE, KINDS } from '../game/fishing.js';
import { mastery } from '../game/mastery.js';
import { Window, cap, describeActivity } from './window.js';
import { repLevel } from '../sim/sim.js';
import { MARKS, fightPhase } from '../entities/tempo.js';
import { afflictionsOf } from '../game/afflict.js';
import { addNote, tickNotes, drawNotes } from './multiplayer.js';

// The tool pictured for a block that wants one.
const BEST_TOOL = { pick: 'stone_pickaxe', axe: 'stone_axe', shovel: 'stone_shovel' };

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
    // (Held keys, for windows that move about while one's held: the map.)
    this.input = input;
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
      // (In someone else's world, this screen's own windows only: the rest
      // is the host's. See net/guest.js.)
      if (this.guest) {
        if (k.code === 'Escape' && top && !top.remote) this.close(top);
        continue;
      }
      // (An opening scene playing: only a few of the usual keys.)
      if (game.cutscene && !game.cutscene.allowUi(k.code)) {
        if (!this.modal) out.pressed.push(k);
        continue;
      }
      switch (k.code) {
        case 'Escape':
          if (top && top.modal) this.close(top);
          // (A player in someone else's world pauses on their own screen.)
          else if (!game.player.dead && !this.remoteSeat) this.open(new W.PauseWindow(this));
          continue;
        // Who's here with you (with others in the world: see multiplayer.js).
        case 'KeyP':
          if (this.hooks.party && game.isParty && game.net) {
            const w = this.find('party');
            if (w) this.close(w);
            else this.hooks.party();
            continue;
          }
          break;
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
        case 'Backquote':
        case 'Slash':
          this.toggle('console', () => new W.ConsoleWindow(this));
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
          // (A direction on screen, turned into one in the world.)
          const [dx, dz] = game.renderer.toWorld ? game.renderer.toWorld(ck.x - VIEW_W / 2, ck.y - VIEW_H / 2) : [ck.x - VIEW_W / 2, ck.y - VIEW_H / 2];
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
      // (Another screen's window, as sent: it opens and closes there.)
      if (w.remote) continue;
      // A window fading out is finished: it mustn't act again (a dialogue
      // closing on its own used to reopen itself every frame of the fade).
      if (w.state !== 'closing') w.update(dt, game);
      if (w.state === 'opening') {
        w.p += this.instantWindows ? 1 : dt / 0.24;
        if (w.p >= 1) {
          w.p = 1;
          w.state = 'open';
        }
      } else if (w.state === 'closing') w.p -= this.instantWindows ? 1 : dt / 0.17;
    }
    this.windows = this.windows.filter((w) => w.remote || !(w.state === 'closing' && w.p <= 0));
    tickNotes(this, dt);
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
    // A master's fight: its name and its life across the top of the screen.
    if (game && game.dungeon && (game.dungeon.fight || game.dungeon.fallen)) this.drawBossBar(ctx, game);
    // Reeling one in (see drawReel).
    if (this.showHud && game && game.fishing && game.fishing.phase === 'reel') this.drawReel(ctx, game);
    // An opening scene's letterbox, titles and captions (under any window);
    // a short scene's bars and words (see scenes.js).
    if (game && game.cutscene) game.cutscene.draw(ctx);
    if (game && game.scene && game.scene.draw) game.scene.draw(ctx, game);
    // (A scene that covers the whole view, a lift's shaft or the dark you
    // lie in, keeps a place's name banner from showing over it.)
    const sc = game && game.scene;
    const covered = !!(sc && (sc.kind === 'lift' || (sc.kind === 'death' && !sc.reborn)));
    // (Notices go under a menu that's open, so as not to hide it; over the
    // title screen and the world.)
    const under = this.windows.some((w) => w.modal && w.state !== 'closing' && w.kind !== 'title' && w.kind !== 'banner');
    if (under) drawNotes(this, ctx);
    for (const w of this.windows) {
      if (covered && w.kind === 'banner') continue;
      w.grid.clear();
      w.hits = [];
      w.draw(w.grid, game);
      const p = w.state === 'open' ? 1 : Math.max(0, Math.min(1, w.p));
      drawGrid(ctx, w.grid, w.x, w.y, easeOut(p), w.seed, this.time);
      if (w.drawPixels && p >= 1) w.drawPixels(ctx, game);
    }
    // (In someone else's world: what their windows have under your pointer,
    // and what you've picked up in them, as the host sent it.)
    if (!this.tooltip && this.remoteTip && this.windows.some((w) => w.remote)) this.tooltip = this.remoteTip;
    if (this.tooltip) this.drawTooltip(ctx);
    const held = this.cursorStack || (this.windows.some((w) => w.remote) ? this.remoteStack : null);
    if (held) {
      const ic = itemIcon(held.item);
      drawJewelled(ctx, ic, held.item, Math.round(this.mouse.x - 8), Math.round(this.mouse.y - 8), this.time);
      if (held.count > 1) drawText(ctx, String(held.count), Math.round(this.mouse.x + 2), Math.round(this.mouse.y + 1), C.white, '#000');
    }
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.fade)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (game && game.sleep) this.drawSleep(ctx, game);
    if (this.ko) this.drawKnockout(ctx);
    if (!under) drawNotes(this, ctx);
  }

  // A notice at the side of the screen (someone joined: see multiplayer.js).
  notify(text, profile = null, color = C.fg) {
    addNote(this, text, profile, color);
  }

  // The master's bar: it drops in from the top as the fight begins, the
  // name spelled out a letter at a time, the bar filling; red, with a pale
  // trail behind each blow that catches up a moment later, a white flash
  // as it lands, a pulse when it's nearly done. When it falls: its name,
  // struck through, and VANQUISHED.
  drawBossBar(ctx, game) {
    const dg = game.dungeon;
    const f = dg.fight;
    const W = 220;
    const x0 = 176;
    if (!f) {
      const fl = dg.fallen;
      fl.t += game.dt || 0.016;
      if (fl.t > 4) {
        dg.fallen = null;
        return;
      }
      const a = Math.min(1, fl.t * 2) * Math.min(1, (4 - fl.t) * 1.5);
      ctx.globalAlpha = a;
      const word = 'VANQUISHED';
      drawText(ctx, word, Math.round(x0 + W / 2 - textWidth(word) / 2), 14, '#ffe070', '#3a2000');
      const nw = textWidth(fl.name);
      const nx = Math.round(x0 + W / 2 - nw / 2);
      drawText(ctx, fl.name, nx, 24, '#a89878', '#000');
      ctx.fillStyle = '#c83a30';
      ctx.fillRect(nx - 2, 27, Math.round((nw + 4) * Math.min(1, fl.t * 1.5)), 1);
      ctx.globalAlpha = 1;
      return;
    }
    const intro = Math.min(1, f.t / 1.4);
    const ease = 1 - (1 - intro) ** 3;
    const y = Math.round(-26 + ease * 36);
    // Name, a letter at a time.
    const name = f.name.toUpperCase();
    const shown = name.slice(0, Math.ceil(name.length * Math.min(1, f.t / 0.9)));
    const nx = Math.round(x0 + W / 2 - textWidth(name) / 2);
    drawText(ctx, shown, nx, y, '#f0e0c0', '#2a0808');
    // The frame.
    const by = y + 10;
    ctx.fillStyle = 'rgba(10,4,6,0.85)';
    ctx.fillRect(x0 - 3, by - 2, W + 6, 10);
    ctx.fillStyle = '#6a5040';
    ctx.fillRect(x0 - 3, by - 2, W + 6, 1);
    ctx.fillRect(x0 - 3, by + 7, W + 6, 1);
    ctx.fillStyle = '#c8a060';
    for (const ex of [x0 - 6, x0 + W + 2]) {
      ctx.fillRect(ex, by + 1, 4, 4);
      ctx.fillRect(ex + 1, by, 2, 6);
    }
    // The bar: its trail, its life, a flash where the last blow landed.
    const frac = Math.max(0, f.frac) * ease;
    const trail = Math.max(frac, f.trail * ease);
    ctx.fillStyle = '#e8d0a0';
    ctx.fillRect(x0, by, Math.round(W * trail), 6);
    const low = f.frac < 0.25 ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    const fw = Math.round(W * frac);
    ctx.fillStyle = `rgb(${Math.round(150 + 60 * low)},${Math.round(20 + 14 * low)},${Math.round(20 + 10 * low)})`;
    ctx.fillRect(x0, by, fw, 6);
    ctx.fillStyle = 'rgba(255,140,110,0.8)';
    ctx.fillRect(x0, by, fw, 1);
    ctx.fillStyle = 'rgba(60,0,0,0.6)';
    ctx.fillRect(x0, by + 5, fw, 1);
    if (f.t - f.hitT < 0.12) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(x0, by, fw, 6);
    }
    // Its phases: a notch at each mark (lit once it's past it), the phase
    // it's in by the bar's end, and a flash across it as it turns.
    const ph = fightPhase(f);
    for (const q of MARKS) {
      const mx = x0 + Math.round(W * q);
      const past = f.frac <= q;
      ctx.fillStyle = 'rgba(10,4,6,0.85)';
      ctx.fillRect(mx, by, 1, 6);
      ctx.fillStyle = past ? '#ffb040' : '#8a6a50';
      ctx.fillRect(mx - 1, by - 3, 3, 2);
      ctx.fillRect(mx, by - 4, 1, 1);
      ctx.fillRect(mx - 1, by + 7, 3, 2);
      ctx.fillRect(mx, by + 9, 1, 1);
    }
    const roman = ['', 'I', 'II', 'III'][ph];
    drawText(ctx, roman, x0 + W + 9, by - 1, ph >= 3 ? '#ff5040' : ph >= 2 ? '#ffb040' : '#c8a060', '#000');
    const pt = f.phaseT ?? 9;
    if (pt < 0.8) {
      ctx.fillStyle = `rgba(255,${ph >= 3 ? 80 : 180},60,${(1 - pt / 0.8) * 0.8})`;
      ctx.fillRect(x0 - 3, by - 2, W + 6, 10);
      const word = ph >= 3 ? 'DESPERATE' : 'ENRAGED';
      ctx.globalAlpha = 1 - pt / 0.8;
      drawText(ctx, word, Math.round(x0 + W / 2 - textWidth(word) / 2), by + 20, ph >= 3 ? '#ff5040' : '#ffb040', '#000');
      ctx.globalAlpha = 1;
    }
    // The title under it.
    if (f.title) {
      ctx.globalAlpha = Math.min(1, Math.max(0, (f.t - 0.6) * 2));
      drawText(ctx, f.title, Math.round(x0 + W / 2 - textWidth(f.title) / 2), by + 10, '#a89878', '#000');
      ctx.globalAlpha = 1;
    }
    // Its own gauge, if it keeps one (heat, fury, the season it's in: see
    // the bosses_ files), under the title.
    let gy = by + 21;
    const g = (f.boss.find((c) => !c.dead && c.gauge) || {}).gauge;
    if (g) {
      const gw = 120;
      const gx = Math.round(x0 + W / 2 - gw / 2);
      const hot = g.v >= 0.85 && Math.floor(this.time * 8) % 2;
      drawText(ctx, g.label, gx - textWidth(g.label) - 4, gy - 2, hot ? '#ffffff' : g.color, '#000');
      ctx.fillStyle = 'rgba(10,4,6,0.85)';
      ctx.fillRect(gx - 1, gy - 1, gw + 2, 5);
      ctx.fillStyle = hot ? '#ffffff' : g.color;
      ctx.fillRect(gx, gy, Math.round(gw * Math.max(0, Math.min(1, g.v))), 3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(gx, gy, Math.round(gw * Math.max(0, Math.min(1, g.v))), 1);
      gy += 9;
    }
    // And what it's done to you (and how to be rid of it).
    const marks = afflictionsOf(game.player);
    if (marks.length) {
      const line = marks.map((m) => m.text);
      let mx = Math.round(x0 + W / 2 - textWidth(line.join('   ')) / 2);
      for (const m of marks) {
        drawText(ctx, m.text, mx, gy, m.color, '#000');
        mx += textWidth(m.text) + textWidth('   ');
      }
    }
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
    const bs = r.worldToScreen ? r.worldToScreen(b.x, b.y, b.z) : { x: b.x * TILE - r.camX, y: b.z * TILE - b.y * LH - r.camY };
    const sx = bs.x + 10;
    const sy = bs.y;
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
    // Room on the right for a tool's picture (three characters by two rows).
    const iconW = t.tool ? 4 : 0;
    const w = Math.max(...t.lines.map((l) => l.text.length)) + 2 + iconW;
    const h = Math.max(t.lines.length, t.tool ? 2 : 0) + 2;
    const g = new Grid(w, h);
    g.box(0, 0, w, h, { bg: C.bg, fg: t.far ? C.red : C.dim });
    t.lines.forEach((l, i) => g.text(1, i + 1, l.text, l.color || C.fg));
    let cx = Math.floor(this.mouse.x / CHAR_W) + 2;
    let cy = Math.floor(this.mouse.y / CHAR_H) + 1;
    if (cx + w > COLS) cx = Math.max(0, Math.floor(this.mouse.x / CHAR_W) - w - 1);
    if (cy + h > ROWS) cy = ROWS - h;
    if (t.faint) ctx.globalAlpha = 0.55;
    drawGrid(ctx, g, cx, cy, 1, 0, this.time);
    ctx.globalAlpha = 1;
    if (t.tool) {
      const ic = itemIcon(t.tool.icon);
      const x = (cx + w - iconW) * CHAR_W;
      const y = (cy + 1) * CHAR_H;
      if (t.tool.held) {
        ctx.fillStyle = 'rgba(80,200,90,0.35)';
        ctx.fillRect(x - 1, y - 1, 18, 18);
      }
      if (ic) ctx.drawImage(ic, x, y);
    }
  }

  itemTooltip(slot) {
    if (!slot) return;
    const d = ITEMS[slot.item];
    if (!d) return;
    const lines = [{ text: d.name + (slot.count > 1 ? ` x${slot.count}` : ''), color: C.hi }];
    // Its stars (and where it came from).
    if (d.stars) lines.push({ text: `${'★'.repeat(d.stars)}${'☆'.repeat(STAR_MAX - d.stars)}${d.origin === 'd' ? '  Ω from the deep' : '  made by hand'}`, color: d.origin === 'd' ? '#c8a8ff' : '#ffd060' });
    if (d.kind === 'tool') lines.push({ text: `${cap(d.tool === 'pick' ? 'pickaxe' : d.tool || 'tool')} · speed ${d.speed}`, color: C.cyan });
    if (d.damage) lines.push({ text: d.ranged ? `Damage ${d.damage} · range ${d.range}` : `Damage ${d.damage} · reach ${d.reach}`, color: C.orange });
    if (d.kind === 'weapon') {
      const ammo = d.thrown ? 'thrown; pick it up again' : d.ranged ? (d.ammo === 'none' ? 'no ammunition: draws stamina' : `shoots ${d.ammo === 'cobblestone' ? 'stones' : d.ammo === 'bolt' ? 'bolts' : 'arrows'}`) : null;
      lines.push({ text: `${d.hands === 2 ? 'Two-handed (no shield)' : d.ranged ? 'One-handed' : 'One-handed · RMB in pack: off hand'}${ammo ? ` · ${ammo}` : ''}`, color: C.dim });
    }
    if (d.kind === 'food') lines.push({ text: d.regen ? `Restores ${d.now} HP now, ${d.regen} more over ${d.regenT}s [F/RMB]` : `Restores ${d.heal} HP [F/RMB]`, color: C.green });
    if (d.kind === 'armor') lines.push({ text: `Worn: ${d.slot}${d.armor ? ` · blocks ${Math.round(d.armor * 100)}%` : ''} [F/RMB]`, color: C.cyan });
    const STAT = { str: 'STR', agi: 'AGI', end: 'END', cha: 'CHA' };
    if (d.stats) lines.push({ text: `${d.kind === 'armor' ? 'While worn' : 'While held'}: ${Object.entries(d.stats).map(([k, n]) => `${n > 0 ? '+' : ''}${n} ${STAT[k] || k}`).join(' ')}`, color: C.green });
    if (d.socket) for (const t of wrap(gemText(slot.item), 44)) lines.push({ text: t, color: '#c0a0ff' });
    // Its modifiers, each with what it does.
    for (const m of d.mods || []) {
      const md = MODS[d.gear] && MODS[d.gear][m];
      if (md) for (const [i, t] of wrap(`${md.name}: ${md.about}`, 44).entries()) lines.push({ text: i ? `  ${t}` : `◆ ${t}`, color: '#f0c070' });
    }
    if (d.kind === 'gem') lines.push({ text: `${GEMS[slot.item].about}.`, color: '#c0a0ff' }, { text: 'Set into gear at a jeweller\'s bench.', color: C.dim });
    if (d.kind === 'potion') {
      const e = d.effect || {};
      const what = e.stat ? `${STAT[e.stat]} +${e.n} for ${e.hours} hours` : e.combat ? `${combatBuffText(e)} for ${e.hours} hours` : e.blue ? `+${e.blue} blue health for today` : `Heals ${e.heal}`;
      lines.push({ text: `${what} [F/RMB]`, color: '#c0a0ff' });
    }
    if (d.newspaper) lines.push({ text: 'Read it [F/RMB] · hand copies to people', color: C.dim });
    if (d.kind === 'block') {
      const b = BLOCKS[d.block];
      lines.push({ text: 'Placeable block' + (b.rotatable ? ' · [R] rotate' : ''), color: C.dim });
    }
    if (d.relic) lines.push({ text: 'Set it down to use it', color: C.green });
    else if (d.plant) lines.push({ text: 'Plant on farmland', color: C.green });
    lines.push({ text: d.exchange ? `Value ¤1 for ${d.exchange}` : `Value ¤${d.value}`, color: C.dim });
    this.tooltip = { lines };
  }

  // ------------------------------------------------------------ HUD
  drawHud(game, fps) {
    const g = this.hudGrid;
    g.clear();
    const p = game.player;
    // Hearts; under them your stamina; then coins and what you hold; then
    // where you are (each on its own row, so nothing covers anything).
    g.fill(0, 0, 25, 4, ' ', C.fg, 'rgba(10,8,16,0.55)');
    const hearts = Math.ceil(p.maxHp / 2);
    for (let i = 0; i < hearts; i++) {
      const v = p.hp - i * 2;
      g.put(1 + i, 0, v >= 1 ? '♥' : '♡', v >= 2 ? '#ff4a50' : v >= 1 ? '#a02830' : '#5a3a40');
    }
    // Blue hearts for today.
    const blue = p.blue && p.blue.day === game.day ? p.blue.hp : 0;
    const bh = Math.ceil(blue / 2);
    for (let i = 0; i < bh; i++) g.put(1 + hearts + i, 0, '♥', blue - i * 2 >= 2 ? '#58a8ff' : '#3868a8');
    const hpText = `${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}${blue ? `+${blue}` : ''}`;
    g.text(2 + hearts + bh, 0, hpText, C.dim);
    // (A hot meal still doing you good: a green cross, pulsing.)
    if (p.slowHeal && p.slowHeal.left > 0) g.put(3 + hearts + bh + hpText.length, 0, '+', Math.floor(this.time * 3) % 2 ? '#80e070' : '#4a9a40');
    // Stamina: a pip for each point, right under the hearts; the one
    // filling back up glows dimmer (and all of them, when they're full).
    // (Days without sleep cost a pip each: shown struck out in violet,
    // with what's wrong spelled out under them, until you sleep.)
    const sm = p.maxStamina || 10;
    const tired = p.sleepless || 0;
    if (p.stamina !== undefined) {
      const n = Math.min(20, Math.ceil(sm));
      const v = Math.max(0, p.stamina);
      const low = v < Math.max(2, sm * 0.25);
      const lost = Math.min(23 - n, tired);
      const rest = v >= sm - 0.05 && !tired && !(p.drainFlash > 0);
      // (Breath being torn out of you: the pips flash a sick green.)
      const drained = p.drainFlash > 0;
      if (drained) p.drainFlash -= game.dt || 0.016;
      for (let i = 0; i < n; i++) {
        const part = Math.max(0, Math.min(1, v - i));
        const full = drained ? (Math.floor(this.time * 12) % 2 ? '#9cf0b0' : '#4aa070') : low ? '#ff9040' : rest ? '#a89848' : '#e8d060';
        g.put(1 + i, 1, part >= 1 ? '■' : part > 0 ? '▪' : '·', part >= 1 ? full : part > 0 ? (drained ? '#3a7050' : '#9a8a40') : '#5a5040');
      }
      const blink = Math.floor(performance.now() / 600) % 2 === 0;
      for (let i = 0; i < lost; i++) g.put(1 + n + i, 1, '×', blink ? '#c070ff' : '#8a50c0');
    }
    // Potions still working.
    const nowAbs = game.day * 1440 + game.minute;
    const buffs = (p.buffs || []).filter((q) => q.until > nowAbs);
    if (buffs.length) {
      const txt = buffs.map((q) => {
        const left = Math.max(0, q.until - nowAbs);
        const what = q.combat ? { breath: `STA+${q.n}`, wind: 'REGEN', fury: 'FURY', haste: 'HASTE' }[q.combat] : `${{ str: 'STR', agi: 'AGI', end: 'END', cha: 'CHA' }[q.stat]}+${q.n}`;
        return `${what} ${Math.floor(left / 60)}h${String(Math.floor(left % 60)).padStart(2, '0')}`;
      }).join('  ');
      g.text(1, 4, txt.slice(0, 40), '#c0a0ff', 'rgba(10,8,16,0.55)');
    }
    const coins = p.inv.reduce((n, s) => n + (s && s.item === 'coin' ? s.count : 0), 0);
    const ct = `¤ ${coins}`;
    g.text(1, 2, ct, C.hi);
    const held = p.heldDef();
    if (held) g.text(3 + ct.length, 2, held.name.slice(0, 21 - ct.length), C.fg);
    const s = game.dungeon ? null : game.currentSettlement;
    let loc;
    // (Below ground: which place, and how deep.)
    const dg = game.dungeon;
    if (dg) loc = `${dg.kav ? 'Ruin' : cap(dg.T.name)} · Floor ${dg.floor + 1}/${dg.rec.depth}`;
    else if (s) loc = `${s.name} · ${cap(s.type)}`;
    else {
      const col = game.world.terrain.column(p.x, p.z, game.world.terrain.context(p.x, p.z, p.x, p.z), {});
      loc = BIOMES[col.biome].name;
    }
    g.text(1, 3, loc.slice(0, 23), dg ? (dg.kav ? '#7ae0ff' : '#d8b878') : s ? C.cyan : C.green);
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
        if (j.pow) status = 'PRISONER OF WAR';
        else if (j.phase === 'serving') {
          const left = Math.max(0, j.release - (game.day * 1440 + game.minute));
          status = `JAILED ${Math.floor(left / 60)}h${String(Math.floor(left % 60)).padStart(2, '0')}m left`;
        } else status = j.phase === 'night' ? 'IN JAIL · hearing at dawn' : 'IN JAIL · hearing soon';
        col = C.orange;
      } else if (s && sim.justice.exiled.has(s.id)) {
        status = 'EXILED FROM HERE';
        col = C.red;
      } else if (s && sim.war.isDeserter(s.civ)) {
        status = 'DESERTER · WANTED HERE';
        col = C.red;
      } else if (game.player.down) {
        status = 'KNOCKED OUT';
        col = C.orange;
      } else if (cz && s && cz.sid === s.id) {
        status = cz.home !== null && cz.home !== undefined ? 'Citizen · home built' : cz.host !== null ? `Citizen · guest of the ${sim.hostName() || ''}s`.slice(0, 24) : 'Citizen';
        col = C.green;
      }
      // (A town's taxes and laws are on its notice board, not up here.)
      let y = buffs.length ? 5 : 4;
      if (status) {
        g.fill(0, y, 25, 1, ' ', C.fg, 'rgba(10,8,16,0.55)');
        g.text(1, y++, status.slice(0, 24), col);
      }
      for (const l of sim.careers.hudLines()) {
        g.fill(0, y, 25, 1, ' ', C.fg, 'rgba(10,8,16,0.55)');
        g.text(1, y++, l.text.slice(0, 24), l.color);
      }
      // No sleep for a day or more: it shows, until you sleep it off.
      if (tired > 0) {
        g.fill(0, y, 25, 1, ' ', C.fg, 'rgba(10,8,16,0.55)');
        g.text(1, y++, `SLEEPLESS ${tired}d · -${tired} STAMINA`, Math.floor(this.time * 1.5) % 2 ? '#c090ff' : '#a070e0');
      }
      // Below ground: what you've found there isn't yours till you're out.
      const ub = dg && dg.unbound ? dg.unbound().length : 0;
      if (ub) {
        g.fill(0, y, 25, 1, ' ', C.fg, 'rgba(10,8,16,0.55)');
        g.text(1, y++, `${ub} FOUND · LOST IF YOU FALL`.slice(0, 24), '#ffb080');
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
    // The arrow is how it will face on screen; the letter, which way that is.
    const view = game.renderer.view || 0;
    g.text(rx + 5, BELT_Y + 2, `${['↓', '←', '↑', '→'][p.rot]} ${['S', 'W', 'N', 'E'][(p.rot - view) & 3]}`, rotatable ? C.hi : C.faint);
    g.text(rx + 10, BELT_Y + 2, '[R]  Q/E turn', C.faint);
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
    if (f.phase === 'bite' && Math.floor(this.time * 6) % 2 === 0) g.center(BELT_Y - 4, ' !! A BITE! Press SPACE !! ', '#1a1420', 'rgba(255,224,112,0.95)');
    // (The reel itself is drawn in pixels: see drawReel.)
  }

  // Reeling in, under the water: the light moving on the bottom, weed
  // swaying, bubbles; your catch zone a net of light (bright with the fish
  // in it); the fish itself, its kind's colours, its tail going, turned the
  // way it's swimming (a splash as it darts); a glint of something lost down
  // there to scoop up with it; and the line coming in on the spool below.
  drawReel(ctx, game) {
    const f = game.fishing;
    const K = KINDS[f.kind] || KINDS.perch;
    const t = this.time;
    const PW = 252;
    const PH = 62;
    const x0 = Math.round((VIEW_W - PW) / 2);
    const y0 = (BELT_Y - 8) * CHAR_H;
    const R = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    // Frame.
    R(x0 - 2, y0 - 2, PW + 4, PH + 4, 'rgba(6,10,18,0.92)');
    R(x0 - 2, y0 - 2, PW + 4, 1, '#70e0e0');
    R(x0 - 2, y0 + PH + 1, PW + 4, 1, '#3a7a8a');
    R(x0 - 2, y0 - 2, 1, PH + 4, '#4a9aa8');
    R(x0 + PW + 1, y0 - 2, 1, PH + 4, '#3a7a8a');
    // What's on the line, and your practice.
    const title = K.item ? 'Something on the line...' : `${f.big ? 'A big ' : ''}${K.name}`;
    drawText(ctx, title, x0 + 4, y0 + 1, K.gold ? '#ffe070' : f.big ? '#ffb070' : '#c8f0ff', '#000');
    const rk = mastery(game, 'fishing');
    const rt = `Rank ${rk.rank} ${rk.title}`;
    drawText(ctx, rt, x0 + PW - 4 - textWidth(rt), y0 + 1, '#6a9aa8', '#000');
    // The water.
    const wx = x0 + 4;
    const wy = y0 + 11;
    const ww = PW - 8;
    const wh = 32;
    for (let y = 0; y < wh; y++) {
      const k = y / wh;
      R(wx, wy + y, ww, 1, `rgb(${Math.round(20 + 14 * (1 - k))},${Math.round(70 + 40 * (1 - k))},${Math.round(100 + 40 * (1 - k))})`);
    }
    // Light moving on it.
    ctx.globalAlpha = 0.18;
    for (let x = 0; x < ww; x += 2) {
      const y = 3 + Math.round(Math.sin(x * 0.09 + t * 1.6) * 2 + Math.sin(x * 0.033 - t * 0.9) * 3);
      R(wx + x, wy + y, 2, 1, '#e0fcff');
      const y2 = 18 + Math.round(Math.sin(x * 0.07 - t * 1.2) * 3);
      if ((x >> 1) % 3) R(wx + x, wy + y2, 2, 1, '#a8f0ff');
    }
    ctx.globalAlpha = 1;
    // Weed swaying along the bottom.
    for (let i = 0; i < 14; i++) {
      const bx = wx + 8 + ((i * 53) % (ww - 16));
      const hgt = 6 + ((i * 7) % 7);
      for (let j = 0; j < hgt; j++) R(bx + Math.round(Math.sin(t * 1.4 + i + j * 0.4) * (j / hgt) * 2), wy + wh - 1 - j, 1, 1, j % 3 ? '#2a6a3a' : '#3a8a4a');
    }
    // Bubbles rising.
    for (let i = 0; i < 9; i++) {
      const ph = (t * (0.3 + (i % 3) * 0.12) + i * 0.37) % 1;
      R(wx + ((i * 71) % ww) + Math.sin(t * 3 + i) * 1.5, wy + wh - 2 - ph * (wh - 3), 1, 1, '#c8f4ff');
    }
    // The catch zone: a net of light.
    const W = f.zoneW || ZONE;
    const zx0 = wx + (f.zone - W / 2) * ww;
    const zw = W * ww;
    ctx.globalAlpha = f.inside ? 0.32 + 0.08 * Math.sin(t * 10) : 0.16;
    R(zx0, wy, zw, wh, f.inside ? '#a0ffb0' : '#80c8a0');
    ctx.globalAlpha = 1;
    const zc = f.inside ? '#c8ffd0' : '#6ab88a';
    R(zx0, wy, 1, wh, zc);
    R(zx0 + zw - 1, wy, 1, wh, zc);
    for (let x = 0; x < zw; x += 4) {
      R(zx0 + x, wy, 2, 1, zc);
      R(zx0 + x, wy + wh - 1, 2, 1, zc);
    }
    // Something glinting down there.
    const tr = f.treasure;
    if (tr && !tr.done && f.t >= tr.at) {
      const tx = wx + tr.pos * ww;
      const ty = wy + wh - 8 + Math.sin(t * 2) * 1;
      R(tx - 4, ty, 8, 5, '#7a5a2a');
      R(tx - 4, ty, 8, 2, '#9a7a3a');
      R(tx - 1, ty + 2, 2, 2, '#ffd040');
      if (Math.sin(t * 7) > 0.4) R(tx + 3, ty - 2, 1, 1, '#ffffff');
      // (How near it is to coming up.)
      R(tx - 5, ty + 7, 10, 1, '#203040');
      R(tx - 5, ty + 7, Math.round(10 * tr.got), 1, '#ffe070');
    }
    // The fish (or the thing).
    const fx = wx + f.fish * ww;
    const fy = wy + 15 + Math.sin(t * 2.3) * 2 + (K.eel ? Math.sin(t * 6) * 2 : 0);
    const face = f.fishV >= 0 ? 1 : -1;
    if (K.item) {
      const ic = itemIcon(K.item);
      ctx.drawImage(ic, Math.round(fx - 6), Math.round(fy - 6), 12, 12);
    } else this.drawFish(ctx, K, fx, fy, face, f.size || 1, t);
    if (f.splash > 0) for (let i = 0; i < 5; i++) R(fx - face * (14 + i * 3), fy + Math.sin(i * 2 + t * 20) * 3, 1, 1, '#e0fcff');
    // The line coming in, on the spool.
    const py = y0 + PH - 14;
    const n = Math.max(0, Math.min(1, f.progress));
    R(wx, py, ww, 5, '#101a24');
    R(wx, py, Math.round(ww * n), 5, n > 0.25 ? '#3ab8c8' : '#c84a3a');
    R(wx, py, Math.round(ww * n), 1, n > 0.25 ? '#a8f4ff' : '#ff9a8a');
    R(wx + Math.round(ww * n) - 1, py - 1, 2, 7, '#ffffff');
    drawText(ctx, 'Hold SPACE to pull right', wx, py + 6, '#4a7a8a', null);
  }

  // A fish, side on: body in its kind's colours (a paler belly), a tail
  // beating, a fin, an eye; an eel long and thin, a swordfish's sword, a
  // golden carp's sparkle; spots or a stripe on some.
  drawFish(ctx, K, x, y, face, size, t) {
    const L = Math.round((K.len || 9) * Math.min(1.4, 0.8 + size * 0.25));
    const H = K.eel ? 3 : Math.max(4, Math.round(L * 0.45));
    // (Drawn at twice the size: it's the star of the show.)
    const S = 2;
    const R = (dx, dy, w, h, c) => {
      ctx.fillStyle = c;
      const xx = face > 0 ? x + dx * S : x - (dx + w) * S;
      ctx.fillRect(Math.round(xx), Math.round(y + dy * S), w * S, h * S);
    };
    const half = L >> 1;
    for (let i = 0; i < L; i++) {
      // (Fattest a third of the way back from the head.)
      const k = i / (L - 1);
      const th = K.eel ? H : Math.max(1, Math.round(H * Math.sin(Math.PI * Math.min(1, (1 - k) * 0.85 + 0.12))));
      const wob = K.eel ? Math.round(Math.sin(t * 9 + i * 0.6) * 1.2) : 0;
      const top = -Math.floor(th / 2) + wob;
      R(half - i, top, 1, Math.ceil(th / 2), K.body);
      R(half - i, top + Math.ceil(th / 2), 1, Math.floor(th / 2) || 1, K.belly);
      if (K.stripe && i > 1 && i < L - 3) R(half - i, 0 + wob, 1, 1, K.stripe);
      if (K.stripes && i % 3 === 0 && i > 1 && i < L - 3) R(half - i, top, 1, 2, K.stripes);
      if (K.spots && (i * 7) % 5 === 0 && i > 1 && i < L - 3) R(half - i, top + 1, 1, 1, K.spots);
    }
    // The tail, beating.
    const beat = Math.round(Math.sin(t * (K.eel ? 9 : 14)) * 1.5);
    if (!K.eel) {
      R(-half - 1, -2 + beat, 2, 2, K.fin);
      R(-half - 2, -3 + beat, 1, 2, K.fin);
      R(-half - 1, 1 + beat, 2, 2, K.fin);
      R(-half - 2, 2 + beat, 1, 2, K.fin);
      // A fin on its back.
      R(1, -Math.floor(H / 2) - 1, 3, 1, K.fin);
    }
    if (K.sword) R(half + 1, -1, 5, 1, '#c8d0e0');
    // The eye.
    R(half - 2, -1, 1, 1, '#101010');
    R(half - 1, -1, 1, 1, '#ffffff');
    if (K.gold && Math.sin(t * 8) > 0.3) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x + Math.sin(t * 3) * half * S), Math.round(y - H * S), 2, 2);
    }
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
      if (e.kind === 'player') {
        // Someone you're playing with.
        lines.push({ text: e.account ? e.account.name : 'A player', color: '#a0e0ff' });
        if (e.account && e.account.desc) lines.push({ text: e.account.desc.slice(0, 34), color: C.dim });
        lines.push({ text: `${Math.max(0, Math.ceil(e.hp))}/${e.maxHp} HP`, color: C.dim });
        lines.push({ text: 'RMB profile', color: C.faint });
      } else if (e.kind === 'npc') {
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
      } else if (e.kind === 'prop' && e.type === 'ship') {
        lines.push({ text: `The ${e.name}`, color: C.hi });
        const s = game.world.ow.settlements[e.sid];
        lines.push({ text: `Trade ship of ${s ? s.name : 'a port'}`, color: C.cyan });
        lines.push({ text: e.phase === 'out' ? 'putting out to sea' : e.phase === 'in' ? 'coming in to the pier' : 'tied up at the pier', color: C.dim });
      } else if (e.kind === 'prop' && (e.type === 'catapult' || e.type === 'ram')) {
        lines.push({ text: e.type === 'ram' ? 'Battering ram' : 'Catapult', color: C.hi });
        lines.push({ text: e.broken ? 'wrecked' : `${Math.max(0, e.hp)}/${e.maxHp} timber`, color: e.broken ? C.dim : C.orange });
        if (!e.broken) lines.push({ text: 'LMB hack at it (an axe is best)', color: C.faint });
      } else if (e.kind === 'prop') {
        lines.push({ text: e.own ? 'Your wagon' : 'Wagon', color: C.hi });
        const bench = c.part === 'bench';
        lines.push({ text: bench ? (e.own ? (e.horse ? 'the bench · RMB drive' : 'the bench · needs a horse in the shafts') : 'the bench · RMB sit up front') : 'the back · RMB climb in', color: C.faint });
      } else {
        const horse = e.species === 'horse';
        lines.push({ text: horse ? (e.own ? 'Your horse' : e.tie ? (e.banner ? 'A trader\'s horse' : 'A town horse') : 'Wild horse') : e.name || e.species, color: e.hostileNow ? C.red : C.green });
        lines.push({ text: `${Math.max(0, e.hp)}/${e.maxHp} HP`, color: C.dim });
        // On a lead (yours, or tied up), and how near it is to pulling free.
        if (e.leadBy === game.player) lines.push({ text: e.strain > 0 ? `On your lead · straining ${Math.round(Math.min(1, e.strain) * 100)}%` : 'On your lead', color: e.strain > 0.6 ? C.orange : C.cyan });
        else if (e.leadTied) lines.push({ text: e.strain > 0 ? `Tied up · straining ${Math.round(Math.min(1, e.strain) * 100)}%` : 'Tied up by you', color: e.strain > 0.6 ? C.orange : C.cyan });
        else if (e.loose && e.standKey) lines.push({ text: 'Loose from its post', color: C.orange });
        if (e.leadBy === game.player) lines.push({ text: 'RMB let go · RMB a fence to tie up', color: C.faint });
        else if (e.leadTied) lines.push({ text: 'RMB take up the lead', color: C.faint });
        else if (horse && !e.tie) lines.push({ text: e.own ? (e.saddled ? 'RMB ride' : 'RMB with a saddle to saddle up') : e.loose ? 'someone\'s horse' : 'RMB with food to win it over', color: C.faint });
        else if (horse && e.town && !e.own && game.sim && game.sim.isCitizen(e.town.sid)) lines.push({ text: 'RMB untie and take out (citizen)', color: C.faint });
        if (game.player.heldItem() === 'lead' && !e.tie && !e.leadBy) lines.push({ text: 'RMB put a lead on it', color: C.faint });
      }
    } else if (c.block && c.block.id !== B.air) {
      const b = c.block;
      let label = b.label;
      if (b.interact === 'door') label += game.world.getState(c.x, c.y, c.z) ? ' (open)' : ' (closed)';
      if (b.interact === 'torch') label += game.world.getState(c.x, c.y, c.z) ? ' (lit)' : ' (out)';
      const locked = b.interact === 'container' && game.chestLocked && game.chestLocked(c.x, c.y, c.z);
      if (locked) label += ' (locked)';
      // Something set down: what it is (and whose).
      const got = b.id === B.placed_item && game.placed ? game.placed.get(`${c.x},${c.y},${c.z}`) : null;
      if (got) label = `${ITEMS[got.item]?.name || got.item}${got.count > 1 ? ` x${got.count}` : ''}${game.placedOwnerName ? game.placedOwnerName(got) : ''}`;
      lines.push({ text: label, color: c.inReach ? C.hi : C.dim });
      if (got && got.meal && got.eating) lines.push({ text: 'someone\'s meal', color: C.faint });
      const hints = [];
      if (locked) hints.push(countItem(game.player.inv, 'lockpick') ? 'click pick the lock' : 'needs a lockpick');
      else if (b.interact) hints.push(`click ${interactVerb(b.interact)}`);
      // (With something to set in your hand, a click sets it: it's not
      // dug.)
      if (c.place) {
        if (c.place.ok) hints.push(c.place.y === c.y ? 'click set it here' : c.place.y > c.y ? 'click set it on top' : 'click set it below');
      } else if (b.interact === 'container' && game.unbreakableChest && game.unbreakableChest(c.x, c.y, c.z)) {
        hints.push('can\'t be broken (the town\'s)');
      } else if (isFinite(b.hardness) && !b.liquid) {
        const plan = game.digPlan ? game.digPlan(c) : null;
        hints.push(!plan ? 'hold mine' : plan.kind === 'step' ? (plan.extra.length ? 'hold cut a step up' : 'step ready: walk up') : 'hold dig through (2 high)');
        // (Beside you, a wall: how to climb it.)
        if (!(plan && plan.kind === 'step') && game.stepCut && game.stepCut(c)?.extra.length) hints.push('Shift+hold: a step up');
      }
      if (hints.length) lines.push({ text: hints.join(' · '), color: C.faint });
      // The tool that breaks it best is shown as a picture (marked when
      // it's the one in your hand).
      let tool = null;
      if (c.place) tool = null;
      else if (isFinite(b.hardness) && !b.liquid && b.tool) {
        const h = game.player.heldDef();
        const held = h && h.kind === 'tool' && h.tool === b.tool ? game.player.heldItem() : null;
        tool = { icon: held || BEST_TOOL[b.tool], held: !!held };
      } else if (!isFinite(b.hardness)) lines.push({ text: 'Can\'t be broken', color: C.faint });
      if (game.mining && game.mining.x === c.x && game.mining.y === c.y && game.mining.z === c.z) {
        const n = Math.floor(game.mining.progress * 10);
        lines.push({ text: '[' + '▓'.repeat(n) + '░'.repeat(10 - n) + ']', color: C.orange });
      }
      // Out of reach: the box goes red.
      this.tooltip = { lines, tool, far: !c.inReach };
    }
    // Holding something to place: say why it won't go there (too far shows
    // as the red box too).
    if (c.place && !c.place.ok && c.place.why) {
      if (c.place.why !== 'too far') lines.push({ text: `Can't place: ${c.place.why}`, color: C.red });
      else if (this.tooltip && this.tooltip.lines === lines) this.tooltip.far = true;
    }
    if (lines.length && !(this.tooltip && this.tooltip.lines === lines)) this.tooltip = { lines };
    // Weapon in hand: just what it is (no hints, no tool), small and see-
    // through, so it's not in the way of a fight.
    const hd = game.player.heldDef();
    if (this.tooltip && this.tooltip.lines === lines && hd && hd.kind === 'weapon') {
      const keep = lines.filter((l) => l.color !== C.faint).slice(0, 2);
      this.tooltip = { lines: keep.length ? keep : lines.slice(0, 1), far: this.tooltip.far, faint: true };
    }
  }

  renderMinimap(game) {
    const cv = this.minimap;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cv.width, cv.height);
    const p = game.player;
    const w = game.world;
    const W2 = cv.width >> 1;
    const H2 = cv.height >> 1;
    const r = game.renderer;
    const turn = (du, dv) => (r.toWorld ? r.toWorld(du, dv) : [du, dv]);
    this.minimapView = r.view || 0;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const [ox, oz] = turn(x - W2, y - H2);
        const wx = p.x + ox;
        const wz = p.z + oz;
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
      const [u, v] = r.toView ? r.toView(wx - p.x, wz - p.z) : [wx - p.x, wz - p.z];
      const x = u + W2;
      const y = v + H2;
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return;
      const i = (y * cv.width + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
    };
    for (const n of game.npcs) if (!n.dead) dot(n.x, n.z, n.state === 'fight' ? [255, 60, 60] : [255, 230, 120]);
    for (const c of game.creatures) dot(c.x, c.z, c.hostileNow ? [255, 60, 60] : [200, 200, 200]);
    // Down a dungeon, the stairs you've found: a bright ring round them
    // (gold for the way on down, pale for the way back up).
    if (game.dungeon && game.dungeon.knownStairs) {
      for (const s of game.dungeon.knownStairs()) {
        const col = s.down ? [255, 210, 80] : [170, 220, 255];
        for (const [dx, dz] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) dot(s.x + dx, s.z + dz, col);
        dot(s.x, s.z, [255, 255, 255]);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  drawMinimapImage(ctx) {
    if (!this.minimapPos) return;
    const { x, y } = this.minimapPos;
    ctx.drawImage(this.minimap, x, y);
    // Which way is north, however the camera is turned.
    const nv = this.minimapView || 0;
    const [nx, ny] = [[x + 39, y + 1], [x + 1, y + 16], [x + 39, y + 31], [x + 78, y + 16]][[0, 3, 2, 1][nv]];
    drawText(ctx, 'N', nx, ny, '#ffe070', '#000');
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
  openWait() {
    this.open(new W.WaitWindow(this, this.game));
  }
  openNews() {
    this.closeAll();
    this.open(new W.NewsWindow(this, this.game));
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
  openDeath(cause, below = null) {
    this.closeAll();
    this.open(new W.DeathWindow(this, cause, below));
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
