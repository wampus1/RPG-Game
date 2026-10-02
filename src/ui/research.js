// What the realm knows (the tree, from the mayor), and the study desk
// where a licensed researcher works at the problems the scholars set.
import { CHAR_W, CHAR_H } from '../config.js';
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { TECHS, BRANCHES, reqIds, rivalsOf } from '../sim/tech.js';
import { has as heroHas } from '../game/hero.js';
import { itemIcon } from '../render/sprites.js';
import { drawText, textWidth } from '../render/font.js';
import { AncientWindow, canSeeAncient } from './ancient.js';

const pct = (a, b) => Math.max(0, Math.min(100, Math.floor((a / Math.max(1, b)) * 100)));
const bar = (f, n) => '█'.repeat(Math.round(f * n)) + '░'.repeat(n - Math.round(f * n));

// ---------------------------------------------------------------- the tree
// The realm's learning as a map: its crest in the middle and four paths
// running out from it (Economy north, Warfare east, Law & Society south,
// Engineering west), each splitting into lines. A choice is two steps side
// by side, crossed through between them: learn one and the other is barred.
// The great works sit in gold rings. Every step is an icon on the path:
// point at it to see what it does, click it to fly in close with the details
// at the side. The wheel zooms, dragging moves the map.
const DIRS = { economy: [0, -1], warfare: [1, 0], society: [0, 1], engineering: [-1, 0] };
const LEG = 50; // distance between steps along a path (at zoom 1)
const SPREAD = 30; // how far a side line sits off the path
const NODE = 11; // node radius
const PANEL = 30; // side panel width (characters)

// Where each step sits on the map (zoom 1, origin at the crest).
export function techPos(id) {
  const t = TECHS[id];
  const [dx, dz] = DIRS[t.branch];
  const along = 26 + t.tier * LEG;
  return { x: dx * along - dz * t.side * SPREAD, y: dz * along + dx * t.side * SPREAD };
}

