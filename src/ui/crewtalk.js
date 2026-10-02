// Talking to the crew of the ship that brought you (the crash-landing
// opening: see game/cutscene.js). Like talking to anyone in town, but
// shorter: who they are, what they say to you, and a few things to ask.
import { ROWS, CHAR_W, CHAR_H } from '../config.js';
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { humanoidSheet, SPR_PAD, SHEET_H } from '../render/sprites.js';

export class CrewWindow extends Window {
  constructor(ui, crew, scene) {
    super(ui, 72, 17, { kind: 'crew', y: ROWS - 18 });
    this.crew = crew;
    this.scene = scene;
    this.queue = [];
    this.line = crew.talk.hello();
    this.chars = 0;
    this.asked = new Set();
  }

  next() {
    this.line = this.queue.length ? this.queue.shift() : this.line;
    this.line = this.line.charAt(0).toUpperCase() + this.line.slice(1);
    this.chars = 0;
  }

  options() {
    return [...this.crew.talk.topics, { id: 'bye', label: 'Farewell.' }];
  }

  choose(o, game) {
    if (o.id === 'bye') {
      this.close();
      return;
    }
    game?.audio?.play('select');
    this.asked.add(o.id);
    this.queue = [...o.say()];
    this.next();
  }

  draw(g) {
    const c = this.crew;
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true });
    g.box(1, 1, 5, 5, { fg: C.faint });
    this.portraitPos = { x: (this.x + 2) * CHAR_W + 1, y: (this.y + 2) * CHAR_H - 4 };
    g.text(7, 1, c.name, C.hi);
    g.text(7, 2, `${c.role} of the ${this.scene.shipName}`, C.cyan);
    g.text(7, 4, 'At sea, two days out', C.faint);
    const line = this.line || '...';
    const shown = line.slice(0, Math.floor(this.chars));
    const wl = wrap(shown, this.w - 6);
    wl.slice(0, 3).forEach((l, k) => g.text(3, 6 + k, (k === 0 ? '"' : ' ') + l + (k === wl.length - 1 && this.chars >= line.length ? '"' : ''), C.white));
    if (this.queue.length && this.chars >= line.length) g.text(this.w - 12, 9, '[SPACE] ►', Math.floor(this.ui.time * 3) % 2 ? C.hi : C.dim);
    g.text(2, 10, '─'.repeat(this.w - 4), C.faint);
    const opts = this.options();
    this.opts = opts;
    opts.forEach((o, i) => {
      const y = 11 + i;
      if (y >= this.h - 2) return;
      const hov = this.hovering(2, y, this.w - 4, 1);
      g.fill(2, y, this.w - 4, 1, ' ', C.fg, hov ? C.bgHi : undefined);
      g.text(2, y, String(i + 1), C.hi);
      g.text(4, y, o.label, hov ? C.white : o.id === 'bye' ? C.dim : this.asked.has(o.id) ? C.gray : C.fg);
      this.hit(2, y, this.w - 4, 1, (ck, gm) => this.choose(o, gm));
    });
    g.text(2, this.h - 1, ' 1-9 choose · SPACE continue · ESC leave ', C.faint);
  }

  drawPixels(ctx) {
    const sheet = humanoidSheet(this.crew.look);
    ctx.drawImage(sheet, 0, 0, 16, SHEET_H, this.portraitPos.x, this.portraitPos.y - SPR_PAD, 16, SHEET_H);
  }

  update(dt, game) {
    this.chars += dt * 60;
    if (!game || this.scene.phase !== 'calm' || this.crew.distTo(game.player) > 5) this.close();
  }

  onKey(k, game) {
    if (k.code === 'Space' || k.code === 'Enter' || k.code === 'NumpadEnter') {
      if (this.chars < this.line.length) this.chars = this.line.length;
      else if (this.queue.length) this.next();
      return true;
    }
    const m = /^Digit(\d)$/.exec(k.code) || /^Numpad(\d)$/.exec(k.code);
    if (m) {
      const o = this.opts && this.opts[+m[1] - 1];
      if (o) this.choose(o, game);
      return true;
    }
    return false;
  }
}
