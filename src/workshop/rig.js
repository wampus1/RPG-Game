// The Rig tool (round 62): characters that move without every frame
// drawn by hand. Cut a piece of art into parts (paint them, or let a quick
// rig cut it up for you: two legs, four, wings, a blob, a serpent, a rooted
// thing), put the parts on bones jointed one to another, make some bones
// springy (tails, ears, hair) so they sway as the body moves, and animate:
// waves on each joint (legs swinging, a breath, wings beating), keyframes
// where wanted (drag a bone in the preview to pose it), walk, idle, attack
// and flinch made for you to start from. The game draws a rigged
// creature from it (walking, standing, striking and flinching), and it
// can be baked into frames of pixel art for the Pixel tool.
import { h, ic, clear, button, group, field, numberInput, slider, check, seg, select, panel, toast, canvas, textInput, dropTarget, menu, dialog } from './kit.js';
import { titleBar, menuButton, refPicker, quantize } from './common.js';
import { RigPose, quickRig, autoAnims, keyAt, apply, ROLES, ANIMS, PART_COLORS, RIG_KINDS, groupSecs } from '../mod/rig.js';
import { composite, decodeCel, encodeCel, LIMITS } from '../mod/format.js';
import { MODS } from '../mod/state.js';
import { NODES } from '../mod/graph.js';
import { appStorage } from '../util/appstore.js';

const MODES = [['cut', 'Cut into parts', 'Paint which part each pixel belongs to'], ['bones', 'Bones', 'Where the joints are, and which bone each part hangs from'], ['anim', 'Animate', 'Waves and keyframes; drag a bone to pose it']];
const CUT_TOOLS = [['brush', 'pencil', 'Paint pixels into the chosen part', 'B'], ['erase', 'eraser', 'Take pixels out of their part (they go with the body)', 'E'], ['fill', 'bucket', 'Fill: touching pixels of one colour into the part', 'G'], ['rect', 'rect', 'A box of pixels into the part', 'U']];
const SPEEDS = [[0.25, '¼'], [0.5, '½'], [1, '1×'], [2, '2×']];

export default class RigTool {
  constructor(app) {
    this.app = app;
    this.id = null;
    this.mode = 'cut';
    this.cutTool = 'brush';
    this.size = 1;
    this.part = 0;
    this.bone = null;
    this.anim = 'walk';
    this.playing = true;
    this.speed = 1;
    this.t = 0;
    this.lastCk = 0;
    this.keySel = null;
    this.pan = { x: 0, y: 0 };
    try {
      this.lookShut = appStorage()?.getItem('ws-rig-look') === 'shut';
    } catch {
      this.lookShut = false;
    }
  }

  get rig() {
    return this.id ? this.app.mod.rigs[this.id] : null;
  }

  get asset() {
    const r = this.rig;
    return r ? this.app.mod.assets[r.asset] || null : null;
  }