export class TechWindow extends Window {
  constructor(ui, game, s) {
    super(ui, 85, 36, { kind: 'tech', x: 0, y: 0 });
    this.game = game;
    this.s = s;
    this.closeOnOutside = false;
    this.cam = { x: 0, y: 0, z: 0.85 };
    this.goal = { x: 0, y: 0, z: 0.85 };
    this.sel = null;
    this.hover = null;
    this.drag = null;
    this.t = 0;
    const st = game.sim.tech.stateOf(s);
    // Open on what's being studied, if anything.
    if (st && st.current) this.focus(st.current, 1.1);
  }
  // The map's area on screen, in pixels.
  area() {
    const panel = this.sel ? PANEL : 0;
    return { x0: (this.x + 1) * CHAR_W, y0: (this.y + 3) * CHAR_H, x1: (this.x + this.w - 1 - panel) * CHAR_W, y1: (this.y + this.h - 2) * CHAR_H };
  }
  toScreen(p) {
    const a = this.area();
    const z = this.cam.z;
    return { x: Math.round((a.x0 + a.x1) / 2 + (p.x - this.cam.x) * z), y: Math.round((a.y0 + a.y1) / 2 + (p.y - this.cam.y) * z) };
  }
  toMap(sx, sy) {
    const a = this.area();
    return { x: this.cam.x + (sx - (a.x0 + a.x1) / 2) / this.cam.z, y: this.cam.y + (sy - (a.y0 + a.y1) / 2) / this.cam.z };
  }
  // The step under the mouse.
  nodeAt(mx, my) {
    const a = this.area();
    if (mx < a.x0 || mx >= a.x1 || my < a.y0 || my >= a.y1) return null;
    let best = null;
    for (const id of Object.keys(TECHS)) {
      const q = this.toScreen(techPos(id));
      const d = Math.hypot(q.x - mx, q.y - my);
      if (d <= NODE * this.cam.z + 3 && (!best || d < best.d)) best = { id, d };
    }
    return best ? best.id : null;
  }
  focus(id, z = 1.6) {
    const p = techPos(id);
    this.sel = id;
    this.goal = { x: p.x, y: p.y, z };
  }
  status(st, id) {
    if (st.done.includes(id)) return 'done';
    if (st.current === id) return 'current';
    const T = this.game.sim.tech;
    if (T.barred(st, id)) return 'barred';
    return T.ready(st, id) ? 'open' : 'locked';
  }
  update(dt) {
    this.t += dt;
    // The view eases toward where it's going.
    const k = Math.min(1, dt * 8);
    if (!this.drag) {
      this.cam.x += (this.goal.x - this.cam.x) * k;
      this.cam.y += (this.goal.y - this.cam.y) * k;
    }
    this.cam.z += (this.goal.z - this.cam.z) * k;
    // Dragging the map about (a press that barely moves is a click).
    const m = this.ui.mouse;
    if (!m) return;
    if (m.down && this.drag) {
      const dx = m.x - this.drag.x;
      const dy = m.y - this.drag.y;
      this.drag.moved = Math.max(this.drag.moved, Math.abs(dx) + Math.abs(dy));
      this.cam.x = this.drag.cx - dx / this.cam.z;
      this.cam.y = this.drag.cy - dy / this.cam.z;
      this.goal.x = this.cam.x;
      this.goal.y = this.cam.y;
    } else if (!m.down) {
      if (this.drag && this.drag.moved < 4) {
        const id = this.nodeAt(m.x, m.y);
        if (id) this.focus(id, Math.max(1.5, this.goal.z));
        else this.sel = null;
        this.ui.audio?.play('select');
      }
      this.drag = null;
    }
  }
  // A press on the map: the start of a drag (or, if it hardly moves, a
  // click on a step).
  onClick(ck) {
    const a = this.area();
    if (ck.button === 0 && ck.x >= a.x0 && ck.x < a.x1 && ck.y >= a.y0 && ck.y < a.y1) this.drag = { x: ck.x, y: ck.y, cx: this.cam.x, cy: this.cam.y, moved: 0 };
    return true;
  }
  onWheel(d) {
    const m = this.ui.mouse;
    const z0 = this.goal.z;
    const z1 = Math.max(0.5, Math.min(2.6, z0 * (d > 0 ? 1 / 1.18 : 1.18)));
    // Zoom toward the mouse.
    if (m) {
      const before = this.toMap(m.x, m.y);
      this.goal.z = z1;
      const a = this.area();
      this.goal.x = before.x - (m.x - (a.x0 + a.x1) / 2) / z1;
      this.goal.y = before.y - (m.y - (a.y0 + a.y1) / 2) / z1;
    } else this.goal.z = z1;
  }
  onKey(k) {
    const step = 40 / this.goal.z;
    if (k.code === 'ArrowLeft' || k.code === 'KeyA') this.goal.x -= step;
    else if (k.code === 'ArrowRight' || k.code === 'KeyD') this.goal.x += step;
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.goal.y -= step;
    else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.goal.y += step;
    else if (k.code === 'Equal' || k.code === 'NumpadAdd') this.goal.z = Math.min(2.6, this.goal.z * 1.18);
    else if (k.code === 'Minus' || k.code === 'NumpadSubtract') this.goal.z = Math.max(0.5, this.goal.z / 1.18);
    else if (k.code === 'Home' || k.code === 'Space') this.goal = { x: 0, y: 0, z: 0.85 };
    else if (k.code === 'Enter') this.close();
    else if (k.code === 'KeyT' && canSeeAncient(this.game, this.s)) this.openAncient();
    else return false;
    return true;
  }
  // Over to the Ancient Technology (with a way back).
  openAncient() {
    const ui = this.ui;
    const game = this.game;
    const s = this.s;
    this.close();
    ui.open(new AncientWindow(ui, game, s, () => new TechWindow(ui, game, s)));
    ui.audio?.play('rune');
  }
  draw(g, game) {
    const s = this.s;
    const T = game.sim.tech;
    const st = T.stateOf(s);
    const civ = s.civ;
    g.box(0, 0, this.w, this.h, { bg: 'rgba(10,9,16,0.97)', double: true, title: 'WHAT THE REALM KNOWS' });
    const who = T.leaderOf(s);
    const realm = civ ? civ.name.replace(/^The /, '') : `free town of ${s.name}`;
    g.center(1, `${realm.toUpperCase()}${who ? ` · ${who.name.first} ${who.name.last} decides what is studied` : ''}`, '#f0e0c0');
    const cur = st.current ? TECHS[st.current] : null;
    g.text(2, 2, cur ? `Studying ${cur.name} ${bar(st.progress / cur.cost, 12)} ${pct(st.progress, cur.cost)}%` : 'Nothing under study', cur ? '#c8a060' : C.dim);
    const n = `${st.done.length} of ${Object.keys(TECHS).length} learned`;
    g.text(this.w - 2 - n.length - (this.sel ? PANEL : 0), 2, n, C.faint);
    g.text(2, this.h - 1, ' wheel zoom · drag to move · click a step · arrows pan · ESC close ', C.faint);
    // With a Kavorent core in hand: the other tree, the Kavorent's.
    if (canSeeAncient(game, s)) {
      const label = ' ♦ ANCIENT TECHNOLOGY [T] ';
      const bx = this.w - label.length - 2;
      const hov = this.hovering(bx, this.h - 1, label.length, 1);
      g.text(bx, this.h - 1, label, hov ? '#000000' : '#7ae0ff', hov ? '#7ae0ff' : '#0e2a38');
      this.hit(bx, this.h - 1, label.length, 1, () => this.openAncient());
    }
    // Hover: what it is.
    const m = this.ui.mouse;
    this.hover = m ? this.nodeAt(m.x, m.y) : null;
    if (this.hover && !this.drag) {
      const t = TECHS[this.hover];
      const stt = this.status(st, this.hover);
      const lines = [{ text: `${t.name}${t.big ? ' ★' : ''}`, color: BRANCH_COLOR[t.branch] }, { text: STATUS[stt], color: STATUS_COLOR[stt] }];
      for (const l of wrap(t.desc, 36)) lines.push({ text: l, color: C.white });
      const rivals = rivalsOf(this.hover);
      if (rivals.length && stt !== 'barred' && stt !== 'done') lines.push({ text: `A choice: bars ${rivals.map((k) => TECHS[k].name).join(', ')}`, color: C.orange });
      this.ui.tooltip = { lines };
    }
    // The side panel for the step picked.
    if (!this.sel) return;
    const id = this.sel;
    const t = TECHS[id];
    const x0 = this.w - 1 - PANEL;
    g.fill(x0, 3, PANEL, this.h - 5, ' ', C.fg, 'rgba(20,18,30,0.98)');
    for (let y = 3; y < this.h - 2; y++) g.put(x0, y, '│', C.faint);
    let y = 4;
    const line = (txt, col = C.fg) => {
      for (const l of wrap(txt, PANEL - 3)) {
        if (y < this.h - 3) g.text(x0 + 2, y, l, col);
        y++;
      }
    };
    line(t.name.toUpperCase(), BRANCH_COLOR[t.branch]);
    line(`${BRANCH_NAME[t.branch]} · step ${t.tier}${t.big ? ' · a great work' : ''}`, t.big ? '#ffd870' : C.dim);
    y++;
    const stt = this.status(st, id);
    const when = (st.log || []).find((q) => q.id === id);
    const rivals = rivalsOf(id);
    if (stt === 'done') line(when ? `Learned on day ${Math.max(1, when.day)}` : 'Known from of old', C.green);
    else if (stt === 'current') line(`Being studied: ${bar(st.progress / t.cost, 10)} ${pct(st.progress, t.cost)}%`, C.hi);
    else if (stt === 'barred') line(`Barred: the realm chose ${rivals.filter((k) => st.done.includes(k)).map((k) => TECHS[k].name).join(' and ')}`, C.red);
    else if (stt === 'open') line('Can be studied next', C.fg);
    else {
      const need = [...t.req, ...(t.also || [])].filter((r) => (Array.isArray(r) ? !r.some((k) => st.done.includes(k)) : !st.done.includes(r)))
        .map((r) => (Array.isArray(r) ? r.map((k) => TECHS[k].name).join(' or ') : TECHS[r].name));
      line(`Needs ${need.join(' and ')} first`, C.orange);
    }
    // (Work put by for later: studied before, or brought by a town.)
    const kept = stt !== 'done' && stt !== 'current' ? (st.banked && st.banked[id]) || 0 : 0;
    if (kept >= 1) line(`Already ${pct(kept, t.cost)}% studied ${bar(kept / t.cost, 8)}`, '#c8a060');
    y++;
    line(t.desc, C.white);
    y++;
    if (rivals.length && stt !== 'barred' && stt !== 'done') {
      line(`A choice: learning it bars ${rivals.map((k) => TECHS[k].name).join(' and ')} for good.`, C.orange);
      y++;
    }
    line(`Study needed: ${t.cost}`, C.faint);
    // What this town has put into it (it keeps that, whatever banner it's under).
    const mine = T.contribution(this.s, id);
    if (mine.n >= 1) line(`${this.s.name}'s share of the work: ${Math.round(mine.n)} (${mine.pct}%)`, C.faint);
    const next = Object.keys(TECHS).filter((k) => reqIds(k).includes(id));
    if (next.length) line(`Leads to: ${next.map((k) => TECHS[k].name).join(', ')}`, C.faint);
    g.text(x0 + 2, this.h - 3, '[click away] close', C.faint);
  }
  drawPixels(ctx, game) {
    const st = game.sim.tech.stateOf(this.s);
    const a = this.area();
    const z = this.cam.z;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    ctx.clip();
    ctx.fillStyle = '#0c0a12';
    ctx.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    // The backdrop: faint rings and spokes about the crest.
    const o = this.toScreen({ x: 0, y: 0 });
    ctx.strokeStyle = 'rgba(120,110,150,0.12)';
    ctx.lineWidth = 1;
    for (const r of [60, 130, 200, 270, 340, 410]) {
      ctx.beginPath();
      ctx.arc(o.x + 0.5, o.y + 0.5, r * z, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,110,150,0.07)';
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + Math.PI / 16;
      ctx.beginPath();
      ctx.moveTo(o.x + Math.cos(ang) * 40 * z, o.y + Math.sin(ang) * 40 * z);
      ctx.lineTo(o.x + Math.cos(ang) * 440 * z, o.y + Math.sin(ang) * 440 * z);
      ctx.stroke();
    }
    // The paths: from each step back to what it needs (the roots to the
    // crest). Bright where it's known, a dotted trail where it could be
    // studied, faint and grey beyond.
    const ids = Object.keys(TECHS);
    for (const id of ids) {
      const t = TECHS[id];
      const to = this.toScreen(techPos(id));
      const froms = t.req.length ? reqIds(id).map((k) => this.toScreen(techPos(k))) : [o];
      const stt = this.status(st, id);
      const col = BRANCH_COLOR[t.branch];
      for (const f of froms) {
        if (stt === 'barred') {
          ctx.setLineDash([1, 4]);
          ctx.strokeStyle = 'rgba(160,80,80,0.3)';
          ctx.lineWidth = 1;
          line(ctx, f, to);
          ctx.setLineDash([]);
        } else if (stt === 'done') {
          ctx.strokeStyle = hexA(col, 0.25);
          ctx.lineWidth = Math.max(3, 5 * z);
          line(ctx, f, to);
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(1, 2 * z);
          line(ctx, f, to);
        } else {
          ctx.setLineDash([2, 3]);
          ctx.strokeStyle = stt === 'locked' ? 'rgba(140,140,160,0.35)' : hexA(col, stt === 'current' ? 0.9 : 0.6);
          ctx.lineWidth = 1;
          line(ctx, f, to);
          ctx.setLineDash([]);
        }
      }
    }
    // The choices: the two (or more) sides crossed through between them.
    const seen = new Set();
    for (const id of ids) {
      const ex = TECHS[id].excl;
      if (!ex || seen.has(ex)) continue;
      seen.add(ex);
      const group = ids.filter((k) => TECHS[k].excl === ex);
      const ps = group.map((k) => this.toScreen(techPos(k)));
      const chosen = group.some((k) => st.done.includes(k));
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = chosen ? 'rgba(200,90,80,0.5)' : 'rgba(240,150,90,0.85)';
      ctx.lineWidth = 1;
      for (let i = 1; i < ps.length; i++) line(ctx, ps[i - 1], ps[i]);
      ctx.setLineDash([]);
      for (let i = 1; i < ps.length; i++) {
        const mx = Math.round((ps[i - 1].x + ps[i].x) / 2);
        const my = Math.round((ps[i - 1].y + ps[i].y) / 2);
        ctx.fillStyle = '#0c0a12';
        circle(ctx, mx, my, 4);
        ctx.strokeStyle = chosen ? '#a05048' : '#f0a060';
        ctx.beginPath();
        ctx.moveTo(mx - 2 + 0.5, my - 2 + 0.5);
        ctx.lineTo(mx + 2 + 0.5, my + 2 + 0.5);
        ctx.moveTo(mx + 2 + 0.5, my - 2 + 0.5);
        ctx.lineTo(mx - 2 + 0.5, my + 2 + 0.5);
        ctx.stroke();
      }
    }
    // The crest in the middle: the realm's colour, a ring, a cross-hair.
    const civ = this.s.civ;
    const crest = civ ? civ.color.hex : '#c8b070';
    const R = Math.max(8, 16 * z);
    ctx.fillStyle = '#16121e';
    circle(ctx, o.x, o.y, R + 3);
    ctx.fillStyle = hexA(crest, 0.85);
    circle(ctx, o.x, o.y, R);
    ctx.strokeStyle = '#f0d890';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(o.x + 0.5, o.y + 0.5, R + 6, 0, Math.PI * 2);
    ctx.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(o.x + 0.5 + dx * (R + 3), o.y + 0.5 + dy * (R + 3));
      ctx.lineTo(o.x + 0.5 + dx * (R + 10), o.y + 0.5 + dy * (R + 10));
      ctx.stroke();
    }
    // The realm's letter on its crest.
    const letter = ((civ ? civ.name.replace(/^The /, '') : this.s.name)[0] || '?').toUpperCase();
    drawText(ctx, letter, Math.round(o.x - textWidth(letter) / 2) + 1, o.y - 3, '#fff4d0', '#000');
    // Branch names at the far end of each path.
    for (const b of BRANCHES) {
      const [dx, dy] = DIRS[b.id];
      const q = this.toScreen({ x: dx * (26 + 7 * LEG), y: dy * (26 + 7 * LEG) });
      const name = b.name.toUpperCase();
      drawText(ctx, name, Math.round(q.x - textWidth(name) / 2), q.y - 3, b.color, '#000');
    }
    // The steps.
    for (const id of ids) {
      const t = TECHS[id];
      const q = this.toScreen(techPos(id));
      const stt = this.status(st, id);
      const col = BRANCH_COLOR[t.branch];
      const r = Math.max(6, NODE * z * (t.big ? 1.25 : 1));
      const sel = this.sel === id;
      const hov = this.hover === id;
      // A glow behind what's known (and what's picked).
      if (stt === 'done' || sel || stt === 'current') {
        ctx.fillStyle = hexA(stt === 'done' ? col : '#fff4c0', 0.18 + (sel ? 0.12 : 0));
        circle(ctx, q.x, q.y, r + 5);
      }
      ctx.fillStyle = stt === 'done' ? shade(col, 0.35) : stt === 'barred' ? '#1c1012' : '#14111c';
      circle(ctx, q.x, q.y, r);
      // The ring: solid where it's known, pulsing on what's studied now.
      ctx.lineWidth = sel || hov ? 2 : 1;
      ctx.strokeStyle = stt === 'locked' ? 'rgba(150,150,170,0.5)' : stt === 'barred' ? 'rgba(170,70,60,0.7)' : stt === 'current' ? `rgba(255,236,160,${0.6 + 0.4 * Math.sin(this.t * 4)})` : col;
      ctx.beginPath();
      ctx.arc(q.x + 0.5, q.y + 0.5, r, 0, Math.PI * 2);
      ctx.stroke();
      // A great work: a second ring, in gold.
      if (t.big) {
        ctx.strokeStyle = stt === 'barred' ? 'rgba(170,70,60,0.5)' : stt === 'done' ? '#ffd870' : 'rgba(255,216,112,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(q.x + 0.5, q.y + 0.5, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Work put by on it (studied before, or brought by a town that changed
      // banner): a dim arc of how far along it is.
      const kept = stt !== 'done' && stt !== 'current' ? (st.banked && st.banked[id]) || 0 : 0;
      if (kept >= 1) {
        ctx.strokeStyle = 'rgba(200,160,96,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(q.x + 0.5, q.y + 0.5, r + (t.big ? 6 : 3), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, kept / t.cost));
        ctx.stroke();
      }
      // Progress round the rim of the one being studied.
      if (stt === 'current') {
        ctx.strokeStyle = '#ffe070';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(q.x + 0.5, q.y + 0.5, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, st.progress / t.cost));
        ctx.stroke();
      }
      // The icon.
      const ic = itemIcon(t.icon);
      if (ic) {
        const sz = Math.max(8, Math.round(16 * Math.min(1.6, z)));
        ctx.globalAlpha = stt === 'locked' ? 0.35 : stt === 'barred' ? 0.25 : 1;
        ctx.drawImage(ic, Math.round(q.x - sz / 2), Math.round(q.y - sz / 2), sz, sz);
        ctx.globalAlpha = 1;
      }
      // Barred: struck through.
      if (stt === 'barred') {
        ctx.strokeStyle = 'rgba(220,80,70,0.85)';
        ctx.lineWidth = Math.max(1, 1.5 * Math.min(1.6, z));
        const k = r * 0.6;
        ctx.beginPath();
        ctx.moveTo(q.x - k + 0.5, q.y - k + 0.5);
        ctx.lineTo(q.x + k + 0.5, q.y + k + 0.5);
        ctx.moveTo(q.x + k + 0.5, q.y - k + 0.5);
        ctx.lineTo(q.x - k + 0.5, q.y + k + 0.5);
        ctx.stroke();
      }
      // Learned: a little check; the name underneath when close enough.
      if (stt === 'done') {
        ctx.fillStyle = '#7ae070';
        ctx.fillRect(q.x + r - 3, q.y - r, 3, 3);
      }
      if (z >= 1.3 || sel || hov) {
        const nm = t.name;
        drawText(ctx, nm, Math.round(q.x - textWidth(nm) / 2), q.y + r + 3, stt === 'locked' ? '#8a8a98' : stt === 'barred' ? '#a06058' : '#f0e8d8', '#000');
      }
    }
    ctx.restore();
  }
}

