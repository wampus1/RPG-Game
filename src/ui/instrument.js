// Playing an instrument (round 51; see game/instruments.js): a strip along
// the bottom of the screen with the instrument's keys on it, each with the
// note (or the stroke) it plays. While it's up you stand still: its keys
// play notes and nothing else does anything, but ESC (put it away) and the
// mouse (click a key to play it).
import { ROWS, CHAR_W, CHAR_H } from '../config.js';
import { Window } from './window.js';
import { C } from './ascii.js';
import { INSTRUMENTS, InstrumentVoice, keyLabel } from '../game/instruments.js';
import { itemIcon } from '../render/sprites.js';

const BG = '#14101c';
const PRAISE = ['Lovely tune!', 'Play another!', 'Oh, I know this one.', 'Lovely.', 'You play well.', 'Bravo!', '*hums along*', '*claps*'];
const NOTE_COLS = ['#ffe070', '#a0e0ff', '#c0a0ff', '#90f0a0', '#ffb0c0'];

export class InstrumentWindow extends Window {
  constructor(ui, game, key) {
    const I = INSTRUMENTS[key];
    const w = Math.max(44, I.keys.length * 6 + 14);
    // (Above the belt, which stays in sight.)
    super(ui, w, 8, { kind: 'instrument', y: ROWS - 13 });
    this.game = game;
    this.key = key;
    this.I = I;
    this.lit = I.keys.map(() => 0);
    this.notes = 0;
    this.voice = new InstrumentVoice(ui.music);
  }

  draw(g) {
    const I = this.I;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, BG);
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, title: `PLAYING THE ${I.name.toUpperCase()}` });
    // The keys: a box each, the key to press over what it plays.
    const x0 = 10;
    I.keys.forEach((code, i) => {
      const x = x0 + i * 6;
      const on = this.lit[i] > 0;
      const hov = this.hovering(x, 2, 5, 3);
      g.fill(x, 2, 5, 3, ' ', C.fg, on ? '#5a4a20' : hov ? '#2e2840' : '#201a2c');
      g.text(x, 2, '┌───┐', on ? C.hi : C.dim);
      g.text(x + 2, 3, I.labels[i], on ? C.white : C.hi);
      const lab = keyLabel(I, i).slice(0, 5);
      g.text(x + Math.floor((5 - lab.length) / 2), 4, lab, on ? C.hi : C.faint);
      this.hit(x, 2, 5, 3, () => this.play(i));
    });
    g.center(this.h - 2, 'Press the keys (or click them) to play · ESC: put it away', C.faint);
  }

  drawPixels(ctx) {
    // The instrument itself, at the left.
    const ox = this.x * CHAR_W;
    const oy = this.y * CHAR_H;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const bob = this.lit.some((q) => q > 0) ? -1 : 0;
    ctx.drawImage(itemIcon(this.key), ox + 2 * CHAR_W, oy + 2 * CHAR_H + bob, 32, 32);
    ctx.restore();
  }

  update(dt, game) {
    for (let i = 0; i < this.lit.length; i++) if (this.lit[i] > 0) this.lit[i] -= dt;
    // (Put down, or dropped: the playing stops.)
    const held = game && game.player && game.player.heldDef();
    if (!held || held.key !== this.key || game.player.dead) this.close();
  }

  play(i) {
    const g = this.game;
    const p = g.player;
    this.voice.play(this.key, i);
    this.lit[i] = 0.18;
    this.notes++;
    p.doAction?.(0.12);
    // A note floating up off you; now and then someone near says so.
    g.renderer.floatText(p.x + (Math.random() - 0.5) * 0.6, p.y + 2.2, p.z, this.I.drums ? '♦' : '♪', NOTE_COLS[i % NOTE_COLS.length]);
    if (this.notes % 14 === 0) {
      const near = (g.npcs || []).filter((n) => !n.dead && n.state !== 'fight' && n.distTo(p) <= 7);
      const n = near[Math.floor(Math.random() * near.length)];
      if (n && n.say) n.say(PRAISE[Math.floor(Math.random() * PRAISE.length)], 2.2, '#ffe0a0');
    }
  }

  onKey(k) {
    if (k.code === 'Escape') {
      this.close();
      return true;
    }
    const i = this.I.keys.indexOf(k.code);
    if (i >= 0 && !k.repeat) this.play(i);
    // (Every other key does nothing while you play.)
    return true;
  }

  close() {
    this.voice.dispose();
    super.close();
  }
}