  // ------------------------------------------------------------ mounting
  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.onResize = () => this.fitCanvas();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('ws-resize', this.onResize);
    // (Round 67) Space held: drag the view about.
    this.onSpace = (e) => {
      if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      this.spaceDown = e.type === 'keydown';
      if (this.cv) this.cv.style.cursor = this.spaceDown ? 'grab' : '';
    };
    window.addEventListener('keydown', this.onSpace);
    window.addEventListener('keyup', this.onSpace);
    if (this.id && this.rig) this.open('rigs', this.id);
  }

  unmount() {
    this.flush();
    window.cancelAnimationFrame(this.raf);
    this.raf = null;
    this.gen = (this.gen || 0) + 1;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('ws-resize', this.onResize);
    window.removeEventListener('keydown', this.onSpace);
    window.removeEventListener('keyup', this.onSpace);
    this.spaceDown = false;
  }

  current() {
    return this.rig ? { kind: 'rigs', id: this.id } : null;
  }

  hintText() {
    if (!this.rig) return 'Pick a rig in the explorer, or right-click some art and "Rig it".';
    if (!this.asset) return 'Choose the art to rig (on the right), or drag some art onto the view.';
    return {
      cut: 'Paint each part (left: into the chosen part; right: back to the body). [ ] brush size. Or "Cut it up for me".',
      bones: 'Drag a joint to move it. Click empty space to add a bone under the chosen one. Delete removes the chosen bone.',
      anim: 'Drag a bone to pose it (a keyframe, at the time shown). Enter plays; the waves on the right move it by themselves.',
    }[this.mode];
  }

  keyHelp() {
    return [['1 2 3', 'Cut, bones, animate'], ['B E G U', 'Brush, eraser, fill, box (cutting)'], ['[ ]', 'Brush size'], ['Enter', 'Play / pause'], ['Delete', 'The chosen keyframe or bone'], ['+ −', 'Zoom']];
  }

  onKey(e) {
    if (!this.rig || e.ctrlKey || e.metaKey) return false;
    const m = { Digit1: 'cut', Digit2: 'bones', Digit3: 'anim' }[e.code];
    if (m) {
      this.setMode(m);
      return true;
    }
    const ct = { KeyB: 'brush', KeyE: 'erase', KeyG: 'fill', KeyU: 'rect' }[e.code];
    if (ct && this.mode === 'cut') {
      this.cutTool = ct;
      this.drawSide();
      return true;
    }
    if (e.key === '[' || e.key === ']') {
      this.size = Math.max(1, Math.min(6, this.size + (e.key === ']' ? 1 : -1)));
      return true;
    }
    if (e.key === 'Enter') {
      this.playing = !this.playing;
      this.drawPlayBtn();
      return true;
    }
    if (e.key === '+' || e.key === '=' || e.key === '-') {
      this.zoom = Math.max(1, Math.min(24, this.zoom + (e.key === '-' ? -1 : 1)));
      return true;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.mode === 'anim' && this.keySel) this.deleteKey();
      else if (this.mode === 'bones' && this.bone) this.removeBone(this.bone);
      return true;
    }
    return false;
  }

  open(kind, id) {
    this.flush();
    window.cancelAnimationFrame(this.raf);
    this.raf = null;
    if (!id || !this.app.mod.rigs[id]) {
      this.id = null;
      return this.empty();
    }
    if (this.id !== id) {
      this.zoom = 0;
      this.part = 0;
      this.bone = null;
      this.keySel = null;
      this.t = 0;
    }
    this.id = id;
    const r = this.rig;
    r.parts ||= [];
    r.bones ||= [];
    r.anims ||= {};
    this.loadMask();
    if (!r.anims[this.anim]) this.anim = Object.keys(r.anims)[0] || 'walk';
    this.build();
  }

  reload() {
    if (this.rig) this.open('rigs', this.id);
  }

  removed(kind, id) {
    if (kind === 'rigs' && id === this.id) {
      this.id = null;
      this.empty();
    }
  }

  renamed() {
    if (this.nameEl && this.rig) this.nameEl.value = this.rig.name;
  }

  empty() {
    clear(this.stage);
    clear(this.insp);
    const app = this.app;
    const arts = Object.values(app.mod.assets || {});
    const cards = h('div', { class: 'cards' });
    for (const a of arts.slice(0, 24)) {
      const c = h('div', { class: 'card' }, h('div', { class: 't' }, app.thumb('assets', a.id), a.name), h('div', { class: 'd' }, 'Rig this art.'));
      c.addEventListener('click', () => app.create('rigs', { name: `${a.name} rig`, asset: a.id }));
      cards.append(c);
    }
    this.stage.append(h('div', { class: 'home scroll', style: { overflow: 'auto' } },
      h('h1', null, 'Rig'),
      h('div', { class: 'sub' }, 'Characters cut into parts on bones, moved by simulation rather than drawn frame by frame. A creature with a rig walks, stands, strikes and flinches in the game.'),
      arts.length ? h('h2', null, 'Rig some of your art') : h('div', { class: 'note' }, 'Draw a creature in the Pixel tool first (one frame is enough), then come back.'),
      cards));
    this.insp.append(h('div', { class: 'insp-head' }, ic('bone'), 'Rig'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open.')));
  }

  // ------------------------------------------------------------ the data
  loadMask() {
    const a = this.asset;
    this.mask = a ? decodeCel(this.rig.mask, a.w * a.h) : null;
    this.maskDirty = false;
  }

  flush() {
    if (this.rig && this.mask && this.maskDirty) {
      this.rig.mask = encodeCel(this.mask);
      this.maskDirty = false;
    }
  }

  ck() {
    const now = performance.now();
    if (now - this.lastCk > 700) {
      this.flush();
      this.app.checkpoint('rigs', this.id);
    }
    this.lastCk = now;
  }

  set(fn, o = {}) {
    this.ck();
    fn(this.rig);
    this.app.touch('rigs', this.id);
    this.repose();
    if (o.side !== false) this.drawSide();
    if (o.timeline !== false) this.drawTimeline();
  }

  src() {
    const a = this.asset;
    if (!a) return null;
    const f = Math.min(a.frames.length - 1, this.rig.frame || 0);
    const key = `${a.w}x${a.h}:${f}:${JSON.stringify(a.frames[f].cels).length}:${a.palette.join('')}`;
    if (this._srcKey !== key) {
      this._src = { rgba: composite(a, f), w: a.w, h: a.h };
      this._srcKey = key;
      const c = canvas(a.w, a.h);
      c.getContext('2d').putImageData(new ImageData(this._src.rgba, a.w, a.h), 0, 0);
      this.artCv = c;
    }
    return this._src;
  }

  // The rig in use made afresh (after a change to it).
  repose() {
    const s = this.src();
    if (!s) {
      this.pose = null;
      return;
    }
    this.flush();
    this.pose = new RigPose(this.rig, s);
    this.pose.phys.clear();
    this.overlay = null;
    this.lookCache = null;
  }

  // ------------------------------------------------------------ the screen
  build() {
    const app = this.app;
    const r = this.rig;
    clear(this.stage);
    clear(this.insp);
    this.src();
    this.repose();
    this.playBtn = button(null, { icon: 'pause', small: true, title: 'Play / pause (Enter)', onClick: () => {
      this.playing = !this.playing;
      this.drawPlayBtn();
    } });
    this.modeSeg = seg(MODES, this.mode, (v) => this.setMode(v));
    this.animSel = h('span');
    const bar = titleBar(app, 'rigs', this.id,
      this.modeSeg,
      h('span', { class: 'sep' }),
      this.animSel,
      group(this.playBtn), seg(SPEEDS, this.speed, (v) => (this.speed = v)),
      group(button(null, { icon: 'minus', small: true, title: 'Zoom out', onClick: () => (this.zoom = Math.max(1, this.zoom - 1)) }), button(null, { icon: 'plus', small: true, title: 'Zoom in', onClick: () => (this.zoom = Math.min(24, this.zoom + 1)) })),
      h('span', { class: 'spacer' }),
      menuButton('Export', () => [{ label: 'Bake an animation into pixel art...', icon: 'pencil', onClick: () => this.bakeDialog() }], { small: true, icon: 'export' }),
      menuButton('Use it', () => ['tpl.animal', 'tpl.hostile', 'tpl.npc', 'tpl.boss'].map((tp) => ({ label: `Make ${NODES[tp].title.toLowerCase().replace('person (npc)', 'a person').replace(/^(animal|hostile)/, 'an $1').replace(/^boss/, 'a boss')} with it`, icon: 'skull', onClick: () => app.newEntity(tp, { rig: this.id }, r.name.replace(/ rig$/, '')) })), { small: true, kind: 'primary', icon: 'star' }));
    this.nameEl = bar.querySelector('.title input');
    this.vt = h('div', { class: 'vtools' });
    this.wrap = h('div', { class: 'canvas-wrap' });
    this.cv = h('canvas');
    this.hud = h('div', { class: 'hud' });
    this.look = h('div', { class: 'rig-look', 'data-tip': 'As the game will show it (walking, standing, striking, flinching)' });
    this.lookCache = null;
    // (Round 67) The game's view of it, folded away and back.
    this.lookBtn = button(null, { icon: this.lookShut ? 'eye' : 'eyeOff', small: true, kind: 'ghost', cls: 'rig-look-btn', title: this.lookShut ? 'Show it as the game will' : 'Hide the game\'s view of it', onClick: () => {
      this.lookShut = !this.lookShut;
      try {
        appStorage()?.setItem('ws-rig-look', this.lookShut ? 'shut' : '');
      } catch {
        // Fine.
      }
      this.build();
    } });
    this.look.classList.toggle('shut', this.lookShut);
    this.wrap.append(this.cv, this.hud, this.look, this.lookBtn);
    this.bindCanvas();
    this.tl = h('div', { class: 'vfx-tl' });
    this.stage.append(bar, h('div', { style: { flex: 1, display: 'flex', minHeight: 0 } }, this.vt, this.wrap), this.tl);
    dropTarget(this.wrap, (p) => p.kind === 'assets', (p) => {
      this.set((x) => {
        x.asset = p.id;
        x.mask = '';
      }, { side: false, timeline: false });
      this.loadMask();
      this.build();
    });
    this.insp.append(h('div', { class: 'insp-head' }, ic('bone'), r.name));
    this.side = h('div', { class: 'insp-body scroll' });
    this.insp.append(this.side);
    this.drawSide();
    this.drawAnimSel();
    this.drawTimeline();
    this.drawPlayBtn();
    this.app.hint(this.hintText());
    requestAnimationFrame(() => this.fitCanvas(true));
    // (Round 67: one loop only. Each build used to start another, and the
    // animation ran on at twice, three times its speed.)
    window.cancelAnimationFrame(this.raf);
    const gen = (this.gen = (this.gen || 0) + 1);
    let last = performance.now();
    const loop = (now) => {
      if (gen !== this.gen) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.mode === 'anim' && this.playing) {
        this.t += dt * this.speed;
        this.movePlayhead();
      }
      this.draw(dt * this.speed);
    };
    this.raf = requestAnimationFrame(loop);
  }

  setMode(m) {
    this.mode = m;
    for (const b of this.modeSeg.children) b.classList.toggle('on', b.textContent === MODES.find((q) => q[0] === m)[1]);
    if (this.pose) this.pose.phys.clear();
    this.drawSide();
    this.drawTimeline();
    this.app.hint(this.hintText());
  }

  drawPlayBtn() {
    if (!this.playBtn) return;
    this.playBtn.innerHTML = '';
    this.playBtn.append(ic(this.playing ? 'pause' : 'play', 11));
  }

  drawAnimSel() {
    clear(this.animSel);
    const r = this.rig;
    const names = [...new Set([...ANIMS, ...Object.keys(r.anims || {})])];
    const sel = select(names.map((n) => [n, `${n}${r.anims[n] ? '' : ' (none yet)'}`]), this.anim, (v) => {
      this.anim = v;
      this.keySel = null;
      this.t = 0;
      if (this.pose) this.pose.phys.clear();
      this.drawSide();
      this.drawTimeline();
    });
    this.animSel.append(sel);
  }

  fitCanvas(refit = false) {
    if (!this.cv || !this.wrap.isConnected) return;
    const rc = this.wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.max(1, Math.round(rc.width * dpr));
    this.cv.height = Math.max(1, Math.round(rc.height * dpr));
    this.cw = rc.width;
    this.ch = rc.height;
    const a = this.asset;
    if (refit) this.pan = { x: 0, y: 0 };
    if ((refit || !this.zoom) && a) this.zoom = Math.max(1, Math.min(24, Math.floor(Math.min((this.cw - 60) / (a.w * 1.8), (this.ch - 60) / (a.h * 1.6)))));
  }

  // The art's (0, 0) on the canvas, and its scale.
  view() {
    const a = this.asset;
    const z = this.zoom || 4;
    const P = this.pan || { x: 0, y: 0 };
    return { z, ox: Math.round((this.cw - a.w * z) / 2 + P.x), oy: Math.round((this.ch - a.h * z) / 2 + a.h * z * 0.12 + P.y) };
  }

  toArt(e) {
    const rc = this.cv.getBoundingClientRect();
    const V = this.view();
    return { x: (e.clientX - rc.left - V.ox) / V.z, y: (e.clientY - rc.top - V.oy) / V.z };
  }

  partColor(i) {
    return PART_COLORS[(i - 1) % PART_COLORS.length];
  }

  // The parts, painted over the art (when cutting).
  overlayCanvas() {
    if (this.overlay) return this.overlay;
    const a = this.asset;
    const c = canvas(a.w, a.h);
    const x = c.getContext('2d');
    const img = x.createImageData(a.w, a.h);
    const S = this.src();
    for (let i = 0; i < a.w * a.h; i++) {
      if (!S.rgba[i * 4 + 3]) continue;
      const k = this.mask[i];
      const col = k ? this.partColor(k) : '#808080';
      const n = parseInt(col.slice(1), 16);
      img.data[i * 4] = n >> 16;
      img.data[i * 4 + 1] = (n >> 8) & 255;
      img.data[i * 4 + 2] = n & 255;
      img.data[i * 4 + 3] = k ? 255 : 70;
    }
    x.putImageData(img, 0, 0);
    this.overlay = c;
    return c;
  }

  // Bones' places now (rigid when not animating).
  pose_(dt) {
    if (!this.pose) return null;
    const A = this.mode === 'anim' ? (this.rig.anims || {})[this.anim] || null : null;
    if (this.mode !== 'anim') return this.pose.rigid(null, 0);
    return this.pose.step(A, this.t, Math.max(1e-3, dt || 1 / 60));
  }

  draw(dt) {
    if (!this.cv) return;
    // (Round 67) The view's size changed without a resize (the timeline
    // shown or hidden, a panel widened): fitted again, so the pixel under
    // the mouse is the one marked.
    if (this.wrap && this.wrap.isConnected) {
      const rc = this.wrap.getBoundingClientRect();
      if (Math.abs(rc.width - this.cw) > 0.5 || Math.abs(rc.height - this.ch) > 0.5) this.fitCanvas();
    }
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#08060b';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    const a = this.asset;
    if (!a || !this.pose) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#9a8a70';
      ctx.font = '13px monospace';
      ctx.fillText('Choose the art to rig (on the right), or drag some art here.', 30, 40);
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const V = this.view();
    const z = V.z;
    // A floor line under its feet, and a faint checker where the art is.
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < a.h; y++) for (let x = (y % 2); x < a.w; x += 2) ctx.fillRect(V.ox + x * z, V.oy + y * z, z, z);
    ctx.fillStyle = 'rgba(128,224,112,0.35)';
    ctx.fillRect(V.ox - a.w * z * 0.6, V.oy + a.h * z, a.w * z * 2.2, 1);
    const M = this.pose_(dt);
    this.M = M;
    if (this.mode === 'cut') {
      ctx.drawImage(this.artCv, V.ox, V.oy, a.w * z, a.h * z);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.overlayCanvas(), V.ox, V.oy, a.w * z, a.h * z);
      ctx.globalAlpha = 1;
      if (z >= 6) {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        for (let x = 0; x <= a.w; x++) {
          ctx.moveTo(V.ox + x * z + 0.5, V.oy);
          ctx.lineTo(V.ox + x * z + 0.5, V.oy + a.h * z);
        }
        for (let y = 0; y <= a.h; y++) {
          ctx.moveTo(V.ox, V.oy + y * z + 0.5);
          ctx.lineTo(V.ox + a.w * z, V.oy + y * z + 0.5);
        }
        ctx.stroke();
      }
      if (this.hover) {
        ctx.strokeStyle = this.cutTool === 'erase' ? '#ff6060' : this.part ? this.partColor(this.part) : '#ffffff';
        const n = this.cutTool === 'brush' || this.cutTool === 'erase' ? this.size : 1;
        const o = Math.floor((n - 1) / 2);
        ctx.strokeRect(V.ox + (Math.floor(this.hover.x) - o) * z + 0.5, V.oy + (Math.floor(this.hover.y) - o) * z + 0.5, n * z - 1, n * z - 1);
      }
      if (this.box) {
        ctx.strokeStyle = '#ffe070';
        ctx.setLineDash([4, 3]);
        const [x0, y0, x1, y1] = this.box;
        ctx.strokeRect(V.ox + Math.min(x0, x1) * z, V.oy + Math.min(y0, y1) * z, (Math.abs(x1 - x0) + 1) * z, (Math.abs(y1 - y0) + 1) * z);
        ctx.setLineDash([]);
      }
    } else {
      // The posed art.
      const pad = Math.ceil(Math.max(a.w, a.h) * 0.5);
      const W = a.w + pad * 2;
      const H = a.h + pad * 2;
      const rgba = this.pose.render(M, W, H, pad, pad);
      if (!this.poseCv || this.poseCv.width !== W || this.poseCv.height !== H) this.poseCv = canvas(W, H);
      this.poseCv.getContext('2d').putImageData(new ImageData(rgba, W, H), 0, 0);
      ctx.globalAlpha = this.mode === 'bones' ? 0.55 : 1;
      ctx.drawImage(this.poseCv, V.ox - pad * z, V.oy - pad * z, W * z, H * z);
      ctx.globalAlpha = 1;
      this.drawBones(ctx, V, M);
    }
    const A = (this.rig.anims || {})[this.anim];
    this.hud.textContent = this.mode === 'anim' ? `${this.anim}: ${(A ? (A.loop === false ? Math.min(this.t, A.dur) : this.t % (A.dur || 1)) : 0).toFixed(2)}s${A ? ` / ${A.dur}s` : ' (none yet)'}` : this.mode === 'cut' ? `${this.part ? (this.rig.parts[this.part - 1] || {}).name : 'Body (no part)'} · brush ${this.size}` : `${(this.rig.bones || []).length} bones`;
    this.drawLook();
  }

  drawBones(ctx, V, M) {
    const r = this.rig;
    this.joints = [];
    for (const b of r.bones) {
      const B = M.get(b.id);
      if (!B) continue;
      const [jx, jy] = apply(B, b.x, b.y);
      const sx = V.ox + jx * V.z;
      const sy = V.oy + jy * V.z;
      const on = b.id === this.bone;
      // To its parent's joint.
      const p = b.parent && r.bones.find((q) => q.id === b.parent);
      if (p && M.get(p.id)) {
        const [px, py] = apply(M.get(p.id), p.x, p.y);
        ctx.strokeStyle = on ? '#ffe070' : 'rgba(255,255,255,0.45)';
        ctx.lineWidth = on ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(V.ox + px * V.z, V.oy + py * V.z);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      // To where its weight is.
      const tip = this.pose.tips.get(b.id);
      if (tip) {
        const [tx, ty] = apply(B, tip[0], tip[1]);
        ctx.strokeStyle = b.phys && b.phys.on ? 'rgba(112,224,224,0.6)' : 'rgba(255,224,112,0.35)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(V.ox + tx * V.z, V.oy + ty * V.z);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = on ? '#ffe070' : b.phys && b.phys.on ? '#70e0e0' : '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, on ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (on || this.mode === 'bones') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = '11px monospace';
        const w = ctx.measureText(b.name).width;
        ctx.fillRect(sx + 8, sy - 16, w + 6, 14);
        ctx.fillStyle = on ? '#ffe070' : '#e8d8b0';
        ctx.fillText(b.name, sx + 11, sy - 5);
      }
      this.joints.push({ b, sx, sy });
    }
  }

  // A small picture of it as the game will draw it.
  drawLook() {
    if (!this.look || this.lookShut) return;
    const now = performance.now();
    if (!this.lookCache) {
      clear(this.look);
      try {
        this.flush();
        const L = MODS.rigLook(this.app.mod, this.rig, false);
        if (L) {
          const cv = canvas(L.size * 4 * 4, L.size * 4 + 14);
          this.look.append(cv);
          this.lookCache = { L, cv, frames: [...Array(L.frames)].map((_, i) => {
            const p = L.draw(i);
            const c = canvas(L.size, L.size);
            c.getContext('2d').putImageData(new ImageData(p.d, L.size, L.size), 0, 0);
            return c;
          }) };
        } else this.lookCache = { none: true };
      } catch {
        this.lookCache = { none: true };
      }
    }
    const C = this.lookCache;
    if (!C || C.none) return;
    const x = C.cv.getContext('2d');
    x.clearRect(0, 0, C.cv.width, C.cv.height);
    x.imageSmoothingEnabled = false;
    const s = C.L.size * 3;
    let i = 0;
    for (const [name, g] of Object.entries(C.L.groups || { walk: [0, C.L.frames] })) {
      // (Round 67: at its own pace, as long as the animation lasts.)
      const f = g[0] + (Math.floor(((now / 1000) / groupSecs(name, g)) * g[1]) % g[1]);
      x.drawImage(C.frames[f], i * (s + 6), 0, s, s);
      x.fillStyle = '#9a8a70';
      x.font = '10px monospace';
      x.fillText(name, i * (s + 6) + 2, s + 11);
      i++;
    }
  }

  // ------------------------------------------------------------ pointer
  bindCanvas() {
    const cv = this.cv;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.max(1, Math.min(24, (this.zoom || 4) + (e.deltaY < 0 ? 1 : -1)));
    }, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      if (!this.asset) return;
      cv.setPointerCapture(e.pointerId);
      const p = this.toArt(e);
      // (Round 67) The view dragged about: with the middle or right
      // button, or holding Space; and when animating, from anywhere that
      // isn't a bone.
      if (e.button === 1 || e.button === 2 || this.spaceDown || (this.mode === 'anim' && !(this.jointAt(e) || this.nearestBone(p)))) {
        this.drag = { kind: 'pan', x0: e.clientX, y0: e.clientY, px: this.pan.x, py: this.pan.y };
        cv.style.cursor = 'grabbing';
        return;
      }
      if (this.mode === 'cut') return this.cutDown(p, e);
      if (this.mode === 'bones') return this.bonesDown(p, e);
      return this.animDown(p, e);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.asset) return;
      const p = this.toArt(e);
      this.hover = p;
      if (!this.drag) return;
      if (this.drag.kind === 'pan') {
        this.pan = { x: this.drag.px + e.clientX - this.drag.x0, y: this.drag.py + e.clientY - this.drag.y0 };
        return;
      }
      if (this.mode === 'cut') this.cutMove(p);
      else if (this.mode === 'bones') this.bonesMove(p);
      else this.animMove(p, e);
    });
    const up = () => {
      if (!this.drag) return;
      const D = this.drag;
      this.drag = null;
      if (D.kind === 'pan') {
        cv.style.cursor = '';
        return;
      }
      if (D.kind === 'box') this.applyBox();
      this.flush();
      this.app.touch('rigs', this.id);
      this.repose();
      this.drawSide();
      this.drawTimeline();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => (this.hover = null));
  }

  // Cutting.
  paintAt(x, y, k) {
    const a = this.asset;
    const n = this.cutTool === 'fill' || this.cutTool === 'rect' ? 1 : this.size;
    const o = Math.floor((n - 1) / 2);
    const S = this.src();
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
      const px = Math.floor(x) - o + dx;
      const py = Math.floor(y) - o + dy;
      if (px < 0 || py < 0 || px >= a.w || py >= a.h) continue;
      const i = py * a.w + px;
      if (!S.rgba[i * 4 + 3]) continue;
      this.mask[i] = k;
    }
    this.maskDirty = true;
    this.overlay = null;
  }

  cutDown(p, e) {
    this.ck();
    const k = e.button === 2 || this.cutTool === 'erase' ? 0 : this.part;
    if (this.cutTool === 'fill') {
      this.fillAt(p, k);
      this.drag = { kind: 'fill' };
      return;
    }
    if (this.cutTool === 'rect') {
      this.drag = { kind: 'box', k };
      this.box = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.x), Math.floor(p.y)];
      return;
    }
    this.drag = { kind: 'paint', k, last: p };
    this.paintAt(p.x, p.y, k);
  }

  cutMove(p) {
    const D = this.drag;
    if (D.kind === 'paint') {
      const n = Math.ceil(Math.max(Math.abs(p.x - D.last.x), Math.abs(p.y - D.last.y)));
      for (let i = 1; i <= n; i++) this.paintAt(D.last.x + ((p.x - D.last.x) * i) / n, D.last.y + ((p.y - D.last.y) * i) / n, D.k);
      D.last = p;
    } else if (D.kind === 'box') {
      this.box[2] = Math.floor(p.x);
      this.box[3] = Math.floor(p.y);
    }
  }

  applyBox() {
    const [x0, y0, x1, y1] = this.box;
    const k = this.drag ? this.drag.k : this.part;
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.paintAt(x, y, k ?? this.part);
    this.box = null;
  }

  fillAt(p, k) {
    const a = this.asset;
    const S = this.src();
    const x0 = Math.floor(p.x);
    const y0 = Math.floor(p.y);
    if (x0 < 0 || y0 < 0 || x0 >= a.w || y0 >= a.h) return;
    const i0 = y0 * a.w + x0;
    if (!S.rgba[i0 * 4 + 3]) return;
    const col = (i) => `${S.rgba[i * 4]},${S.rgba[i * 4 + 1]},${S.rgba[i * 4 + 2]}`;
    const want = col(i0);
    const seen = new Uint8Array(a.w * a.h);
    const st = [i0];
    while (st.length) {
      const i = st.pop();
      if (seen[i]) continue;
      seen[i] = 1;
      if (!S.rgba[i * 4 + 3] || col(i) !== want) continue;
      this.mask[i] = k;
      const x = i % a.w;
      const y = (i / a.w) | 0;
      if (x > 0) st.push(i - 1);
      if (x < a.w - 1) st.push(i + 1);
      if (y > 0) st.push(i - a.w);
      if (y < a.h - 1) st.push(i + a.w);
    }
    this.maskDirty = true;
    this.overlay = null;
  }

  // Bones.
  jointAt(e) {
    const rc = this.cv.getBoundingClientRect();
    const mx = e.clientX - rc.left;
    const my = e.clientY - rc.top;
    for (const j of [...(this.joints || [])].reverse()) if (Math.hypot(j.sx - mx, j.sy - my) <= 9) return j.b;
    return null;
  }

  bonesDown(p, e) {
    const b = this.jointAt(e);
    if (b) {
      this.bone = b.id;
      this.ck();
      this.drag = { kind: 'joint', b };
      this.drawSide();
      return;
    }
    if (e.button === 2) return;
    // A new bone, under the chosen one.
    this.ck();
    const r = this.rig;
    let n = r.bones.length + 1;
    while (r.bones.some((q) => q.id === `b${n}`)) n++;
    const nb = { id: `b${n}`, name: `Bone ${n}`, parent: this.bone && r.bones.some((q) => q.id === this.bone) ? this.bone : null, x: Math.round(p.x), y: Math.round(p.y), role: 'other', rest: 0, phys: { on: false, stiff: 40, damp: 6, swing: 1 } };
    r.bones.push(nb);
    this.bone = nb.id;
    this.app.touch('rigs', this.id);
    this.repose();
    this.drawSide();
    toast(`${nb.name} added${nb.parent ? `, under ${r.bones.find((q) => q.id === nb.parent).name}` : ''}. Give parts to it on the left of the Parts list.`);
  }

  bonesMove(p) {
    const D = this.drag;
    if (D.kind !== 'joint') return;
    D.b.x = Math.round(p.x * 2) / 2;
    D.b.y = Math.round(p.y * 2) / 2;
    this.repose();
  }

  removeBone(id) {
    this.set((r) => {
      const b = r.bones.find((q) => q.id === id);
      for (const q of r.bones) if (q.parent === id) q.parent = b ? b.parent : null;
      r.bones = r.bones.filter((q) => q.id !== id);
      for (const p of r.parts) if (p.bone === id) p.bone = b && b.parent ? b.parent : r.bones[0] ? r.bones[0].id : null;
      for (const A of Object.values(r.anims || {})) {
        delete (A.moves || {})[id];
        delete (A.keys || {})[id];
      }
    });
    if (this.bone === id) this.bone = null;
  }

  // Posing (a keyframe of a bone's turn, at the time shown).
  animDown(p, e) {
    const b = this.jointAt(e) || this.nearestBone(p);
    if (!b) return;
    this.bone = b.id;
    if (!this.rig.anims[this.anim]) this.set((r) => (r.anims[this.anim] = { dur: 1, loop: true, moves: {}, keys: {} }));
    this.playing = false;
    this.drawPlayBtn();
    const B = this.M && this.M.get(b.id);
    if (!B) return;
    const [jx, jy] = apply(B, b.x, b.y);
    const tip = this.pose.tips.get(b.id) || [b.x, b.y - 4];
    const [tx, ty] = apply(B, tip[0], tip[1]);
    this.ck();
    const A = this.rig.anims[this.anim];
    const tt = this.animT();
    const k0 = keyAt(((A.keys || {})[b.id] || {}).rot, tt);
    this.drag = { kind: 'pose', b, jx, jy, a0: Math.atan2(ty - jy, tx - jx), start: Math.atan2(p.y - jy, p.x - jx), k0, tt };
    this.drawSide();
  }

  animMove(p) {
    const D = this.drag;
    if (D.kind !== 'pose') return;
    const ang = Math.atan2(p.y - D.jy, p.x - D.jx);
    let d = ((ang - D.start) * 180) / Math.PI;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    this.setKey(D.b.id, 'rot', D.tt, Math.round(D.k0 + d));
    this.pose.phys.clear();
  }

  nearestBone(p) {
    let best = null;
    for (const j of this.joints || []) {
      const V = this.view();
      const d = Math.hypot((j.sx - V.ox) / V.z - p.x, (j.sy - V.oy) / V.z - p.y);
      if (!best || d < best.d) best = { b: j.b, d };
    }
    return best && best.d < 6 ? best.b : null;
  }

  animT() {
    const A = this.rig.anims[this.anim];
    if (!A) return 0;
    const d = A.dur || 1;
    return +(A.loop === false ? Math.min(this.t, d) : this.t % d).toFixed(2);
  }

  setKey(boneId, track, t, v) {
    const A = this.rig.anims[this.anim];
    A.keys ||= {};
    const K = (A.keys[boneId] ||= {});
    const arr = (K[track] ||= []);
    const at = arr.find((k) => Math.abs(k.t - t) < 0.011);
    if (at) at.v = v;
    else {
      arr.push({ t, v, e: 'inout' });
      arr.sort((a, b) => a.t - b.t);
      // (A first key not at the start: one at 0 to come from.)
      if (arr[0].t > 0.001) arr.unshift({ t: 0, v: 0, e: 'inout' });
    }
    this.keySel = { bone: boneId, track, t };
  }

  deleteKey() {
    const S = this.keySel;
    if (!S) return;
    this.set((r) => {
      const K = ((r.anims[this.anim] || {}).keys || {})[S.bone];
      if (!K || !K[S.track]) return;
      K[S.track] = K[S.track].filter((k) => Math.abs(k.t - S.t) > 0.011);
      if (!K[S.track].length) delete K[S.track];
    });
    this.keySel = null;
  }

  // ------------------------------------------------------------ the side
  drawSide() {
    const s = this.side;
    if (!s) return;
    clear(s);
    const app = this.app;
    const r = this.rig;
    this.drawTools();
    if (this.animSel) this.drawAnimSel();
    // The art, and cutting it up.
    const top = h('div');
    top.append(field('Art', refPicker(app, 'asset', r.asset, (v) => {
      this.set((x) => {
        x.asset = v;
        x.mask = '';
      });
      this.loadMask();
      this.build();
    })));
    const a = this.asset;
    if (a && a.frames.length > 1) top.append(field('Its frame', slider({ value: r.frame || 0, min: 0, max: a.frames.length - 1, int: true, onChange: (v) => {
      this.set((x) => (x.frame = v));
      this.build();
    } }), { tip: 'Which of the art\'s frames is cut up.' }));
    if (a) top.append(h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap', marginTop: '6px' } }, button('Cut it up for me...', { small: true, kind: 'primary', icon: 'bone', title: 'Bones and parts made at a go, for a kind of body (then change what you like)', onClick: (e) => {
      const rc = e.currentTarget.getBoundingClientRect();
      menu(Object.entries(RIG_KINDS).map(([k, d]) => ({ label: d, onClick: () => this.quick(k) })), rc.left, rc.bottom + 4);
    } })));
    s.append(panel('Rig', top, { key: 'rg-rig' }));
    if (!a) return;
    if (this.mode === 'cut') s.append(panel('Parts', this.partsBody(), { key: 'rg-parts', tools: [button(null, { icon: 'plus', small: true, kind: 'ghost', title: 'A new part', onClick: () => this.addPart() })] }));
    if (this.mode === 'bones') s.append(panel('Bones', this.bonesBody(), { key: 'rg-bones' }));
    if (this.mode === 'anim') s.append(panel('Animation', this.animBody(), { key: 'rg-anim' }));
    if (this.mode !== 'cut') s.append(panel('Parts on bones', this.partsBody(true), { key: 'rg-parts2', open: false }));
  }

  drawTools() {
    const vt = this.vt;
    if (!vt) return;
    clear(vt);
    if (this.mode !== 'cut') {
      vt.style.display = 'none';
      return;
    }
    vt.style.display = '';
    for (const [id, icon, tip, key] of CUT_TOOLS) vt.append(button(null, { icon, title: tip, key, on: this.cutTool === id, onClick: () => {
      this.cutTool = id;
      this.drawTools();
    } }));
  }

  quick(kind) {
    const S = this.src();
    if (!S) return;
    const has = (this.rig.bones || []).length;
    const go = () => {
      this.set((r) => Object.assign(r, quickRig(kind, S, { asset: r.asset, frame: r.frame || 0, name: r.name })));
      this.loadMask();
      this.repose();
      this.bone = null;
      this.part = 1;
      this.drawSide();
      this.drawTimeline();
      toast('Cut up, with bones and a walk, an idle, an attack and a flinch. Touch up the parts (Cut) and the joints (Bones) to suit.', 'good', 5000);
    };
    if (!has) return go();
    dialog({ title: 'Start the rig again?', icon: 'bone', body: h('div', { class: 'note' }, 'Its parts, bones and animations will be made afresh (Undo brings them back).'), buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Start again', kind: 'primary', value: 'ok' }] }).then((v) => v === 'ok' && go());
  }

  addPart() {
    const r = this.rig;
    if (r.parts.length >= 60) return;
    this.set((x) => x.parts.push({ id: `p${Date.now().toString(36)}`, name: `Part ${x.parts.length + 1}`, bone: this.bone || (x.bones[0] && x.bones[0].id) || null, z: x.parts.length + 1 }));
    this.part = this.rig.parts.length;
    this.drawSide();
  }

  removePart(i) {
    this.set((r) => {
      r.parts.splice(i, 1);
      // (Its pixels back to the body; the later parts' numbers down one.)
      for (let k = 0; k < this.mask.length; k++) {
        if (this.mask[k] === i + 1) this.mask[k] = 0;
        else if (this.mask[k] > i + 1) this.mask[k]--;
      }
      this.maskDirty = true;
      this.flush();
    });
    this.part = Math.min(this.part, this.rig.parts.length);
    this.overlay = null;
    this.drawSide();
  }

  partsBody(compact = false) {
    const r = this.rig;
    const body = h('div');
    const list = h('div', { class: 'list' });
    const boneOpts = [['', '(the body)'], ...r.bones.map((b) => [b.id, b.name])];
    const counts = new Map();
    for (const k of this.mask || []) counts.set(k, (counts.get(k) || 0) + 1);
    if (!compact) {
      const base = h('div', { class: `li${this.part === 0 ? ' on' : ''}` }, h('span', { class: 'rg-sw', style: { background: '#808080' } }), h('span', { style: { flex: 1 } }, 'The body (no part)'), h('span', { class: 'note' }, String(counts.get(0) || 0)));
      base.addEventListener('click', () => {
        this.part = 0;
        this.drawSide();
      });
      list.append(base);
    }
    r.parts.forEach((p, i) => {
      const nm = textInput({ value: p.name, onChange: (v) => this.set((x) => (x.parts[i].name = v.slice(0, 24) || p.name)) });
      nm.style.flex = '1';
      nm.style.minWidth = '0';
      const li = h('div', { class: `li${this.part === i + 1 ? ' on' : ''}`, style: { flexWrap: 'wrap' } },
        h('span', { class: 'rg-sw', style: { background: this.partColor(i + 1) } }), nm,
        h('span', { class: 'note' }, String(counts.get(i + 1) || 0)),
        h('div', { class: 'row', style: { width: '100%', gap: '4px', paddingLeft: '20px' } },
          select(boneOpts, p.bone || '', (v) => this.set((x) => (x.parts[i].bone = v || null))),
          button(null, { icon: 'up', small: true, kind: 'ghost', title: 'In front of more', onClick: (e) => {
            e.stopPropagation();
            this.set((x) => (x.parts[i].z = (x.parts[i].z || 0) + 1));
          } }),
          h('span', { class: 'note' }, `z${p.z || 0}`),
          button(null, { icon: 'down', small: true, kind: 'ghost', title: 'Behind more', onClick: (e) => {
            e.stopPropagation();
            this.set((x) => (x.parts[i].z = (x.parts[i].z || 0) - 1));
          } }),
          compact ? null : button(null, { icon: 'trash', small: true, kind: 'ghost', title: 'Delete the part (its pixels go back to the body)', onClick: (e) => {
            e.stopPropagation();
            this.removePart(i);
          } })));
      li.addEventListener('click', (e) => {
        if (e.target.closest('select,input,button')) return;
        this.part = i + 1;
        this.drawSide();
      });
      list.append(li);
    });
    if (!r.parts.length) list.append(h('div', { class: 'note' }, 'No parts yet: "Cut it up for me" above, or + for a part of your own to paint.'));
    body.append(list);
    if (!compact) {
      body.append(field('Brush', slider({ value: this.size, min: 1, max: 6, int: true, onChange: (v) => (this.size = v) })));
      body.append(field('The body is drawn at', numberInput({ value: r.baseZ || 0, min: -20, max: 20, int: true, onChange: (v) => this.set((x) => (x.baseZ = v)) }), { tip: 'Its depth among the parts (parts with more are in front of it).' }));
    }
    return body;
  }

  bonesBody() {
    const r = this.rig;
    const body = h('div');
    const depth = (b, d = 0) => (b.parent && d < 20 ? depth(r.bones.find((q) => q.id === b.parent) || {}, d + 1) : d);
    const list = h('div', { class: 'list' });
    const order = this.pose ? this.pose.order : r.bones;
    for (const b of order) {
      const li = h('div', { class: `li${b.id === this.bone ? ' on' : ''}`, style: { paddingLeft: `${8 + depth(b) * 14}px` } }, ic('bone', 10), h('span', { style: { flex: 1 } }, b.name), h('span', { class: 'note' }, b.role || ''), b.phys && b.phys.on ? h('span', { class: 'note', style: { color: 'var(--cyan)' } }, '~') : null);
      li.addEventListener('click', () => {
        this.bone = b.id;
        this.drawSide();
      });
      list.append(li);
    }
    if (!r.bones.length) list.append(h('div', { class: 'note' }, 'No bones yet: click on the art to put one down (its joint), or "Cut it up for me".'));
    body.append(list);
    const b = r.bones.find((q) => q.id === this.bone);
    if (b) {
      const i = r.bones.indexOf(b);
      // (`side` false: the panel isn't drawn afresh: a slider's own change.)
      const set = (fn, side = true) => this.set((x) => fn(x.bones[i]), { side });
      body.append(h('div', { class: 'hr' }),
        field('Name', textInput({ value: b.name, onChange: (v) => set((q) => (q.name = v.slice(0, 24) || b.name)) })),
        field('Hangs from', select([['', '(nothing: the root)'], ...r.bones.filter((q) => q.id !== b.id).map((q) => [q.id, q.name])], b.parent || '', (v) => set((q) => (q.parent = v || null)))),
        field('Is a', select(ROLES.map((x) => [x, x]), b.role || 'other', (v) => set((q) => (q.role = v))), { tip: 'What it is decides how "make it for me" animates it.' }),
        field('Rests turned', slider({ value: b.rest || 0, min: -180, max: 180, int: true, onChange: (v) => set((q) => (q.rest = v), false) })),
        check('Springy (sways as the body moves)', !!(b.phys && b.phys.on), (v) => set((q) => (q.phys = { stiff: 40, damp: 6, swing: 1, ...(q.phys || {}), on: v })), { tip: 'For tails, ears, hair, antennae, loose cloth.' }));
      if (b.phys && b.phys.on) body.append(
        field('Stiffness', slider({ value: b.phys.stiff ?? 40, min: 2, max: 200, int: true, onChange: (v) => set((q) => (q.phys.stiff = v), false) })),
        field('Damping', slider({ value: b.phys.damp ?? 6, min: 0, max: 30, step: 0.5, onChange: (v) => set((q) => (q.phys.damp = v), false) })),
        field('Swing', slider({ value: b.phys.swing ?? 1, min: 0, max: 5, step: 0.1, onChange: (v) => set((q) => (q.phys.swing = v), false) })));
      body.append(h('div', { class: 'row', style: { marginTop: '6px' } }, button('Delete the bone', { small: true, icon: 'trash', kind: 'ghost', onClick: () => this.removeBone(b.id) })));
    }
    return body;
  }

  animBody() {
    const r = this.rig;
    const body = h('div');
    const A = r.anims[this.anim];
    if (!A) {
      body.append(h('div', { class: 'note' }, `No "${this.anim}" yet.`), h('div', { class: 'row', style: { gap: '4px', marginTop: '6px' } },
        button('Make it for me', { small: true, kind: 'primary', icon: 'star', onClick: () => this.set((x) => (x.anims = autoAnims(x, this.anim))) }),
        button('An empty one', { small: true, onClick: () => this.set((x) => (x.anims[this.anim] = { dur: 1, loop: this.anim === 'walk' || this.anim === 'idle', moves: {}, keys: {} })) })));
      return body;
    }
    const setA = (fn, side = true) => this.set((x) => fn(x.anims[this.anim]), { side });
    body.append(field('Lasts (s)', slider({ value: A.dur || 1, min: 0.1, max: 20, step: 0.05, onChange: (v) => setA((q) => (q.dur = v), false) }), { tip: 'How long it takes, once through (in the game too). Its keyframes stay where they are: to make all of it slower or faster, use the buttons below.' }));
    // (Round 67) All of it, slower or faster: its length and its keyframes'
    // times stretched together (its waves keep time with it by themselves).
    const stretchA = (k) => setA((q) => {
      const d0 = q.dur || 1;
      q.dur = Math.max(0.1, Math.min(20, Math.round(d0 * k * 100) / 100));
      const f = q.dur / d0;
      for (const K of Object.values(q.keys || {})) for (const arr of Object.values(K)) for (const key of arr || []) key.t = Math.round(key.t * f * 100) / 100;
    });
    body.append(h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } },
      button('Slower', { small: true, icon: 'minus', title: 'All of it a quarter longer', onClick: () => stretchA(1.25) }),
      button('Faster', { small: true, icon: 'plus', title: 'All of it a fifth shorter', onClick: () => stretchA(0.8) }),
      button('Twice as long', { small: true, onClick: () => stretchA(2) }),
      button('Half as long', { small: true, onClick: () => stretchA(0.5) })));
    body.append(check('Loops', A.loop !== false, (v) => setA((q) => (q.loop = v))));
    body.append(h('div', { class: 'row', style: { gap: '4px', margin: '6px 0' } }, button('Make it again for me', { small: true, icon: 'star', title: 'From the bones\' roles (your keyframes and waves for it are replaced)', onClick: () => this.set((x) => (x.anims = autoAnims(x, this.anim))) }), button('Clear it', { small: true, kind: 'ghost', icon: 'trash', onClick: () => setA((q) => {
      q.moves = {};
      q.keys = {};
    }) })));
    // The chosen bone's waves.
    const b = r.bones.find((q) => q.id === this.bone);
    body.append(h('div', { class: 'hr' }));
    if (!b) {
      body.append(h('div', { class: 'note' }, 'Click a bone (or its joint) to see how it moves.'));
      return body;
    }
    body.append(h('b', null, b.name), h('div', { class: 'note', style: { margin: '4px 0 8px' } }, 'Waves move it by themselves, over and over: how far, how many times round in the animation, and when (0 to 1).'));
    const mv = (A.moves || {})[b.id] || {};
    const wave = (k, label, max, step) => {
      const w = mv[k] || [0, 1, 0];
      const upd = (j, v) => setA((q) => {
        q.moves ||= {};
        const m = (q.moves[b.id] ||= {});
        const cur = (m[k] ||= [0, 1, 0]);
        cur[j] = v;
        if (!cur[0]) delete m[k];
        if (!Object.keys(m).length) delete q.moves[b.id];
      });
      return h('div', { class: 'rg-wave' }, h('span', { class: 'note' }, label),
        slider({ value: w[0], min: k === 'sq' ? 0 : -max, max, step, onChange: (v) => upd(0, v) }),
        h('div', { class: 'row', style: { gap: '4px', alignItems: 'center' } }, h('span', { class: 'note' }, '×'), numberInput({ value: w[1] || 1, min: 1, max: 8, int: true, onChange: (v) => upd(1, v) }), h('span', { class: 'note' }, 'at'), numberInput({ value: w[2] || 0, min: 0, max: 1, step: 0.05, onChange: (v) => upd(2, v) })));
    };
    body.append(wave('rot', 'Swing (°)', 90, 1), wave('x', 'Sway (px)', 8, 0.5), wave('y', 'Bob (px)', 8, 0.5));
    if (!b.parent) body.append(wave('sq', 'Squash', 0.5, 0.01));
    const K = (A.keys || {})[b.id] || {};
    const n = Object.values(K).reduce((s2, arr) => s2 + arr.length, 0);
    body.append(h('div', { class: 'note', style: { marginTop: '6px' } }, n ? `${n} keyframe${n > 1 ? 's' : ''} (on the timeline below; click one to choose it, Delete removes it). Drag the bone in the view to add one.` : 'No keyframes: drag the bone in the view to pose it at the time shown.'));
    return body;
  }

  // ------------------------------------------------------------ timeline
  drawTimeline() {
    const tl = this.tl;
    if (!tl) return;
    clear(tl);
    tl.style.display = this.mode === 'anim' ? '' : 'none';
    if (this.mode !== 'anim') return;
    const r = this.rig;
    const A = r.anims[this.anim];
    const D = A ? Math.max(0.1, A.dur || 1) : 1;
    const span = D;
    const ruler = h('div', { class: 'vt-ruler' });
    for (let s = 0; s <= span + 1e-6; s += span > 2 ? 0.5 : 0.1) ruler.append(h('span', { class: 'tick', style: { left: `${(s / span) * 100}%` } }, `${+s.toFixed(2)}s`));
    this.head = h('div', { class: 'vt-head' });
    const rows = h('div');
    const lane = h('div', { class: 'vt-lane' }, ruler, rows, this.head);
    const toT = (e) => {
      const rc = lane.getBoundingClientRect();
      return Math.max(0, Math.min(span, ((e.clientX - rc.left) / rc.width) * span));
    };
    ruler.addEventListener('pointerdown', (e) => {
      this.playing = false;
      this.drawPlayBtn();
      this.t = toT(e);
      if (this.pose) this.pose.phys.clear();
      this.movePlayhead();
      const mv = (ev) => {
        this.t = toT(ev);
        this.movePlayhead();
      };
      const up = () => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    const names = h('div', { class: 'vt-names' }, h('div', { class: 'vt-n head' }, 'Bones'));
    for (const b of this.pose ? this.pose.order : r.bones) {
      const on = b.id === this.bone;
      const nm = h('div', { class: `vt-n${on ? ' on' : ''}` }, ic('bone', 10), b.name);
      nm.addEventListener('click', () => {
        this.bone = b.id;
        this.drawSide();
        this.drawTimeline();
      });
      names.append(nm);
      const row = h('div', { class: `vt-row${on ? ' on' : ''}` });
      const mv = A && A.moves && A.moves[b.id];
      if (mv && Object.keys(mv).length) row.append(h('div', { class: 'rg-wavebar', 'data-tip': 'Moved by waves' }));
      const K = (A && A.keys && A.keys[b.id]) || {};
      for (const [track, arr] of Object.entries(K)) for (const k of arr) {
        const sel = this.keySel && this.keySel.bone === b.id && this.keySel.track === track && Math.abs(this.keySel.t - k.t) < 0.011;
        const d = h('div', { class: `vt-key${sel ? ' on' : ''}${track !== 'rot' ? ' small' : ''}`, style: { left: `${(k.t / span) * 100}%` }, 'data-tip': `${b.name}: ${track === 'rot' ? 'turn' : track} ${k.v} at ${k.t}s` });
        d.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          this.bone = b.id;
          this.keySel = { bone: b.id, track, t: k.t };
          this.t = k.t;
          this.playing = false;
          this.drawPlayBtn();
          this.ck();
          const move = (ev) => {
            k.t = +toT(ev).toFixed(2);
            this.keySel.t = k.t;
            d.style.left = `${(k.t / span) * 100}%`;
          };
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            arr.sort((p, q) => p.t - q.t);
            this.app.touch('rigs', this.id);
            this.repose();
            this.drawTimeline();
            this.drawSide();
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        });
        row.append(d);
      }
      rows.append(row);
    }
    tl.append(h('div', { class: 'vt' }, names, lane));
    this.span = span;
    this.movePlayhead();
  }

  movePlayhead() {
    if (!this.head) return;
    const A = (this.rig.anims || {})[this.anim];
    const d = A ? A.dur || 1 : 1;
    const t = A && A.loop === false ? Math.min(this.t, d) : this.t % d;
    this.head.style.left = `${(t / (this.span || 1)) * 100}%`;
  }

  // ------------------------------------------------------------ out
  async bakeDialog() {
    const r = this.rig;
    const names = Object.keys(r.anims || {});
    if (!names.length || !this.pose) return toast('It has no animations yet.');
    let anim = names.includes(this.anim) ? this.anim : names[0];
    let n = 6;
    let colours = 32;
    const v = await dialog({ title: 'Bake into pixel art', icon: 'pencil', body: [
      h('div', { class: 'note' }, 'An animation drawn out frame by frame into new art (in the Pixel tool), with room about it for what swings out.'),
      field('Animation', select(names.map((q) => [q, q]), anim, (x) => (anim = x))),
      field('Frames', slider({ value: n, min: 2, max: Math.min(24, LIMITS.frames), int: true, onChange: (x) => (n = x) })),
      field('Colours at most', slider({ value: colours, min: 4, max: 96, int: true, onChange: (x) => (colours = x) })),
    ], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Bake', kind: 'primary', value: 'ok' }] });
    if (v !== 'ok') return;
    this.flush();
    const P = new RigPose(r, this.src());
    const b = P.bake(anim, n);
    const all = new Uint8ClampedArray(b.w * b.h * 4 * n);
    b.frames.forEach((f, i) => all.set(f, i * b.w * b.h * 4));
    const q = quantize(all, b.w, b.h * n, colours);
    const A = r.anims[anim];
    const frames = b.frames.map((f, i) => ({ dur: Math.round(((A.dur || 1) * 1000) / n), cels: { l1: encodeCel(q.idx.subarray(i * b.w * b.h, (i + 1) * b.w * b.h)) } }));
    await this.app.create('assets', { name: `${r.name} ${anim}`, w: b.w, h: b.h, use: 'creature', palette: q.palette.length ? q.palette : ['#ffffff'], frames, layers: [{ id: 'l1', name: 'Layer 1', visible: true, opacity: 1, blend: 'normal' }], tags: [{ name: anim, from: 0, to: n - 1, color: '#80e070' }], fps: 12 }, { open: false });
    toast('Baked into new art: it\'s in the explorer, under Art.', 'good');
  }
}
