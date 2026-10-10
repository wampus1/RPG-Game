// The Ancient Technology Tree: what a realm can learn from the Kavorent's
// cores (see sim/ancient.js). Nothing like the realm's own tree: a field of
// slow stars and drifting glyphs, a core of cold light in the middle with
// rings of light round it, each art a six-sided seal on a ring, joined to
// what it needs by lines that pulse with light running outward. Hover a
// seal for what it does; click it to see it at the side, and to put it to
// the council if the realm has the cores.
import { CHAR_W, CHAR_H } from '../config.js';
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { ANCIENT, ANCIENT_IDS } from '../sim/ancient.js';
import { countItem } from '../game/inventory.js';

const PANEL = 30;
const RX = 68; // ring spacing across, px
const RY = 36; // and up and down
const SEAL = 11;

// Can the player see it at all? (Only with a core in hand, or having given
// the realm one.)
export function canSeeAncient(game, s) {
  if (countItem(game.player.inv, 'kav_core') > 0) return true;
  const st = game.sim.ancient.state[game.sim.ancient.key(s)];
  return !!(st && st.byYou > 0);
}

// A glyph, 5x5 bits (drawn at any size).
const GLYPHS = [
  [0b01110, 0b10001, 0b11111, 0b10001, 0b01110],
  [0b11111, 0b00100, 0b01110, 0b00100, 0b11111],
  [0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
  [0b00100, 0b01110, 0b10101, 0b00100, 0b01110],
  [0b11100, 0b10010, 0b11100, 0b10000, 0b11110],
  [0b00001, 0b00011, 0b00111, 0b01111, 0b11111],
];
function glyph(ctx, g, x, y, k) {
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (GLYPHS[g % GLYPHS.length][r] & (1 << (4 - c))) ctx.fillRect(Math.round(x + c * k), Math.round(y + r * k), Math.ceil(k), Math.ceil(k));
}

export class AncientWindow extends Window {
  constructor(ui, game, s, back = null) {
    super(ui, 85, 36, { kind: 'ancient', x: 0, y: 0 });
    this.game = game;
    this.s = s;
    this.back = back;
    this.closeOnOutside = false;
    this.sel = null;
    this.hover = null;
    this.t = 0;
    // The drifting stars and glyphs behind it all.
    this.motes = Array.from({ length: 70 }, (_, i) => ({ x: Math.random(), y: Math.random(), v: 0.004 + Math.random() * 0.01, g: i % 6, big: Math.random() < 0.15, ph: Math.random() * 6 }));
  }
  area() {
    const panel = this.sel ? PANEL : 0;
    return { x0: (this.x + 1) * CHAR_W, y0: (this.y + 3) * CHAR_H, x1: (this.x + this.w - 1 - panel) * CHAR_W, y1: (this.y + this.h - 2) * CHAR_H };
  }
  centre() {
    const a = this.area();
    return { x: Math.round((a.x0 + a.x1) / 2), y: Math.round((a.y0 + a.y1) / 2) + 2 };
  }
  pos(id) {
    const A = ANCIENT[id];
    const o = this.centre();
    const ang = ((A.ang - 90) * Math.PI) / 180 + Math.sin(this.t * 0.05) * 0.02;
    return { x: Math.round(o.x + Math.cos(ang) * A.ring * RX), y: Math.round(o.y + Math.sin(ang) * A.ring * RY) };
  }
  status(st, id) {
    if (st.done.includes(id)) return 'done';
    if (!this.game.sim.ancient.ready(st, id)) return 'locked';
    return st.cores >= ANCIENT[id].cost ? 'afford' : 'open';
  }
  nodeAt(mx, my) {
    for (const id of ANCIENT_IDS) {
      const q = this.pos(id);
      if (Math.hypot(q.x - mx, q.y - my) <= SEAL + 3) return id;
    }
    return null;
  }
  update(dt) {
    this.t += dt;
    for (const m of this.motes) {
      m.y -= m.v * dt * 6;
      if (m.y < 0) {
        m.y = 1;
        m.x = Math.random();
      }
    }
  }
  onClick(ck) {
    if (ck.button !== 0) return true;
    const id = this.nodeAt(ck.x, ck.y);
    if (id) {
      this.sel = id;
      this.ui.audio?.play('select');
    } else {
      const a = this.area();
      if (ck.x >= a.x0 && ck.x < a.x1 && ck.y >= a.y0 && ck.y < a.y1) this.sel = null;
    }
    return true;
  }
  commission() {
    const A = this.game.sim.ancient;
    if (!this.sel) return;
    if (A.buy(this.s, this.sel, this.game.playerName)) {
      this.ui.audio?.play('rune');
      this.flash = 1;
    } else this.ui.audio?.play('error');
  }
  onKey(k) {
    if (k.code === 'KeyT' && this.back) {
      this.close();
      this.ui.open(this.back());
    } else if (k.code === 'Enter' && this.sel) this.commission();
    else return false;
    return true;
  }
  draw(g, game) {
    const s = this.s;
    const A = game.sim.ancient;
    const st = A.stateOf(s);
    g.box(0, 0, this.w, this.h, { bg: 'rgba(4,6,14,0.98)', double: true, title: '♦ ANCIENT TECHNOLOGY ♦', fg: '#5ad8f0' });
    const realm = s.civ ? s.civ.name.replace(/^The /, '') : `free town of ${s.name}`;
    g.center(1, `${realm.toUpperCase()} · WHAT THE KAVORENT LEFT`, '#a8f4ff');
    const cores = `Cores held: ${'♦'.repeat(Math.min(12, st.cores))}${st.cores > 12 ? `+${st.cores - 12}` : ''}${st.cores ? '' : 'none'}`;
    g.text(2, 2, cores, st.cores ? '#7ae0ff' : C.dim);
    const n = `${st.done.length} of ${ANCIENT_IDS.length} mastered`;
    g.text(this.w - 2 - n.length - (this.sel ? PANEL : 0), 2, n, '#3a8aa0');
    const m = this.ui.mouse;
    this.hover = m ? this.nodeAt(m.x, m.y) : null;
    if (this.hover) {
      const a = ANCIENT[this.hover];
      const stt = this.status(st, this.hover);
      const lines = [{ text: a.name, color: '#a8f4ff' }, { text: `${a.cost} core${a.cost === 1 ? '' : 's'} · ${STATUS[stt]}`, color: STATUS_COLOR[stt] }];
      for (const l of wrap(a.desc, 36)) lines.push({ text: l, color: C.white });
      this.ui.tooltip = { lines };
    }
    if (!this.sel) return;
    const id = this.sel;
    const a = ANCIENT[id];
    const x0 = this.w - 1 - PANEL;
    g.fill(x0, 3, PANEL, this.h - 5, ' ', C.fg, 'rgba(6,14,24,0.98)');
    for (let y = 3; y < this.h - 2; y++) g.put(x0, y, '║', '#1e5060');
    let y = 4;
    const line = (txt, col = C.fg) => {
      for (const l of wrap(txt, PANEL - 3)) {
        if (y < this.h - 4) g.text(x0 + 2, y, l, col);
        y++;
      }
    };
    line(a.name.toUpperCase(), '#a8f4ff');
    line(`Ring ${a.ring} · ${a.cost} core${a.cost === 1 ? '' : 's'}`, '#3a8aa0');
    y++;
    const stt = this.status(st, id);
    const when = st.log.find((q) => q.id === id);
    if (stt === 'done') line(when ? `Mastered on day ${Math.max(1, when.day)}${when.who ? `, at ${when.who === game.playerName ? 'your' : `${when.who}'s`} urging` : ''}` : 'Mastered', '#7affc8');
    else if (stt === 'locked') line(`Needs ${a.req.filter((r) => !st.done.includes(r)).map((r) => ANCIENT[r].name).join(' and ')} first`, C.orange);
    else if (stt === 'open') line(`The realm needs ${a.cost - st.cores} more core${a.cost - st.cores === 1 ? '' : 's'} for it`, C.orange);
    else line('The realm has the cores for it', '#7ae0ff');
    y++;
    line(a.desc, C.white);
    y++;
    const next = ANCIENT_IDS.filter((k) => ANCIENT[k].req.includes(id));
    if (next.length) line(`Leads to: ${next.map((k) => ANCIENT[k].name).join(', ')}`, '#3a8aa0');
    if (stt === 'afford') {
      const bx = x0 + 2;
      const by = this.h - 4;
      const label = ` ♦ PUT IT TO THE COUNCIL ♦ `;
      const hov = this.hovering(bx, by, label.length, 1);
      g.text(bx, by, label, hov ? '#000000' : '#a8f4ff', hov ? '#7ae0ff' : '#0e3040');
      this.hit(bx, by, label.length, 1, () => this.commission());
    }
  }
  drawPixels(ctx, game) {
    const st = game.sim.ancient.stateOf(this.s);
    const a = this.area();
    const t = this.t;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    ctx.clip();
    // Deep space, darker at the edges.
    const bg = ctx.createRadialGradient(this.centre().x, this.centre().y, 10, this.centre().x, this.centre().y, Math.max(a.x1 - a.x0, a.y1 - a.y0) * 0.7);
    bg.addColorStop(0, '#0a1a2a');
    bg.addColorStop(1, '#020308');
    ctx.fillStyle = bg;
    ctx.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    // Stars and glyphs drifting up.
    for (const m of this.motes) {
      const x = a.x0 + m.x * (a.x1 - a.x0);
      const y = a.y0 + m.y * (a.y1 - a.y0);
      const tw = 0.4 + 0.4 * Math.sin(t * 2 + m.ph);
      ctx.globalAlpha = tw * (m.big ? 0.35 : 0.5);
      ctx.fillStyle = m.big ? '#5ad8f0' : '#c8fbff';
      if (m.big) glyph(ctx, m.g, x, y, 1);
      else ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
    // The rings of light round the core, turning slowly, dashed.
    const o = this.centre();
    for (let r = 1; r <= 3; r++) {
      ctx.save();
      ctx.strokeStyle = `rgba(90,216,240,${0.18 - r * 0.03})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2 + r, 5]);
      ctx.lineDashOffset = -t * (6 - r) * (r % 2 ? 1 : -1);
      ctx.beginPath();
      ctx.ellipse(o.x + 0.5, o.y + 0.5, r * RX, r * RY, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Paths: from the core (or what it needs) to each seal; bright and
    // pulsing outward where mastered, dim where waiting.
    for (const id of ANCIENT_IDS) {
      const to = this.pos(id);
      const froms = ANCIENT[id].req.length ? ANCIENT[id].req.map((r) => this.pos(r)) : [o];
      const stt = this.status(st, id);
      for (const f of froms) {
        ctx.strokeStyle = stt === 'done' ? 'rgba(122,224,255,0.75)' : stt === 'locked' ? 'rgba(60,90,110,0.35)' : 'rgba(90,216,240,0.4)';
        ctx.lineWidth = stt === 'done' ? 2 : 1;
        if (stt !== 'done') ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(f.x + 0.5, f.y + 0.5);
        ctx.lineTo(to.x + 0.5, to.y + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        if (stt === 'done' || stt === 'afford') {
          // A bead of light running along it.
          const k = (t * 0.6 + id.length * 0.13) % 1;
          ctx.fillStyle = stt === 'done' ? '#ffffff' : '#a8f4ff';
          ctx.globalAlpha = 0.9;
          ctx.fillRect(Math.round(f.x + (to.x - f.x) * k) - 1, Math.round(f.y + (to.y - f.y) * k) - 1, 3, 3);
          ctx.globalAlpha = 1;
        }
      }
    }
    // The core itself: a sphere of cold light with a slow inner swirl.
    const R = 18 + Math.sin(t * 1.7) * 1.5;
    const halo = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, R * 2.4);
    halo.addColorStop(0, 'rgba(200,251,255,0.9)');
    halo.addColorStop(0.35, 'rgba(90,216,240,0.45)');
    halo.addColorStop(1, 'rgba(90,216,240,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(o.x - R * 2.5, o.y - R * 2.5, R * 5, R * 5);
    ctx.fillStyle = '#0e2a38';
    ctx.beginPath();
    ctx.arc(o.x, o.y, R * 0.8, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const ang = t * (0.8 + i * 0.3) + i * 2.1;
      ctx.strokeStyle = `rgba(168,244,255,${0.7 - i * 0.15})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, R * 0.75, R * 0.28, ang, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(o.x, o.y, 3 + Math.sin(t * 3) * 0.8, 0, Math.PI * 2);
    ctx.fill();
    // The seals.
    for (const id of ANCIENT_IDS) {
      const p = this.pos(id);
      const A = ANCIENT[id];
      const stt = this.status(st, id);
      const sel = this.sel === id;
      const hov = this.hover === id;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + A.ang);
      const r = SEAL + (sel ? 2 : 0) + (hov ? 1 : 0);
      if (stt === 'done' || stt === 'afford') {
        const gl = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r * 2.2);
        gl.addColorStop(0, stt === 'done' ? 'rgba(122,224,255,0.55)' : `rgba(255,255,255,${0.25 + pulse * 0.3})`);
        gl.addColorStop(1, 'rgba(90,216,240,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(p.x - r * 2.3, p.y - r * 2.3, r * 4.6, r * 4.6);
      }
      // Six-sided.
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const x = p.x + Math.cos(ang) * r;
        const y = p.y + Math.sin(ang) * r;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = stt === 'done' ? '#0e3a4a' : stt === 'locked' ? '#0a1118' : '#0c2230';
      ctx.fill();
      ctx.strokeStyle = stt === 'done' ? '#a8f4ff' : stt === 'afford' ? (pulse > 0.5 ? '#ffffff' : '#7ae0ff') : stt === 'open' ? '#3a8aa0' : '#24384a';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = stt === 'done' ? '#c8fbff' : stt === 'locked' ? '#2a4050' : '#5ad8f0';
      glyph(ctx, A.glyph, p.x - 5, p.y - 5, 2);
      // Its cost in small diamonds under it.
      for (let i = 0; i < A.cost; i++) {
        ctx.fillStyle = stt === 'done' ? '#3a8aa0' : i < st.cores ? '#7ae0ff' : '#24384a';
        const dx = p.x - (A.cost - 1) * 3 + i * 6;
        ctx.beginPath();
        ctx.moveTo(dx, p.y + r + 3);
        ctx.lineTo(dx + 2, p.y + r + 5);
        ctx.lineTo(dx, p.y + r + 7);
        ctx.lineTo(dx - 2, p.y + r + 5);
        ctx.fill();
      }
    }
    // Just mastered: a flash of light through it all.
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.5;
      ctx.fillStyle = '#c8fbff';
      ctx.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
      ctx.globalAlpha = 1;
      this.flash = Math.max(0, this.flash - 0.04);
    }
    ctx.restore();
  }
}

const STATUS = { done: 'mastered', afford: 'the cores are there for it', open: 'not cores enough yet', locked: 'needs another art first' };
const STATUS_COLOR = { done: '#7affc8', afford: '#7ae0ff', open: C.orange, locked: C.dim };
