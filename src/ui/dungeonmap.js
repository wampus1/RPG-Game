// (Round 73) The map of an old place, down there (M, below ground): the
// floor you're on as you've seen it, under a fog thicker than the world
// map's (what you've never come near is black; what you've seen and left
// is dim; what's round you now is lit), you blinking where you stand, the
// ways up and down and the master's gate where you've seen them; and down
// the right, its floors, to look at any you've been on (it turns to the
// floor you're on as you go up or down).
//   What you've seen is kept in the place's record (`rec.seenMap`, a hex
// string of bits a floor), so it's there when you come back.
import { CHAR_W, CHAR_H, COLS, ROWS } from '../config.js';
import { Window } from './window.js';
import { C } from './ascii.js';
import { buildFloor } from '../world/dungeongen.js';

const SEE_R = 6;
const PANEL = 20;
const bits = new Map();
const keyOf = (rec, f) => `${rec.id}:${f}`;

function decode(hexs, n) {
  const a = new Uint8Array(n);
  if (!hexs) return a;
  for (let i = 0; i < hexs.length && i * 4 < n; i++) {
    const v = parseInt(hexs[i], 16) || 0;
    for (let b = 0; b < 4; b++) if (v & (1 << b) && i * 4 + b < n) a[i * 4 + b] = 1;
  }
  return a;
}
function encode(a) {
  let s = '';
  for (let i = 0; i < a.length; i += 4) s += (a[i] | (a[i + 1] << 1) | (a[i + 2] << 2) | (a[i + 3] << 3)).toString(16);
  return s;
}
// What's been seen of a floor (made from the record the first time).
export function seenOf(rec, f, n) {
  const k = keyOf(rec, f);
  let a = bits.get(k);
  if (!a || a.length !== n) {
    a = decode(rec.seenMap && rec.seenMap[f], n);
    bits.set(k, a);
  }
  return a;
}
export function hasSeen(rec, f) {
  return !!(rec.seenMap && rec.seenMap[f]) || bits.has(keyOf(rec, f));
}

// Each moment down there: what's round you, seen (from DungeonRun.update).
export function noteSeen(run, p, dt) {
  const D = run.data;
  const P = D && D.plan;
  if (!P || !p) return;
  const a = seenOf(run.rec, run.floor, P.W * P.D);
  const lx = Math.round(p.x - D.x0);
  const lz = Math.round(p.z - (D.z0 || 0));
  let any = false;
  for (let dz = -SEE_R; dz <= SEE_R; dz++) {
    for (let dx = -SEE_R; dx <= SEE_R; dx++) {
      if (dx * dx + dz * dz > SEE_R * SEE_R) continue;
      const x = lx + dx;
      const z = lz + dz;
      if (x < 0 || z < 0 || x >= P.W || z >= P.D) continue;
      const i = z * P.W + x;
      if (!a[i]) {
        a[i] = 1;
        any = true;
      }
    }
  }
  run.seenDirty = run.seenDirty || any;
  run.seenT = (run.seenT || 0) + dt;
  if (run.seenDirty && run.seenT > 1.5) flushSeen(run);
}
export function flushSeen(run) {
  const P = run.data && run.data.plan;
  if (!P) return;
  run.seenT = 0;
  run.seenDirty = false;
  (run.rec.seenMap ||= {})[run.floor] = encode(seenOf(run.rec, run.floor, P.W * P.D));
}

