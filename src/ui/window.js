// Base class for UI windows (split out to avoid circular imports).
import { COLS, ROWS } from '../config.js';
import { Grid } from './ascii.js';

export class Window {
  constructor(ui, w, h, opts = {}) {
    this.ui = ui;
    this.w = w;
    this.h = h;
    this.x = opts.x ?? Math.floor((COLS - w) / 2);
    this.y = opts.y ?? Math.floor((ROWS - h) / 2);
    this.grid = new Grid(w, h);
    this.modal = opts.modal ?? true;
    this.kind = opts.kind || 'window';
    this.p = 0;
    this.state = 'opening';
    this.seed = (Math.random() * 1e9) | 0;
    this.hits = [];
  }
  draw() {}
  onKey() {
    return false;
  }
  onClick(ck, cx, cy, game) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (cx >= h.x && cy >= h.y && cx < h.x + h.w && cy < h.y + h.h) {
        h.fn(ck, game);
        return true;
      }
    }
    return true;
  }
  onWheel() {}
  update() {}
  hit(x, y, w, h, fn) {
    this.hits.push({ x, y, w, h, fn });
  }
  hovering(x, y, w, h) {
    const m = this.ui.mouseCell;
    const cx = m.x - this.x;
    const cy = m.y - this.y;
    return cx >= x && cy >= y && cx < x + w && cy < y + h;
  }
  contains(cx, cy) {
    return cx >= this.x && cy >= this.y && cx < this.x + this.w && cy < this.y + this.h;
  }
  close() {
    this.ui.close(this);
  }
}


export function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function describeActivity(e) {
  if (!e) return '';
  switch (e.act) {
    case 'sleep': return 'sleeping';
    case 'eat': return 'having a meal';
    case 'work': return 'working';
    case 'hobby': return e.hobby ? `hobby: ${e.hobby}` : 'relaxing';
    case 'social': return 'socializing';
    case 'wander': return 'out for a walk';
    case 'play': return 'playing';
    case 'study': return 'at lessons';
    case 'home': return 'at home';
    case 'mourn': return 'mourning at a grave';
    case 'funeral': return 'at a funeral';
    case 'build': return 'building a house';
    case 'forage': return 'looking for food';
    case 'trial': return 'at a hearing';
    case 'travel': return 'leaving on a journey';
    case 'visit': return 'selling wares';
    case 'sell': return 'selling the catch';
    case 'repair': return 'repairing the jail';
    case 'customer': return 'coming to buy from you';
    case 'confront': return 'looking for you';
    default: return e.act;
  }
}