const STATUS = { done: 'Learned', current: 'Being studied now', open: 'Can be studied next', locked: 'Not yet within reach', barred: 'Barred: the realm chose otherwise' };
const STATUS_COLOR = { done: C.green, current: C.hi, open: C.fg, locked: C.dim, barred: C.red };
const BRANCH_COLOR = Object.fromEntries(BRANCHES.map((b) => [b.id, b.color]));
const BRANCH_NAME = Object.fromEntries(BRANCHES.map((b) => [b.id, b.name]));

function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x + 0.5, a.y + 0.5);
  ctx.lineTo(b.x + 0.5, b.y + 0.5);
  ctx.stroke();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
  ctx.fill();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round((n >> 16) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}

// ---------------------------------------------------------------- the desk
// An astrolabe of three brass rings, each with eight glyphs round it and
// one of them marked. The rings drift; you turn one at a time (and the one
// inside it turns half as far the other way). When all three marks sit
// under the pointer at once, the thought comes clear: record it before
// the candle burns down.
const RING_R = [62, 46, 30];
const GLYPHS = 8;
const STEP = (Math.PI * 2) / GLYPHS;
const WINDOW = 0.17;

export class ResearchWindow extends Window {
  constructor(ui, game, s) {
    super(ui, 64, 34, { kind: 'research' });
    this.game = game;
    this.s = s;
    this.t = 0;
    this.insights = 0;
    this.fx = [];
    this.newPuzzle();
  }
  newPuzzle() {
    const R = () => Math.random();
    this.rings = RING_R.map((r, i) => ({
      r,
      rot: R() * Math.PI * 2,
      speed: (R() < 0.5 ? -1 : 1) * (0.05 + R() * 0.07) * (i === 1 ? 1.4 : 1),
      mark: Math.floor(R() * GLYPHS),
      glyphs: Array.from({ length: GLYPHS }, () => Math.floor(R() * 8)),
    }));
    this.sel = 0;
    this.candle = 1;
    this.phase = 'work';
    this.flash = 0;
  }
  // Where a ring's mark sits now (radians off the top).
  off(ring) {
    let a = ring.mark * STEP + ring.rot;
    a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return a > Math.PI ? a - Math.PI * 2 : a;
  }
  aligned(ring) {
    return Math.abs(this.off(ring)) <= WINDOW;
  }
  allAligned() {
    return this.rings.every((r) => this.aligned(r));
  }
  update(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    for (const f of this.fx) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += (f.g ?? 30) * dt;
    }
    this.fx = this.fx.filter((f) => f.life > 0);
    if (this.phase !== 'work') return;
    for (const r of this.rings) r.rot += r.speed * dt * (this.allAligned() ? 0.25 : 1);
    this.candle -= dt / 55;
    if (this.candle <= 0) {
      this.candle = 0;
      this.phase = 'out';
      this.ui.msg('The candle gutters out, and the thought escapes you.', C.dim);
      this.burst(0, -70, ['#9a9aa2', '#6a6a72'], 10, 14, -20);
    }
  }
  burst(x, y, colors, n, speed, g = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 8, life: 0.6 + Math.random() * 0.6, max: 1.2, c: colors[i % colors.length], g });
    }
  }
  turn(dir) {
    const r = this.rings[this.sel];
    r.rot += dir * STEP * 0.5;
    const inner = this.rings[this.sel + 1];
    if (inner) inner.rot -= dir * STEP * 0.25;
    this.ui.audio?.play('select');
  }
  record() {
    const game = this.game;
    if (!this.allAligned()) {
      // Not yet: a blot of ink, and the candle burns on.
      this.candle = Math.max(0, this.candle - 0.08);
      this.burst(0, 0, ['#1a1a2a', '#2a2a4a'], 8, 30);
      this.ui.audio?.play('error');
      return;
    }
    const pts = Math.round((4 + Math.round(this.candle * 4)) * (heroHas(game.hero, 'scholar') ? 1.5 : 1));
    const T = game.sim.tech;
    const st = T.stateOf(this.s);
    const was = st.current;
    const learned = T.addPoints(this.s, pts, game.day);
    // Paid by the town for the work.
    const L = game.sim.layoutOf(this.s.id);
    const pay = L && L.econ.treasury >= 6 ? 6 : 0;
    if (pay) {
      L.econ.treasury -= pay;
      game.player.give('coin', pay);
      const j = game.sim.careers.job;
      if (j) j.earned = (j.earned || 0) + pay;
    }
    this.insights++;
    this.phase = 'insight';
    this.flash = 1.2;
    this.burst(0, 0, ['#fff4b0', '#ffe070', '#ffffff', '#a0d8ff'], 40, 90, 0);
    this.ui.audio?.play('fanfare');
    this.ui.msg(learned ? `Your insight completes the work on ${TECHS[learned].name}!` : `An insight! (+${pts} toward ${was ? TECHS[was].name : 'the realm\'s study'}${pay ? `, ¤${pay}` : ''})`, learned ? '#ffe070' : '#c8e0ff');
  }
  draw(g, game) {
    g.box(0, 0, this.w, this.h, { bg: 'rgba(14,12,20,0.97)', double: true, title: 'THE STUDY' });
    const st = game.sim.tech.stateOf(this.s);
    const t = st.current ? TECHS[st.current] : null;
    g.center(1, t ? `Working on: ${t.name}` : 'Nothing set to study', t ? C.hi : C.dim);
    if (t) g.center(2, `${bar(st.progress / t.cost, 24)} ${pct(st.progress, t.cost)}%`, '#c8a060');
    const status = this.phase === 'out' ? 'The candle is out.  [ENTER] light another'
      : this.phase === 'insight' ? 'It comes clear!  [ENTER] the next problem'
        : this.allAligned() ? 'The marks line up: [SPACE] write it down!' : 'Bring the three gold marks under the pointer';
    g.center(this.h - 4, status, this.phase === 'out' ? C.dim : this.allAligned() || this.phase === 'insight' ? C.hi : C.fg);
    g.center(this.h - 3, `Insights this sitting: ${this.insights}`, C.dim);
    g.text(2, this.h - 1, ' ←→ turn · ↑↓ ring · SPACE record · ESC leave ', C.faint);
  }
  // The desk, the astrolabe, the candle: in pixels.
  drawPixels(ctx) {
    const ox = this.x * CHAR_W;
    const oy = this.y * CHAR_H;
    const W = this.w * CHAR_W;
    const cx = ox + Math.round(W / 2);
    const cy = oy + 3 * CHAR_H + 96;
    const t = this.t;
    const px = (x, y, c, w = 1, h = 1) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    // The desk top (wood grain) behind it all.
    for (let y = cy + 74; y < oy + (this.h - 5) * CHAR_H; y++) px(ox + 8, y, (y >> 1) % 3 ? '#4a3220' : '#563a26', W - 16, 1);
    // The sky inside the rings: deep blue, stars twinkling.
    const SKY = 74;
    for (let y = -SKY; y <= SKY; y++) {
      const half = Math.floor(Math.sqrt(SKY * SKY - y * y));
      const d = Math.abs(y) / SKY;
      px(cx - half, cy + y, `rgb(${Math.round(18 + d * 6)},${Math.round(20 + d * 8)},${Math.round(44 - d * 10)})`, half * 2 + 1, 1);
    }
    for (let i = 0; i < 40; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const r = 8 + ((i * 37) % 64);
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      if (tw > 0.35) px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, tw > 0.8 ? '#ffffff' : '#8a9ac8');
    }
    // Brass rim.
    for (let a = 0; a < Math.PI * 2; a += 0.01) {
      px(cx + Math.cos(a) * (SKY + 1), cy + Math.sin(a) * (SKY + 1), '#c89a3a');
      px(cx + Math.cos(a) * (SKY + 3), cy + Math.sin(a) * (SKY + 3), '#7a5a1e');
    }
    const all = this.allAligned();
    // The rings.
    this.rings.forEach((ring, i) => {
      const sel = i === this.sel;
      const ok = this.aligned(ring);
      const band = sel ? '#f0c060' : ok ? '#d8b860' : '#a07a30';
      const dark = sel ? '#8a6a20' : '#5a4418';
      for (let a = 0; a < Math.PI * 2; a += 1.4 / ring.r) {
        px(cx + Math.cos(a) * (ring.r + 5), cy + Math.sin(a) * (ring.r + 5), dark);
        px(cx + Math.cos(a) * (ring.r - 5), cy + Math.sin(a) * (ring.r - 5), dark);
        // (A bright rim inside the dark one: gold, brighter when chosen or aligned.)
        if (Math.floor(a * ring.r) % 3 === 0) px(cx + Math.cos(a) * (ring.r + 4), cy + Math.sin(a) * (ring.r + 4), band);
        if (sel && Math.sin(a * 6 + t * 3) > 0.92) px(cx + Math.cos(a) * ring.r, cy + Math.sin(a) * ring.r, '#fff4c0');
      }
      for (let k = 0; k < GLYPHS; k++) {
        const a = k * STEP + ring.rot - Math.PI / 2;
        const gx = cx + Math.cos(a) * ring.r;
        const gy = cy + Math.sin(a) * ring.r;
        const mark = k === ring.mark;
        const col = mark ? (ok ? (Math.sin(t * 10) > 0 ? '#c8ffb0' : '#ffe070') : '#ffd040') : sel ? '#c8d0e8' : '#7a88a8';
        glyph(px, ring.glyphs[k], gx, gy, col);
        if (mark) {
          // A glow round the marked one.
          for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) px(gx + dx, gy + dy, ok ? '#a0ff80' : '#8a6a20');
        }
      }
    });
    // The pointer at the top.
    for (let i = 0; i < 6; i++) px(cx - 5 + i, cy - SKY - 10 + i, '#ffe070', 11 - i * 2, 1);
    px(cx, cy - SKY - 4, '#fff4c0', 1, 6);
    // All lined up: light pours out of the centre.
    if (all || this.flash > 0) {
      const k = this.flash > 0 ? this.flash : 0.5 + 0.5 * Math.sin(t * 6);
      ctx.globalAlpha = Math.min(1, k) * 0.6;
      for (let r = 0; r < 12; r++) {
        const a = r * (Math.PI / 6) + t * 0.4;
        for (let d = 6; d < SKY; d += 2) px(cx + Math.cos(a) * d, cy + Math.sin(a) * d, '#fff4c0');
      }
      ctx.globalAlpha = 1;
    }
    // The hub.
    px(cx - 3, cy - 3, '#c89a3a', 7, 7);
    px(cx - 2, cy - 2, '#f0d070', 5, 5);
    px(cx - 1, cy - 1, '#ffffff', 2, 2);
    // The candle, burning down.
    const kx = ox + W - 46;
    const base = cy + 66;
    const hgt = Math.round(10 + this.candle * 60);
    px(kx - 6, base, '#8a7a5a', 16, 3);
    px(kx, base - hgt, '#f0e8d0', 5, hgt);
    px(kx + 4, base - hgt, '#d8ccb0', 1, hgt);
    if (this.phase !== 'out') {
      const fl = Math.sin(t * 13) + Math.sin(t * 7.3);
      // A soft round glow about the flame.
      for (let r = 18; r > 2; r -= 3) {
        ctx.globalAlpha = 0.07 + 0.015 * fl;
        ctx.fillStyle = '#ffb040';
        ctx.beginPath();
        ctx.arc(kx + 2.5, base - hgt - 4, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      px(kx + 1 + (fl > 1 ? 1 : 0), base - hgt - 7, '#ffd060', 3, 6);
      px(kx + 2, base - hgt - 5, '#fff8d0', 1, 3);
      px(kx + 2, base - hgt - 1, '#3a2a1a', 1, 1);
    } else if (Math.floor(t * 3) % 2) px(kx + 2, base - hgt - 4 - ((t * 10) % 6), '#8a8a92');
    // Papers on the desk: notes in a cramped hand, a book or two.
    const nx = ox + 18;
    px(nx, cy + 82, '#e8dcc0', 70, 34);
    px(nx + 2, cy + 84, '#f4ecd8', 66, 30);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 3) % 5) px(nx + 6 + j * 7, cy + 88 + i * 4, '#7a6a5a', 4 + ((i + j) % 3), 1);
    px(ox + W - 92, cy + 84, '#6a2a2a', 26, 6);
    px(ox + W - 92, cy + 90, '#2a4a6a', 24, 6);
    px(ox + W - 90, cy + 84, '#c8a060', 1, 12);
    // Ink and quill.
    const ix = ox + 26;
    px(ix, base - 8, '#1a1a2a', 9, 8);
    px(ix + 1, base - 9, '#3a3a5a', 7, 1);
    for (let i = 0; i < 18; i++) px(ix + 4 + i * 0.5, base - 10 - i, i < 4 ? '#e8e0d0' : '#f4f0e4');
    // Sparks and blots.
    for (const f of this.fx) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / (f.max * 0.5)));
      px(cx + f.x, cy + f.y, f.c, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  onKey(k) {
    if (k.code === 'Escape') this.close();
    else if (this.phase !== 'work') {
      if (k.code === 'Enter' || k.code === 'Space') this.newPuzzle();
      else return true;
    } else if (k.code === 'ArrowLeft' || k.code === 'KeyA') this.turn(-1);
    else if (k.code === 'ArrowRight' || k.code === 'KeyD') this.turn(1);
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.sel = (this.sel + 2) % 3;
    else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.sel = (this.sel + 1) % 3;
    else if (k.code === 'Space' || k.code === 'Enter') this.record();
    else return false;
    return true;
  }
}