export class DungeonMapWindow extends Window {
  constructor(ui) {
    super(ui, COLS - 2, ROWS - 2, { kind: 'map' });
    const g = ui.game;
    this.floorShown = g && g.dungeon ? g.dungeon.floor : 0;
    this.lastRunFloor = this.floorShown;
    this.plans = new Map();
  }
  run() {
    return this.ui.game && this.ui.game.dungeon;
  }
  planOf(f) {
    const run = this.run();
    if (!run) return null;
    if (f === run.floor) return run.data;
    if (!this.plans.has(f)) {
      try {
        this.plans.set(f, buildFloor(run.rec, f, run.rx0));
      } catch {
        this.plans.set(f, null);
      }
    }
    return this.plans.get(f);
  }
  area() {
    return { x0: (this.x + 1) * CHAR_W, y0: (this.y + 1) * CHAR_H, x1: (this.x + this.w - PANEL - 1) * CHAR_W, y1: (this.y + this.h - 2) * CHAR_H };
  }
  update() {
    const run = this.run();
    if (!run) {
      this.close();
      return;
    }
    // (Up or down a floor: the map goes with you.)
    if (run.floor !== this.lastRunFloor) {
      this.lastRunFloor = run.floor;
      this.floorShown = run.floor;
    }
  }
  onKey(k) {
    const run = this.run();
    if (!run) return false;
    if (k.code === 'PageUp' || k.code === 'BracketLeft') this.pick(this.floorShown - 1);
    else if (k.code === 'PageDown' || k.code === 'BracketRight') this.pick(this.floorShown + 1);
    else if (/^Digit[1-9]$/.test(k.code)) this.pick(+k.code.slice(5) - 1);
    else return false;
    return true;
  }
  pick(f) {
    const run = this.run();
    if (!run || f < 0 || f >= run.rec.depth) return;
    if (f !== run.floor && !hasSeen(run.rec, f)) return;
    this.floorShown = f;
    this.ui.audio?.play('select');
  }
  draw(g, game) {
    const run = this.run();
    const name = run ? run.rec.name : 'below';
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: `MAP · ${String(name).toUpperCase()}` });
    for (let y = 1; y < this.h - 2; y++) g.text(1, y, ' '.repeat(this.w - PANEL - 2), '#000000', '#050408');
    if (!run) return;
    // The floors, down the right.
    const px = this.w - PANEL;
    g.text(px, 1, 'FLOORS', C.hi);
    for (let f = 0; f < run.rec.depth; f++) {
      const y = 3 + f * 2;
      if (y > this.h - 4) break;
      const here = f === run.floor;
      const seen = here || hasSeen(run.rec, f);
      const on = f === this.floorShown;
      const hov = seen && this.hovering(px, y, PANEL - 2, 1);
      g.fill(px, y, PANEL - 2, 1, ' ', C.fg, on ? '#3a2e1e' : hov ? '#2a2418' : '#141018');
      const label = `${f + 1}. ${seen ? (f === run.rec.depth - 1 ? 'The deepest' : `Floor ${f + 1}`) : '???'}${here ? ' @' : ''}`;
      g.text(px + 1, y, label.slice(0, PANEL - 3), !seen ? C.faint : on ? C.white : here ? C.cyan : C.fg);
      if (seen) this.hit(px, y, PANEL - 2, 1, () => this.pick(f));
    }
  }
  drawPixels(ctx, game) {
    const run = this.run();
    if (!run) return;
    const D = this.planOf(this.floorShown);
    const P = D && D.plan;
    const a = this.area();
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    ctx.clip();
    ctx.fillStyle = '#030205';
    ctx.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    if (!P) {
      ctx.restore();
      return;
    }
    const seen = seenOf(run.rec, this.floorShown, P.W * P.D);
    const s = Math.max(2, Math.floor(Math.min((a.x1 - a.x0 - 8) / P.W, (a.y1 - a.y0 - 8) / P.D)));
    const ox = Math.round((a.x0 + a.x1) / 2 - (P.W * s) / 2);
    const oy = Math.round((a.y0 + a.y1) / 2 - (P.D * s) / 2);
    const p = game.player;
    const here = this.floorShown === run.floor;
    const plx = p.x - D.x0;
    const plz = p.z - (D.z0 || 0);
    const open = (x, z) => x >= 0 && z >= 0 && x < P.W && z < P.D && P.open[z * P.W + x];
    const time = this.ui.time || 0;
    for (let z = 0; z < P.D; z++) {
      for (let x = 0; x < P.W; x++) {
        const i = z * P.W + x;
        if (!seen[i]) continue;
        const near = here && (x - plx) ** 2 + (z - plz) ** 2 <= SEE_R * SEE_R;
        if (P.open[i]) {
          const room = P.room ? P.room[i] : -1;
          ctx.fillStyle = near ? (room >= 0 ? '#8a7a5a' : '#6a6050') : room >= 0 ? '#3e3628' : '#2e2a24';
        } else if (open(x - 1, z) || open(x + 1, z) || open(x, z - 1) || open(x, z + 1)) ctx.fillStyle = near ? '#d8c8a0' : '#6a604c';
        else continue;
        ctx.fillRect(ox + x * s, oy + z * s, s, s);
      }
    }
    // The ways up and down, and the master's gate, where seen.
    const mark = (wx, wz, col) => {
      const x = Math.round(wx - D.x0);
      const z = Math.round(wz - (D.z0 || 0));
      if (x < 0 || z < 0 || x >= P.W || z >= P.D || !seen[z * P.W + x]) return;
      ctx.fillStyle = '#000';
      ctx.fillRect(ox + x * s - 1, oy + z * s - 1, s + 2, s + 2);
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * s, oy + z * s, s, s);
    };
    if (D.up) mark(D.up.x, D.up.z, '#80d0ff');
    for (const r of D.rooms || []) if (r.stairs && D.up && !(r.stairs.x + D.x0 === D.up.x && r.stairs.z === D.up.z)) mark(r.stairs.x + D.x0, r.stairs.z, '#ffd060');
    if (D.bossGate) mark(D.bossGate.x, D.bossGate.z, '#ff5040');
    // You.
    if (here && Math.floor(time * 3) % 2) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + Math.round(plx) * s - 1, oy + Math.round(plz) * s - 1, s + 2, s + 2);
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(ox + Math.round(plx) * s, oy + Math.round(plz) * s, s, s);
    }
    ctx.restore();
  }
}
