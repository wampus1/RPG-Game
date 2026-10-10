// (Round 78) The line you type to the others in a shared world (Enter),
// and what's been said, on the screen (see net/chat.js for the channels).
// Tab: the next channel. Enter: said. Escape: never mind.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { COLS, ROWS } from '../config.js';
import { CHANNELS, CHANNEL_OF, parseLine, heard } from '../net/chat.js';

export class ChatWindow extends Window {
  constructor(ui) {
    super(ui, 46, 3, { kind: 'chat', x: COLS - 48, y: ROWS - 8, modal: true });
    this.text = '';
    this.ch = ui.chatCh || 'global';
    this.closeOnOutside = true;
  }
  draw(g) {
    const C0 = CHANNEL_OF[this.ch];
    g.fill(0, 0, this.w, this.h, ' ', C.fg, 'rgba(8,10,14,0.92)');
    g.box(0, 0, this.w, this.h, { bg: 'rgba(8,10,14,0.92)', title: `SAY · ${C0.name.toUpperCase()} · TAB` });
    const blink = Math.floor(this.ui.time * 2) % 2 ? '█' : ' ';
    const tag = `[${C0.tag}] `;
    g.text(1, 1, tag, C0.color);
    g.text(1 + tag.length, 1, `${this.text}`.slice(-(this.w - 3 - tag.length)) + blink, C.white);
  }
  say() {
    const game = this.ui.game;
    const line = parseLine(this.text, this.ch);
    this.text = '';
    if (!line || !game) return this.close();
    this.ui.chatCh = this.ch = line.ch;
    if (game.remote && game.remote.chat) game.remote.chat(line.ch, line.text);
    else if (game.net && game.net.chat) game.net.chat(null, line.ch, line.text);
    // (On your own, it's only you: kept, to read back.)
    else heard(this.ui, { ch: line.ch, text: line.text, from: 'You' });
    this.close();
  }
  onKey(k) {
    if (k.code === 'Escape') this.close();
    else if (k.code === 'Enter' || k.code === 'NumpadEnter') this.say();
    else if (k.code === 'Backspace') this.text = this.text.slice(0, -1);
    else if (k.code === 'Tab') {
      const i = CHANNELS.findIndex((c) => c.id === this.ch);
      this.ui.chatCh = this.ch = CHANNELS[(i + 1) % CHANNELS.length].id;
    } else if (k.key && k.key.length === 1 && !k.ctrl && this.text.length < 160) this.text += k.key;
    return true;
  }
}

// What's been said lately, over the belt on the right (all of it a while
// with the line open to type in).
export function drawChat(ui, g, x, yBottom, open) {
  const log = ui.chatLog;
  if (!log || !log.length) return;
  const now = ui.time || 0;
  const W = COLS - x - 2;
  let y = yBottom;
  for (let i = log.length - 1; i >= 0 && y > yBottom - (open ? 12 : 7); i--) {
    const l = log[i];
    const age = now - l.t;
    if (!open && age > 20) break;
    const C0 = CHANNEL_OF[l.ch] || CHANNELS[0];
    const lines = wrap(`[${C0.tag}] ${l.from}: ${l.text}`, W);
    for (let j = lines.length - 1; j >= 0 && y > yBottom - (open ? 12 : 7); j--) {
      g.text(x, y, lines[j], !open && age > 17 ? C.faint : j === 0 ? C0.color : '#d8d8e0', 'rgba(10,8,16,0.55)');
      y--;
    }
  }
}