// Eight little marks for the rings (each 5x5 at most).
function glyph(px, k, x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  switch (k) {
    case 0: // a dot in a ring
      px(x - 1, y - 2, c, 3, 1); px(x - 1, y + 2, c, 3, 1); px(x - 2, y - 1, c, 1, 3); px(x + 2, y - 1, c, 1, 3); px(x, y, c);
      break;
    case 1: // a crescent moon
      px(x - 1, y - 2, c, 2, 1); px(x - 2, y - 1, c, 1, 3); px(x - 1, y + 2, c, 2, 1); px(x + 1, y - 1, c);
      break;
    case 2: // a cross
      px(x - 2, y, c, 5, 1); px(x, y - 2, c, 1, 5);
      break;
    case 3: // a triangle
      px(x, y - 2, c); px(x - 1, y - 1, c, 3, 1); px(x - 2, y, c, 5, 1); px(x - 2, y + 1, c, 5, 1);
      break;
    case 4: // a star
      px(x, y - 2, c, 1, 5); px(x - 2, y, c, 5, 1); px(x - 1, y - 1, c); px(x + 1, y + 1, c); px(x + 1, y - 1, c); px(x - 1, y + 1, c);
      break;
    case 5: // a wave
      px(x - 2, y, c); px(x - 1, y - 1, c); px(x, y, c); px(x + 1, y + 1, c); px(x + 2, y, c);
      break;
    case 6: // an eye
      px(x - 2, y, c); px(x + 2, y, c); px(x - 1, y - 1, c, 3, 1); px(x - 1, y + 1, c, 3, 1); px(x, y, c);
      break;
    default: // a key
      px(x - 2, y - 1, c, 2, 2); px(x, y, c, 3, 1); px(x + 2, y + 1, c);
  }
}
