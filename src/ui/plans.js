// (Round 78) A blueprint in hand, right-clicked: what's on it (its name,
// typed; its blocks), and what to do with it: lay it out where you're
// pointing, fold it up, turn it, clear it, or copy a building onto it
// with a box (see game/plans.js). The copy box: click one corner, then
// the far one; drag any side of it out or in; the wheel raises or lowers
// its top (Shift: its bottom); right-click to take what's in it.
import { Window } from './window.js';
import { C } from './ascii.js';
import { BLOCKS } from '../world/blocks.js';
import { planOf, layOut, turnPlan, clearPlan, copyBox, isPlanKey, PLAN_PREFIX, MAX_CELLS } from '../game/plans.js';

const NAME_MAX = 28;

// The plan the blueprint in pack slot `i` holds, a new one made for a
// blank (one off its stack) if `make`.
function planInSlot(game, i, make = false) {
  const p = game.player;
  const s = p.inv[i];
  if (!s) return null;
  if (isPlanKey(s.item)) return planOf(game, s.item);
  if (s.item !== 'blueprint' || !make) return null;
  game.plans ||= new Map();
  game.planSeq = Math.max(game.planSeq || 0, ...[...game.plans.keys(), 0]) + 1;
  const plan = { id: game.planSeq, name: `Plan ${game.planSeq}`, cells: [], at: null, ver: 1 };
  game.plans.set(plan.id, plan);
  const key = `${PLAN_PREFIX}${plan.id}`;
  if (s.count > 1) {
    s.count--;
    const j = p.inv.findIndex((q) => !q);
    if (j >= 0) p.inv[j] = { item: key, count: 1 };
    else game.spawnDrop?.(key, 1, p.x, p.y, p.z, true);
  } else p.inv[i] = { item: key, count: 1 };
  return plan;
}

export function openPlanWindow(game, slot) {
  const p = game.player;
  // (The copy box out and set: what's in it, taken.)
  const B0 = p.copyBox;
  if (B0 && B0.stage === 'set') {
    const plan = planInSlot(game, slot, true);
    if (!plan) return;
    const n = copyBox(game, plan, B0.box);
    p.copyBox = null;
    game.audio?.play('craft');
    game.ui.msg(n ? `${n} block${n > 1 ? 's' : ''} copied onto ${plan.name}${n >= MAX_CELLS ? ' (all it could hold)' : ''}. Right-click it to lay it out somewhere.` : 'There was nothing in the box to copy.', n ? '#a0e0ff' : '#c8c8c8');
    return;
  }
  game.ui.open(new PlanWindow(game.ui, slot));
}

// ------------------------------------------------------------ the copy box
const toView = (game, x, z) => (game.renderer && game.renderer.toView ? game.renderer.toView(x, z) : [x, z]);
const toWorld = (game, u, v) => (game.renderer && game.renderer.toWorld ? game.renderer.toWorld(u, v) : [u, v]);

// The box as you see it (view columns u, rows v).
function viewBox(game, b) {
  const [a0, c0] = toView(game, b.x0, b.z0);
  const [a1, c1] = toView(game, b.x1, b.z1);
  return { u0: Math.min(a0, a1), u1: Math.max(a0, a1), v0: Math.min(c0, c1), v1: Math.max(c0, c1) };
}
function fromView(game, b, vb) {
  const [x0, z0] = toWorld(game, vb.u0, vb.v0);
  const [x1, z1] = toWorld(game, vb.u1, vb.v1);
  b.x0 = Math.min(x0, x1);
  b.x1 = Math.max(x0, x1);
  b.z0 = Math.min(z0, z1);
  b.z1 = Math.max(z0, z1);
}

export function boxPress(game, p, c) {
  const B0 = p.copyBox;
  if (!B0 || !c || c.x === undefined) return;
  if (B0.stage === 'a') {
    B0.box = { x0: c.x, x1: c.x, y0: c.y, y1: c.y, z0: c.z, z1: c.z };
    B0.stage = 'b';
    game.ui.msg('Now click the far corner.', '#a0e0ff', true);
    return;
  }
  if (B0.stage === 'b') {
    const b = B0.box;
    b.x1 = c.x;
    b.z1 = c.z;
    b.y1 = c.y;
    [b.x0, b.x1] = [Math.min(b.x0, b.x1), Math.max(b.x0, b.x1)];
    [b.y0, b.y1] = [Math.min(b.y0, b.y1), Math.max(b.y0, b.y1)];
    [b.z0, b.z1] = [Math.min(b.z0, b.z1), Math.max(b.z0, b.z1)];
    B0.stage = 'set';
    game.ui.msg('Drag a side to pull it out or in; the wheel raises the top (Shift: the bottom). Right-click to copy what\'s inside.', '#a0e0ff');
    return;
  }
  // Set: the side nearest the pointer, to drag.
  const [cu, cv] = toView(game, c.x, c.z);
  const vb = viewBox(game, B0.box);
  const inU = cu >= vb.u0 - 2 && cu <= vb.u1 + 2;
  const inV = cv >= vb.v0 - 2 && cv <= vb.v1 + 2;
  const opts = [];
  if (inV) opts.push(['u0', Math.abs(cu - vb.u0)], ['u1', Math.abs(cu - vb.u1)]);
  if (inU) opts.push(['v0', Math.abs(cv - vb.v0)], ['v1', Math.abs(cv - vb.v1)]);
  opts.sort((a, b) => a[1] - b[1]);
  if (!opts.length || opts[0][1] > 3) {
    // (Clicked well away from it: start again from there.)
    B0.box = { x0: c.x, x1: c.x, y0: c.y, y1: c.y, z0: c.z, z1: c.z };
    B0.stage = 'b';
    game.ui.msg('A new box: click its far corner.', '#a0e0ff', true);
    return;
  }
  B0.drag = { side: opts[0][0] };
}

export function boxDrag(game, p, c) {
  const B0 = p.copyBox;
  if (!B0 || !B0.drag || !c || c.x === undefined) return;
  const [cu, cv] = toView(game, c.x, c.z);
  const vb = viewBox(game, B0.box);
  const s = B0.drag.side;
  if (s === 'u0') vb.u0 = Math.min(cu, vb.u1);
  else if (s === 'u1') vb.u1 = Math.max(cu, vb.u0);
  else if (s === 'v0') vb.v0 = Math.min(cv, vb.v1);
  else vb.v1 = Math.max(cv, vb.v0);
  // (No bigger than a blueprint could hold, near enough.)
  if ((vb.u1 - vb.u0 + 1) * (vb.v1 - vb.v0 + 1) > 1600) return;
  fromView(game, B0.box, vb);
}

export function boxWheel(game, p, wheel) {
  const B0 = p.copyBox;
  if (!B0 || B0.stage !== 'set') return false;
  const inp = game.ui && game.ui.input;
  const shift = !!(inp && inp.isDown && (inp.isDown('ShiftLeft') || inp.isDown('ShiftRight')));
  const b = B0.box;
  const d = wheel < 0 ? 1 : -1;
  if (shift) b.y0 = Math.max(1, Math.min(b.y1, b.y0 + d));
  else b.y1 = Math.max(b.y0, Math.min(b.y0 + 24, b.y1 + d));
  return true;
}

// ------------------------------------------------------------ the window
export class PlanWindow extends Window {
  constructor(ui, slot) {
    super(ui, 56, 22, { kind: 'plans' });
    this.slot = slot;
  }
  draw(g, game) {
    const p = game.player;
    const s = p.inv[this.slot];
    if (!s || !(s.item === 'blueprint' || isPlanKey(s.item))) return this.close();
    const plan = planInSlot(game, this.slot);
    g.fill(0, 0, this.w, this.h, ' ', C.fg, C.bg);
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'BLUEPRINT' });
    const blink = Math.floor(this.ui.time * 2) % 2 ? '█' : ' ';
    if (plan) {
      g.text(2, 1, 'Name:', C.dim);
      g.text(8, 1, plan.name + blink, C.hi);
      g.text(2, 2, `${plan.cells.length} block${plan.cells.length === 1 ? '' : 's'} · ${plan.at ? `laid out at ${plan.at.x}, ${plan.at.z}` : 'folded up'}`, C.fg);
      // What it's made of, most first.
      const by = new Map();
      for (const c of plan.cells) by.set(c[3], (by.get(c[3]) || 0) + 1);
      [...by].sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([id, n], i) => g.text(4 + (i % 2) * 26, 4 + Math.floor(i / 2), `${n} ${(BLOCKS[id] && (BLOCKS[id].label || BLOCKS[id].name)) || '?'}`.slice(0, 24), C.dim));
    } else {
      g.text(2, 1, 'A blank blueprint.', C.hi);
      g.text(2, 2, 'Nothing drawn on it yet.', C.dim);
    }
    let y = 8;
    const btn = (label, can, fn, tip) => {
      const x = 2;
      const hov = can && this.hovering(x, y, label.length, 1);
      g.text(x, y, label, can ? (hov ? C.white : C.hi) : C.faint, can ? (hov ? '#3a3050' : '#2a2230') : undefined);
      if (tip) g.text(x + label.length + 1, y, tip.slice(0, this.w - label.length - 5), C.faint);
      if (can) this.hit(x, y, label.length, 1, (ck, gm) => fn(gm || game));
      y++;
    };
    const has = !!plan && plan.cells.length > 0;
    btn(' Lay it out here ', has, (gm) => {
      const c = gm.cursor;
      const at = c && c.x !== undefined ? { x: c.x, y: c.face === 'top' || !c.block ? c.y + (c.block ? 1 : 0) : c.y, z: c.z } : { x: gm.player.x + 2, y: gm.player.y, z: gm.player.z };
      layOut(plan, at);
      this.ui.msg(`${plan.name} laid out where you were pointing.`, '#a0e0ff', true);
    }, 'where you point');
    btn(' Fold it up ', has && !!plan.at, () => layOut(plan, null), 'out of sight, kept');
    btn(' Turn it ', has, () => turnPlan(plan), 'a quarter round');
    btn(' Copy a building ', true, (gm) => {
      gm.player.copyBox = { stage: 'a', box: null, drag: null };
      this.close();
      this.ui.msg('Click one corner of what you want to copy (with this blueprint in hand).', '#a0e0ff');
    }, 'a box round it');
    btn(' Clear it ', has, () => clearPlan(plan), 'everything off it');
    y++;
    g.text(2, y++, 'In your off hand, the blocks you set go onto the plan.', C.faint);
    g.text(2, y++, 'Strike a planned block to take it off again.', C.faint);
    g.text(2, y++, 'Show it to a town\'s builder to have it built.', C.faint);
    g.text(2, this.h - 2, plan ? 'Type to rename · ESC to close' : 'ESC to close', C.faint);
  }
  onKey(k, game) {
    const G = game || this.ui.game;
    const plan = G ? planInSlot(G, this.slot) : null;
    if (k.code === 'Escape' || k.code === 'Enter') {
      this.close();
      return true;
    }
    if (!plan) return true;
    if (k.code === 'Backspace') plan.name = plan.name.slice(0, -1);
    else if (k.key && k.key.length === 1 && !k.ctrl && plan.name.length < NAME_MAX) plan.name += k.key;
    plan.ver++;
    return true;
  }
}
